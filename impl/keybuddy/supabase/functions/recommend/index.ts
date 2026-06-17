import catalog from './keyboards.json' with { type: 'json' };
import { formatCatalogEntry } from './catalogText.ts';
import { appVersion } from './version.ts';

interface Keyboard {
  product_name: string;
  brand: string;
  price: number;
  image_url: string;
  switch_type: string;
  connection: string;
  layout: string;
  key_force: string;
  weight_g: number | null;
  wireless_type: string;
  engraving: string;
  backlight: string;
  raw_switch_name?: string | null;
  switch_name?: string | null;
  switch_manufacturer?: string | null;
  product_code?: string | null;
  media_url?: string | null;
  price_compare_url?: string | null;
  media_url_is_placeholder?: boolean;
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

interface RecommendationResult extends Keyboard {
  reason: string;
  tags: string[];
  is_fallback: boolean;
  source: 'llm' | 'fallback';
}

interface Candidate {
  keyboard: Keyboard;
  index: number;
  score: number;
}

const keyboards = catalog as Keyboard[];
const maxCandidates = 40;
const maxRecommendations = 30;
const maxOutputTokens = maxRecommendations * 120 + 500;
const openaiTimeoutMs = 40000;
const rateLimitWindowMs = 60000;
const postRateLimitMaxRequests = 10;
const getRateLimitMaxRequests = 60;
const model = Deno.env.get('OPENAI_MODEL') ?? 'gpt-5.4';
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();
let lastRateLimitSweepAt = 0;
const invisibleTraitValues = new Set(['정보없음', '0g']);

if (maxCandidates < maxRecommendations) {
  throw new Error('maxCandidates must be greater than or equal to maxRecommendations.');
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function exposeHeaders(...headers: string[]): string {
  return [
    ...new Set(
      headers
        .flatMap((header) => header.split(','))
        .map((header) => header.trim())
        .filter(Boolean),
    ),
  ].join(', ');
}

const versionHeaders = {
  ...corsHeaders,
  'Access-Control-Expose-Headers': exposeHeaders('X-Keybuddy-Version'),
  'X-Keybuddy-Version': appVersion,
};

function retryAfterHeaders(retryAfterSeconds: number) {
  return {
    ...versionHeaders,
    'Access-Control-Expose-Headers': exposeHeaders(
      'Retry-After',
      versionHeaders['Access-Control-Expose-Headers'],
    ),
    'Retry-After': String(retryAfterSeconds),
  };
}

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

function sweepExpiredRateLimitBuckets(now: number) {
  if (rateLimitBuckets.size === 0) {
    return;
  }

  if (now - lastRateLimitSweepAt < rateLimitWindowMs) {
    return;
  }

  lastRateLimitSweepAt = now;
  for (const [key, bucket] of rateLimitBuckets) {
    if (bucket.resetAt <= now) {
      rateLimitBuckets.delete(key);
    }
  }
}

function checkRateLimit(
  request: Request,
  kind: 'get' | 'post',
): { ok: true } | { ok: false; retryAfterSeconds: number } {
  const now = Date.now();
  sweepExpiredRateLimitBuckets(now);

  // Best-effort per-isolate guard. Distributed rate limiting needs shared storage.
  // GET is a cheap version/health endpoint, so it has a separate relaxed bucket.
  // POST still has its own lower limit because it can trigger an OpenAI request.
  const bucketKey = `${kind}:${clientIp(request)}`;
  const maxRequests = kind === 'get' ? getRateLimitMaxRequests : postRateLimitMaxRequests;
  const current = rateLimitBuckets.get(bucketKey);

  if (!current || current.resetAt <= now) {
    rateLimitBuckets.set(bucketKey, { count: 1, resetAt: now + rateLimitWindowMs });
    return { ok: true };
  }

  if (current.count >= maxRequests) {
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

function guidedAnswer(input: RecommendInput, question: string): string {
  return input.mode === 'guided' ? input.answers[question] ?? '' : '';
}

function normalizedKeyboardText(keyboard: Keyboard): string {
  return [
    keyboard.product_name,
    keyboard.brand,
    keyboard.switch_type,
    keyboard.connection,
    keyboard.wireless_type,
    keyboard.layout,
    keyboard.engraving,
    keyboard.backlight,
    keyboard.raw_switch_name ?? '',
    keyboard.switch_name ?? '',
  ].join(' ');
}

function parseKeyForce(force: string): number | null {
  const match = force.match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

function hasWiredSupport(keyboard: Keyboard): boolean {
  return /유선/.test(keyboard.connection) || /유선/.test(keyboard.wireless_type);
}

function hasWirelessSupport(keyboard: Keyboard): boolean {
  return /무선|블루투스|동글|리시버|2\.4GHz/i.test(`${keyboard.connection} ${keyboard.wireless_type}`);
}

function matchesGuidedConnection(keyboard: Keyboard, answer: string): boolean {
  const wirelessText = `${keyboard.connection} ${keyboard.wireless_type}`;
  if (/^유선$/.test(answer)) return hasWiredSupport(keyboard);
  if (/무선 USB 동글/.test(answer)) return /동글|리시버|2\.4GHz/i.test(wirelessText);
  if (/블루투스/.test(answer)) return /블루투스/.test(wirelessText);
  if (/유\/무선 모두/.test(answer)) return hasWiredSupport(keyboard) && hasWirelessSupport(keyboard);
  return true;
}

function matchesGuidedLayout(keyboard: Keyboard, answer: string): boolean {
  const text = normalizedKeyboardText(keyboard);
  if (/풀배열/.test(answer)) return /풀배열|104키|108키/.test(text);
  if (/1800/.test(answer)) return /1800|96키|98키|99키|100키/.test(text);
  if (/텐키리스/.test(answer)) return /텐키리스|87키|TKL/i.test(text);
  if (/75%/.test(answer)) return /75%|75배열|84키/.test(text);
  if (/65%/.test(answer)) return /65%|65배열|68키/.test(text);
  if (/60%/.test(answer)) return /미니|60%|60배열|61키/.test(text);
  return true;
}

function matchesGuidedSound(keyboard: Keyboard, answer: string): boolean {
  const text = normalizedKeyboardText(keyboard);
  if (/매우 낮음|낮음/.test(answer)) {
    return /무접점|펜타그래프|저소음|멤브레인/.test(text) && !/청축/.test(text);
  }
  if (/시끄러워도 됨|조금 큼/.test(answer)) {
    return /기계식|광축|자석축|청축|갈축|적축/.test(text);
  }
  return true;
}

function matchesGuidedKeyFeel(keyboard: Keyboard, answer: string): boolean {
  const text = normalizedKeyboardText(keyboard);
  if (/또각또각|서걱서걱/.test(answer)) return /기계식/.test(text);
  if (/보글보글/.test(answer)) return /무접점/.test(text);
  return true;
}

function matchesGuidedKeyForce(keyboard: Keyboard, answer: string): boolean {
  const force = parseKeyForce(keyboard.key_force);
  if (/35~45g/.test(answer)) return force !== null && force >= 35 && force <= 45;
  if (/45~55g/.test(answer)) return force !== null && force >= 45 && force <= 55;
  if (/60g 이상/.test(answer)) return force !== null && force >= 60;
  return true;
}

function matchesGuidedEngraving(keyboard: Keyboard, answer: string): boolean {
  const engraving = keyboard.engraving;
  if (/한국어, 영어/.test(answer)) return /한\/영|한영|한국어.*영어|영어.*한국어/.test(engraving);
  if (/영어만/.test(answer)) return /영문/.test(engraving) && !/한\/영|한영/.test(engraving);
  if (/한국어만/.test(answer)) return /한글|한국어/.test(engraving) && !/영문|영어|한\/영|한영/.test(engraving);
  return true;
}

function matchesGuidedBacklight(keyboard: Keyboard, answer: string): boolean {
  const backlight = keyboard.backlight;
  if (/RGB/.test(answer)) return /RGB/.test(backlight);
  if (/단색/.test(answer)) return /단색/.test(backlight);
  if (/없어도/.test(answer)) return /없음|정보없음/.test(backlight);
  return true;
}

function matchesGuidedSelections(keyboard: Keyboard, input: RecommendInput): boolean {
  if (input.mode !== 'guided') {
    return true;
  }

  const budget = budgetRange(input);
  if (budget && (keyboard.price < budget.min || keyboard.price > budget.max)) {
    return false;
  }

  return (
    matchesGuidedConnection(keyboard, guidedAnswer(input, '연결방식')) &&
    matchesGuidedLayout(keyboard, guidedAnswer(input, '크기')) &&
    matchesGuidedSound(keyboard, guidedAnswer(input, '소리')) &&
    matchesGuidedKeyFeel(keyboard, guidedAnswer(input, '키감')) &&
    matchesGuidedKeyForce(keyboard, guidedAnswer(input, '키압')) &&
    matchesGuidedEngraving(keyboard, guidedAnswer(input, '각인')) &&
    matchesGuidedBacklight(keyboard, guidedAnswer(input, '백라이트'))
  );
}

function scoreKeyboard(keyboard: Keyboard, input: RecommendInput): number {
  const text = normalizedInputText(input);
  const searchable = normalizedKeyboardText(keyboard);

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

  const layoutAnswer = guidedAnswer(input, '크기');
  if (layoutAnswer) {
    if (/풀배열|1800/.test(layoutAnswer)) {
      if (/풀배열|104키|108키|96키|98키|100키/.test(searchable)) score += 2;
    } else if (/텐키리스|75%|65%|60%|미니|F열/.test(layoutAnswer)) {
      if (/텐키리스|미니|87키|84키|75%|68키|65%|61키|60%/.test(searchable)) score += 4;
    }
  } else {
    if (/텐키리스|숫자\s*패드\s*없|작|미니|휴대/.test(text)) {
      if (/텐키리스|미니|87키|84키|68키|61키/.test(searchable)) score += 4;
    }

    if (/풀배열|숫자\s*패드|사무/.test(text)) {
      if (/풀배열|104키|108키/.test(searchable)) score += 2;
    }
  }

  for (const token of text.split(/\s+/).filter((token) => token.length >= 2)) {
    if (searchable.includes(token)) score += 1;
  }

  return score;
}

function selectCandidates(input: RecommendInput): Candidate[] {
  return keyboards
    .map((keyboard, index) => ({ keyboard, index, score: scoreKeyboard(keyboard, input) }))
    .filter(({ keyboard }) => matchesGuidedSelections(keyboard, input))
    .sort((a, b) => b.score - a.score || a.keyboard.price - b.keyboard.price)
    .slice(0, maxCandidates);
}

function catalogToText(candidates: Candidate[]): string {
  return candidates
    .map(({ keyboard, index }) => formatCatalogEntry(keyboard, index))
    .join('\n');
}

function visibleTrait(value: string | undefined): string | null {
  const tag = value?.trim();
  return tag && !invisibleTraitValues.has(tag) ? tag : null;
}

function addTag(tags: string[], value: string | undefined) {
  const tag = visibleTrait(value);
  if (tag && !tags.includes(tag)) {
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

function fallbackReason(
  keyboard: Keyboard,
  score?: number,
  options: { preferTraits?: boolean } = {},
): string {
  if (!options.preferTraits && typeof score === 'number' && score === 0) {
    return '조건이 넓어 함께 비교할 후보로 보여드려요.';
  }

  const traits = [keyboard.switch_type, keyboard.layout, keyboard.connection]
    .flatMap((value) => {
      const trait = visibleTrait(value);
      return trait ? [trait] : [];
    })
    .join('·');

  if (traits) {
    return `${traits} 구성을 갖춘 후보라 함께 비교해볼 만해요.`;
  }

  return '조건에 가까운 후보라 함께 비교해볼 만해요.';
}

function toRecommendation(
  keyboard: Keyboard,
  reason: string,
  source: RecommendationResult['source'],
): RecommendationResult {
  return {
    ...keyboard,
    reason,
    tags: buildTagsFromKeyboard(keyboard),
    is_fallback: source === 'fallback',
    source,
  };
}

function composeRecommendations(
  raw: RawLLMResult,
  candidates: Candidate[],
): RecommendationResult[] {
  const candidateByIndex = new Map(candidates.map((candidate) => [candidate.index, candidate]));
  const recommendations: RecommendationResult[] = [];

  for (const item of raw.recommendations) {
    const candidate = candidateByIndex.get(item.index);
    if (!candidate) {
      continue;
    }

    candidateByIndex.delete(item.index);
    const reason = item.reason.trim();
    const source: RecommendationResult['source'] = reason ? 'llm' : 'fallback';
    if (!reason) {
      console.warn('recommend: empty LLM reason replaced with fallback.', { index: item.index });
    }
    recommendations.push(
      toRecommendation(
        candidate.keyboard,
        reason || fallbackReason(candidate.keyboard, candidate.score, { preferTraits: true }),
        source,
      ),
    );
    if (recommendations.length >= maxRecommendations) {
      return recommendations;
    }
  }

  for (const candidate of candidateByIndex.values()) {
    // Zero-score candidates are still useful as broad comparison fillers;
    // fallbackReason labels them separately from matched candidates.
    if (candidate.score < 0) {
      console.warn('recommend: negative-score candidate excluded from fallback.', {
        index: candidate.index,
        score: candidate.score,
      });
      continue;
    }

    recommendations.push(
      toRecommendation(candidate.keyboard, fallbackReason(candidate.keyboard, candidate.score), 'fallback'),
    );
    if (recommendations.length >= maxRecommendations) {
      break;
    }
  }

  return recommendations;
}

const noMatchSummaryPattern =
  /(만족|일치|맞는|해당|조건|상품|제품|후보).{0,40}(없|찾지 못|못 찾)|(?:없|찾지 못|못 찾).{0,40}(상품|제품|후보|조건)/;

function summarySaysNoMatches(summary: string): boolean {
  return noMatchSummaryPattern.test(summary);
}

function responseSummary(rawSummary: string, recommendations: RecommendationResult[]): string {
  const summary = rawSummary.trim();

  if (recommendations.length === 0) {
    return summary || '해당 조건에 맞는 제품이 없습니다.';
  }

  if (summary && !summarySaysNoMatches(summary)) {
    return summary;
  }

  if (recommendations.every((item) => item.is_fallback)) {
    return '입력하신 모든 조건을 동시에 만족하는 상품은 catalog에 없어, 조건에 가까운 후보를 우선 보여드려요.';
  }

  return '입력하신 조건에 가까운 추천 후보를 찾았어요. 일부 조건은 상품별로 다를 수 있어 세부 사양을 함께 확인해 주세요.';
}

function buildPrompt(input: RecommendInput, candidates: Candidate[]) {
  return `당신은 한국어 키보드 추천 도우미 "keybuddy"입니다.

아래 catalog 후보 안에서만 사용자 조건에 맞는 키보드를 추천하세요.

규칙:
- catalog에 없는 상품을 만들지 마세요.
- 반드시 catalog index로만 상품을 선택하세요.
- 사용자 조건에 맞는 상품만 추천하되, 관련 후보가 충분하면 ${maxRecommendations}개에 가깝게 추천하고 최대 ${maxRecommendations}개를 넘기지 마세요.
- recommendations를 1개 이상 반환한다면 summary에서 상품이 없다고만 말하지 말고, 완전 일치 여부와 근접 후보 성격을 함께 설명하세요.
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
      .slice(0, maxRecommendations)
      .filter((item): item is RawRecommendation => {
        return (
          isRecord(item) &&
          Number.isInteger(item.index) &&
          typeof item.reason === 'string'
        );
      })
      .map((item) => ({
        index: item.index,
        reason: item.reason,
      })),
  };
}

function parseOpenAIResponse(text: string): Record<string, unknown> {
  try {
    const body = JSON.parse(text) as unknown;
    if (isRecord(body)) {
      return body;
    }
  } catch {
    // Fall through to a clearer domain error.
  }
  throw new Error('OpenAI 응답 JSON 형식이 올바르지 않습니다.');
}

function openaiErrorMessage(status: number, text: string): string {
  const fallback = `OpenAI 요청에 실패했습니다. (HTTP ${status})`;
  let body: unknown;
  try {
    body = JSON.parse(text) as unknown;
  } catch {
    return fallback;
  }
  if (isRecord(body) && isRecord(body.error) && typeof body.error.message === 'string') {
    return body.error.message;
  }
  return fallback;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method === 'GET') {
    const rateLimit = checkRateLimit(request, 'get');
    if (!rateLimit.ok) {
      return Response.json(
        { error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' },
        {
          status: 429,
          headers: retryAfterHeaders(rateLimit.retryAfterSeconds),
        },
      );
    }

    return Response.json(
      { name: 'recommend', version: appVersion },
      { headers: versionHeaders },
    );
  }

  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const rateLimit = checkRateLimit(request, 'post');
    if (!rateLimit.ok) {
      return Response.json(
        { error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' },
        {
          status: 429,
          headers: retryAfterHeaders(rateLimit.retryAfterSeconds),
        },
      );
    }

    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY secret이 설정되지 않았습니다.');
    }

    const input = parseInput(await request.json());
    const candidates = selectCandidates(input);
    if (input.mode === 'guided' && candidates.length === 0) {
      return Response.json(
        {
          summary: '선택하신 조건을 모두 만족하는 상품이 catalog에 없습니다.',
          recommendations: [],
          meta: { version: appVersion },
        },
        { headers: versionHeaders },
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), openaiTimeoutMs);
    let openaiResponse: Response;
    let openaiBodyText = '';
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
          max_output_tokens: maxOutputTokens,
          input: buildPrompt(input, candidates),
        }),
      });
      openaiBodyText = await openaiResponse.text();
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('OpenAI 응답 시간이 길어 요청을 중단했습니다. 잠시 후 다시 시도해 주세요.');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    if (!openaiResponse.ok) {
      throw new Error(openaiErrorMessage(openaiResponse.status, openaiBodyText));
    }

    const raw = parseResult(outputText(parseOpenAIResponse(openaiBodyText)));
    const recommendations = composeRecommendations(raw, candidates);

    return Response.json(
      {
        summary: responseSummary(raw.summary, recommendations),
        recommendations,
        meta: { version: appVersion },
      },
      { headers: versionHeaders },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '추천 생성에 실패했습니다.';
    return Response.json(
      {
        error: message,
        meta: { version: appVersion },
      },
      { status: 500, headers: versionHeaders },
    );
  }
});
