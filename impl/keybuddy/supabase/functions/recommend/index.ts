import catalog from './keyboards.json' with { type: 'json' };

interface Keyboard {
  product_name: string;
  brand: string;
  price: number;
  image_url: string;
  switch_type: string;
  connection: string;
  layout: string;
  key_force: string;
  weight_g: number;
  wireless_type: string;
  engraving: string;
  backlight: string;
}

type RecommendInput =
  | { mode: 'freeform'; query: string }
  | { mode: 'guided'; answers: Record<string, string>; budget: { min: number; max: number } };

interface RawRecommendation {
  index: number;
  reason: string;
}

interface RawLLMResult {
  summary: string;
  recommendations: RawRecommendation[];
}

const keyboards = catalog as Keyboard[];
const maxCandidates = 25;
const maxRecommendations = 5;
const openaiTimeoutMs = 15000;
const rateLimitWindowMs = 60000;
const rateLimitMaxRequests = 10;
const model = Deno.env.get('OPENAI_MODEL') ?? 'gpt-5.4';
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseInput(value: unknown): RecommendInput {
  if (!isRecord(value)) {
    throw new Error('요청 형식이 올바르지 않습니다.');
  }

  if (value.mode === 'freeform') {
    if (typeof value.query !== 'string' || value.query.trim().length === 0) {
      throw new Error('추천 요청 문장을 입력해 주세요.');
    }
    return { mode: 'freeform', query: value.query.trim().slice(0, 800) };
  }

  if (value.mode === 'guided') {
    if (!isRecord(value.answers) || !isRecord(value.budget)) {
      throw new Error('단계별 추천 요청 형식이 올바르지 않습니다.');
    }

    const answers: Record<string, string> = {};
    for (const [key, answer] of Object.entries(value.answers)) {
      if (typeof answer === 'string') {
        answers[key.slice(0, 50)] = answer.slice(0, 160);
      }
    }

    return {
      mode: 'guided',
      answers,
      budget: {
        min: Number(value.budget.min) || 0,
        max: Number(value.budget.max) || 1000000,
      },
    };
  }

  throw new Error('지원하지 않는 추천 모드입니다.');
}

function clientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim() || 'unknown';
  }
  return request.headers.get('cf-connecting-ip') ?? request.headers.get('x-real-ip') ?? 'unknown';
}

function checkRateLimit(request: Request): { ok: true } | { ok: false; retryAfterSeconds: number } {
  const now = Date.now();
  const ip = clientIp(request);
  const current = rateLimitBuckets.get(ip);

  if (!current || current.resetAt <= now) {
    rateLimitBuckets.set(ip, { count: 1, resetAt: now + rateLimitWindowMs });
    return { ok: true };
  }

  if (current.count >= rateLimitMaxRequests) {
    return { ok: false, retryAfterSeconds: Math.ceil((current.resetAt - now) / 1000) };
  }

  current.count += 1;
  return { ok: true };
}

function normalizedInputText(input: RecommendInput): string {
  if (input.mode === 'freeform') {
    return input.query;
  }
  return Object.values(input.answers).join(' ');
}

function budgetRange(input: RecommendInput): { min: number; max: number } | null {
  if (input.mode === 'guided') {
    return input.budget;
  }

  const query = input.query.replace(/\s/g, '');
  const underManwon = query.match(/(\d+)만원(?:이하|까지|안쪽|미만)/);
  if (underManwon) {
    return { min: 0, max: Number(underManwon[1]) * 10000 };
  }

  const underWon = query.match(/(\d{4,})원(?:이하|까지|안쪽|미만)/);
  if (underWon) {
    return { min: 0, max: Number(underWon[1]) };
  }

  return null;
}

function scoreKeyboard(keyboard: Keyboard, input: RecommendInput): number {
  const text = normalizedInputText(input);
  const searchable = [
    keyboard.product_name,
    keyboard.brand,
    keyboard.switch_type,
    keyboard.connection,
    keyboard.wireless_type,
    keyboard.layout,
    keyboard.engraving,
    keyboard.backlight,
  ].join(' ');

  let score = 0;
  const budget = budgetRange(input);

  if (budget) {
    if (keyboard.price >= budget.min && keyboard.price <= budget.max) score += 6;
    else if (keyboard.price > budget.max) score -= 8;
  }

  if (/조용|저소음|사무|회사|오피스/.test(text)) {
    if (/무접점|펜타그래프|저소음|멤브레인/.test(searchable)) score += 5;
    if (/청축/.test(searchable)) score -= 4;
  }

  if (/게임|게이밍|반응|RGB|화려/.test(text)) {
    if (/기계식|광축|자석축/.test(searchable)) score += 4;
    if (/RGB|LED|백라이트/.test(searchable)) score += 2;
  }

  if (/무선|블루투스|동글|휴대|아이패드|태블릿/.test(text)) {
    if (/무선|블루투스|동글|리시버|2\.4GHz/.test(searchable)) score += 5;
  }

  if (/텐키리스|숫자\s*패드\s*없|작|미니|휴대/.test(text)) {
    if (/텐키리스|미니|87키|84키|68키|61키/.test(searchable)) score += 4;
  }

  if (/풀배열|숫자\s*패드|사무/.test(text)) {
    if (/풀배열|104키|108키/.test(searchable)) score += 2;
  }

  for (const token of text.split(/\s+/).filter((token) => token.length >= 2)) {
    if (searchable.includes(token)) score += 1;
  }

  return score;
}

function selectCandidates(input: RecommendInput): Array<{ keyboard: Keyboard; index: number }> {
  return keyboards
    .map((keyboard, index) => ({ keyboard, index, score: scoreKeyboard(keyboard, input) }))
    .sort((a, b) => b.score - a.score || a.keyboard.price - b.keyboard.price)
    .slice(0, maxCandidates)
    .map(({ keyboard, index }) => ({ keyboard, index }));
}

function catalogToText(candidates: Array<{ keyboard: Keyboard; index: number }>): string {
  return candidates
    .map(({ keyboard, index }) => {
      const force = keyboard.key_force === '0g' ? '키압 미제공' : `키압 ${keyboard.key_force}`;
      return `[${index}] ${keyboard.product_name} | 브랜드:${keyboard.brand} | 가격:${keyboard.price}원 | 스위치:${keyboard.switch_type} | 연결:${keyboard.connection}(${keyboard.wireless_type}) | 배열:${keyboard.layout} | ${force} | 무게:${keyboard.weight_g}g | 각인:${keyboard.engraving} | 백라이트:${keyboard.backlight}`;
    })
    .join('\n');
}

function addTag(tags: string[], value: string | undefined) {
  const tag = value?.trim();
  if (tag && tag !== '정보없음' && tag !== '0g' && !tags.includes(tag)) {
    tags.push(tag);
  }
}

function buildTagsFromKeyboard(keyboard: Keyboard): string[] {
  const tags: string[] = [];

  addTag(tags, keyboard.switch_type);
  addTag(tags, keyboard.layout);
  addTag(tags, keyboard.connection);

  if (keyboard.wireless_type && !/유선|정보없음/.test(keyboard.wireless_type)) {
    for (const wireless of keyboard.wireless_type.split(/[,+/·]/)) {
      addTag(tags, wireless);
    }
  }

  if (keyboard.key_force && keyboard.key_force !== '0g') {
    addTag(tags, `${keyboard.key_force} 키압`);
  }

  if (keyboard.backlight && !/없음|정보없음/.test(keyboard.backlight)) {
    addTag(tags, keyboard.backlight);
  }

  if (keyboard.engraving && !/정보없음/.test(keyboard.engraving)) {
    addTag(tags, keyboard.engraving);
  }

  return tags.slice(0, 6);
}

function buildPrompt(input: RecommendInput, candidates: Array<{ keyboard: Keyboard; index: number }>) {
  return `당신은 한국어 키보드 추천 도우미 "keybuddy"입니다.

아래 catalog 후보 안에서만 사용자 조건에 맞는 키보드를 추천하세요.

규칙:
- catalog에 없는 상품을 만들지 마세요.
- 반드시 catalog index로만 상품을 선택하세요.
- 최대 ${maxRecommendations}개까지만 추천하세요.
- reason은 사용자 조건과 제품 특성이 왜 맞는지 한 문장 존댓말로 적으세요.
- 최종 응답은 JSON 객체 하나만 반환하세요.

반환 형식:
{
  "summary": "string",
  "recommendations": [
    { "index": 0, "reason": "string" }
  ]
}

<catalog>
${catalogToText(candidates)}
</catalog>

사용자 입력:
${JSON.stringify(input, null, 2)}
`;
}

function outputText(response: Record<string, unknown>): string {
  if (typeof response.output_text === 'string') {
    return response.output_text;
  }

  const output = Array.isArray(response.output) ? response.output : [];
  return output
    .flatMap((item) => (isRecord(item) && Array.isArray(item.content) ? item.content : []))
    .map((content) => {
      if (!isRecord(content)) return '';
      if (typeof content.text === 'string') return content.text;
      return '';
    })
    .join('\n');
}

function parseResult(text: string): RawLLMResult {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('LLM 응답에서 JSON을 찾지 못했습니다.');
  }

  const parsed = JSON.parse(text.slice(start, end + 1)) as Partial<RawLLMResult>;
  if (typeof parsed.summary !== 'string' || !Array.isArray(parsed.recommendations)) {
    throw new Error('LLM 응답 형식이 올바르지 않습니다.');
  }

  return {
    summary: parsed.summary,
    recommendations: parsed.recommendations
      .filter((item): item is RawRecommendation => {
        return (
          isRecord(item) &&
          Number.isInteger(item.index) &&
          typeof item.reason === 'string'
        );
      })
      .slice(0, maxRecommendations)
      .map((item) => ({
        index: item.index,
        reason: item.reason,
      })),
  };
}

async function openaiErrorMessage(response: Response): Promise<string> {
  const fallback = `OpenAI 요청에 실패했습니다. (HTTP ${response.status})`;
  const body = await response.json().catch(() => null);
  if (isRecord(body) && isRecord(body.error) && typeof body.error.message === 'string') {
    return body.error.message;
  }
  return fallback;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const rateLimit = checkRateLimit(request);
    if (!rateLimit.ok) {
      return Response.json(
        { error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' },
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'Retry-After': String(rateLimit.retryAfterSeconds),
          },
        },
      );
    }

    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY secret이 설정되지 않았습니다.');
    }

    const input = parseInput(await request.json());
    const candidates = selectCandidates(input);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), openaiTimeoutMs);
    let openaiResponse: Response;
    try {
      openaiResponse = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          max_output_tokens: 900,
          input: buildPrompt(input, candidates),
        }),
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('OpenAI 응답 시간이 길어 요청을 중단했습니다. 잠시 후 다시 시도해 주세요.');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    if (!openaiResponse.ok) {
      throw new Error(await openaiErrorMessage(openaiResponse));
    }

    const raw = parseResult(outputText(await openaiResponse.json()));
    const recommendations = raw.recommendations
      .filter((item) => keyboards[item.index] !== undefined)
      .map((item) => ({
        ...keyboards[item.index],
        reason: item.reason,
        tags: buildTagsFromKeyboard(keyboards[item.index]),
      }));

    return Response.json(
      { summary: raw.summary, recommendations },
      { headers: corsHeaders },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '추천 생성에 실패했습니다.';
    return Response.json({ error: message }, { status: 500, headers: corsHeaders });
  }
});
