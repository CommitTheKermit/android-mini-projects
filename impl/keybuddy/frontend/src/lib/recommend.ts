import Anthropic from '@anthropic-ai/sdk';
import rawCatalog from '../data/keyboards.json';
import type { Keyboard, RecommendInput, RecommendResult } from '../types';

const catalog = rawCatalog as Keyboard[];

const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
// 모델은 환경변수로 바꿀 수 있음(기본: Sonnet 4.6). 더 높은 품질이 필요하면 claude-opus-4-8 등으로 지정.
const model = import.meta.env.VITE_ANTHROPIC_MODEL ?? 'claude-sonnet-4-6';

// 브라우저에서 직접 호출(개인/로컬 용도). 공개 배포 시에는 프록시로 전환 필요.
const client = apiKey ? new Anthropic({ apiKey, dangerouslyAllowBrowser: true }) : null;

// 카탈로그를 인덱스가 붙은 텍스트로 직렬화(LLM은 인덱스만 반환 -> 가격 등 환각 방지)
function catalogToText(): string {
  return catalog
    .map((k, i) => {
      const force = k.key_force === '0g' ? '키압 미제공' : `키압 ${k.key_force}`;
      return `[${i}] ${k.product_name} | 브랜드:${k.brand} | 가격:${k.price}원 | 스위치:${k.switch_type} | 연결:${k.connection}(${k.wireless_type}) | 배열:${k.layout} | ${force} | 무게:${k.weight_g}g | 각인:${k.engraving} | 백라이트:${k.backlight}`;
    })
    .join('\n');
}

const SYSTEM_INSTRUCTIONS = `당신은 한국어 키보드 추천 도우미 "keybuddy"입니다.
아래 <catalog>에 있는 키보드 목록만을 후보로 사용해 사용자에게 가장 잘 맞는 제품을 추천합니다.

규칙:
- 반드시 <catalog>의 인덱스 번호로만 제품을 지목합니다. 목록에 없는 제품은 만들지 않습니다.
- 사용자의 조건에 가까운 순서대로 점수를 매겨 상위 제품을 추천합니다(부분 일치 허용). 완벽히 맞는 제품이 없어도 가장 가까운 제품을 제시합니다.
- 최대 12개까지, 적합도 높은 순으로 추천합니다. 조건이 까다로우면 적게 추천해도 됩니다.
- 데이터에 직접 없는 항목(예: 타건 "소리")은 스위치 종류로 합리적으로 추론합니다. (예: 무접점/펜타그래프=조용, 청축 계열 기계식=시끄러움)
- 각 추천의 reason은 "이 사용자에게 왜 맞는지"를 한 문장(존댓말)으로 적습니다.
- tags는 제품의 핵심 특징을 2~4개의 짧은 한국어 단어로 적습니다(예: "무선", "조용함", "텐키리스").
- summary는 추천 결과 전체를 1~2문장으로 요약합니다.`;

// 구조화 출력 스키마: 인덱스 + 사유 + 태그
const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    recommendations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          index: { type: 'integer' },
          reason: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
        },
        required: ['index', 'reason', 'tags'],
        additionalProperties: false,
      },
    },
  },
  required: ['summary', 'recommendations'],
  additionalProperties: false,
} as const;

function buildUserMessage(input: RecommendInput): string {
  if (input.mode === 'freeform') {
    return `사용자가 자유롭게 작성한 요청입니다. 의도를 해석해 추천하세요.\n\n"${input.query}"`;
  }
  const lines = Object.entries(input.answers)
    .filter(([, v]) => v && v !== '상관없음' && v !== '잘 모르겠어요')
    .map(([k, v]) => `- ${k}: ${v}`);
  const budgetMax =
    input.budget.max >= 1000000 ? '상한 없음' : `${input.budget.max.toLocaleString()}원`;
  lines.push(`- 예산: ${input.budget.min.toLocaleString()}원 ~ ${budgetMax}`);
  return `사용자가 단계별 질문에 답한 결과입니다. 이 조건에 맞춰 추천하세요.\n\n${lines.join('\n')}`;
}

interface RawLLMResult {
  summary: string;
  recommendations: { index: number; reason: string; tags: string[] }[];
}

export async function recommend(input: RecommendInput): Promise<RecommendResult> {
  if (!client) {
    throw new Error(
      'ANTHROPIC API 키가 설정되지 않았습니다. keybuddy/frontend/.env.local 에 VITE_ANTHROPIC_API_KEY 를 추가한 뒤 dev 서버를 다시 시작하세요.',
    );
  }

  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    thinking: { type: 'disabled' },
    system: [
      { type: 'text', text: SYSTEM_INSTRUCTIONS },
      // 카탈로그는 매 호출 동일 -> 프롬프트 캐싱으로 비용 절감
      {
        type: 'text',
        text: `<catalog>\n${catalogToText()}\n</catalog>`,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: buildUserMessage(input) }],
    // output_config는 이 SDK 버전 타입에 아직 없어 캐스팅으로 전달(런타임에선 body로 그대로 전송됨)
    output_config: { format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
  } as Anthropic.MessageCreateParamsNonStreaming);

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('추천 결과를 받지 못했습니다.');
  }

  const parsed = JSON.parse(textBlock.text) as RawLLMResult;

  // 인덱스를 실제 카탈로그 레코드로 매핑(유효 인덱스만)
  const recommendations = parsed.recommendations
    .filter((r) => catalog[r.index] !== undefined)
    .map((r) => ({
      ...catalog[r.index],
      reason: r.reason,
      tags: r.tags,
    }));

  return { summary: parsed.summary, recommendations };
}
