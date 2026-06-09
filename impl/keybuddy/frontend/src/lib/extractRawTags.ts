/**
 * extractRawTags: 자유형 자연어 -> 원시 태그 추출
 *
 * LLM(Anthropic Claude)을 호출하여 자연어 입력에서
 * hardConstraints + softIntentTags 구조의 ExtractedTags를 반환한다.
 *
 * 반환된 객체는 tagSchema 검증을 거쳐 스키마 밖 값은 폐기된다.
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  HARD_CONSTRAINT_ENUMS,
  HARD_NUMERIC_KEYS,
  SOFT_INTENT_VOCAB,
  isSoftIntentTag,
  isHardConstraintKey,
  isValidHardEnumValue,
  validateTagSchema,
  type HardEnumKey,
  type HardConstraintKey,
  type SoftIntentTag,
} from './tagSchema';
import { INTENT_VOCABULARY, isIntentTag } from './intentProfile';

// ---------------------------------------------------------------------------
// 타입 정의
// ---------------------------------------------------------------------------

export interface HardConstraints {
  price_max?: number;
  price_min?: number;
  weight_max_g?: number;
  connection?: (typeof HARD_CONSTRAINT_ENUMS)['connection'][number];
  layout?: (typeof HARD_CONSTRAINT_ENUMS)['layout'][number];
  switch_type?: (typeof HARD_CONSTRAINT_ENUMS)['switch_type'][number];
  wireless_type?: (typeof HARD_CONSTRAINT_ENUMS)['wireless_type'][number];
  engraving?: (typeof HARD_CONSTRAINT_ENUMS)['engraving'][number];
  backlight?: (typeof HARD_CONSTRAINT_ENUMS)['backlight'][number];
}

export interface ExtractedTags {
  hardConstraints: HardConstraints;
  softIntentTags: SoftIntentTag[];
}

// ---------------------------------------------------------------------------
// LLM 프롬프트 구성
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `당신은 키보드 추천 시스템의 태그 추출기입니다.
사용자의 자연어 입력에서 키보드 검색에 필요한 하드 제약과 소프트 의도 태그를 추출하세요.

응답은 반드시 아래 JSON 스키마를 따르세요:

{
  "hardConstraints": {
    // 숫자 필드 (해당 없으면 생략):
    // "price_max": <number>,   // 최대 가격(원)
    // "price_min": <number>,   // 최소 가격(원)
    // "weight_max_g": <number>, // 최대 무게(g)
    //
    // 열거형 필드 (해당 없으면 생략):
    // "connection": "유선" | "무선" | "유선+무선",
    // "layout": "풀배열" | "텐키리스" | "미니" | "98키" | "99키" | "96키",
    // "switch_type": "기계식" | "펜타그래프" | "무접점 자석축" | "무접점 광축" | "멤브레인" | "무접점",
    // "wireless_type": "전용동글(리시버)" | "블루투스" | "전용동글(리시버), 블루투스" | "블루투스, 전용동글(리시버)" | "유선",
    // "engraving": "한/영 정각" | "영문 정각" | "레이저각인 키캡" | "정보없음",
    // "backlight": "RGB 백라이트" | "레인보우 백라이트" | "단색 백라이트" | "없음"
  },
  "softIntentTags": [
    // 아래 어휘 목록에서만 선택 (복수 가능):
    // "조용함", "저소음", "고소음", "경쾌함",
    // "사무용", "게이밍", "휴대성", "가벼움", "무거움",
    // "타건감", "RGB", "백라이트", "백라이트없음",
    // "무선", "멀티페어링", "가성비", "기계식", "무접점",
    // "펜타그래프", "한영각인", "영문각인", "풀배열", "텍키리스", "미니"
  ]
}

규칙:
- hardConstraints에는 사용자가 명시적으로 요구한 조건만 포함합니다 (없으면 빈 객체 {})
- softIntentTags는 사용자의 의도를 나타내는 태그 목록으로, 위 어휘 목록에 있는 값만 사용합니다
- 스키마에 정의되지 않은 키나 값은 포함하지 않습니다
- 반드시 유효한 JSON만 반환합니다 (코드 블록 없이)`;

function buildUserMessage(naturalLanguageInput: string): string {
  return `사용자 입력: "${naturalLanguageInput}"`;
}

// ---------------------------------------------------------------------------
// LLM 클라이언트 팩토리 (테스트에서 주입 가능)
// ---------------------------------------------------------------------------

export type AnthropicClient = Pick<Anthropic, 'messages'>;

let _clientOverride: AnthropicClient | null = null;

/** 테스트에서 모킹 클라이언트를 주입할 때 사용 */
export function _setClientForTest(client: AnthropicClient | null): void {
  _clientOverride = client;
}

function getClient(): AnthropicClient {
  if (_clientOverride !== null) return _clientOverride;
  const apiKey = typeof import.meta !== 'undefined' ? (import.meta.env?.VITE_ANTHROPIC_API_KEY ?? '') : '';
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC API 키가 없습니다. VITE_ANTHROPIC_API_KEY 환경변수를 설정하세요.',
    );
  }
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

// ---------------------------------------------------------------------------
// 응답 파싱 및 스키마 정제
// ---------------------------------------------------------------------------

interface RawLLMResponse {
  hardConstraints?: Record<string, unknown>;
  softIntentTags?: unknown[];
}

function sanitizeHardConstraints(raw: Record<string, unknown>): HardConstraints {
  const result: HardConstraints = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!isHardConstraintKey(key)) continue;

    if ((HARD_NUMERIC_KEYS as readonly string[]).includes(key)) {
      if (typeof value === 'number') {
        (result as Record<string, unknown>)[key] = value;
      }
    } else {
      if (typeof value === 'string' && isValidHardEnumValue(key as HardEnumKey, value)) {
        (result as Record<string, unknown>)[key] = value;
      }
    }
  }
  return result;
}

function sanitizeSoftIntentTags(raw: unknown[]): SoftIntentTag[] {
  return raw.filter((t): t is SoftIntentTag => typeof t === 'string' && isSoftIntentTag(t));
}

/**
 * LLM 응답 텍스트에서 JSON 객체 문자열을 추출한다.
 * 코드펜스(```json ... ```)나 앞뒤 설명이 섞여 와도 첫 '{' ~ 마지막 '}' 구간을 사용한다.
 */
function extractJsonObject(text: string): string | null {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const body = fence ? fence[1] : trimmed;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return null;
  return body.slice(start, end + 1);
}

function parseAndSanitize(text: string): ExtractedTags {
  const jsonStr = extractJsonObject(text);
  if (jsonStr === null) {
    return { hardConstraints: {}, softIntentTags: [] };
  }
  let parsed: RawLLMResponse;
  try {
    parsed = JSON.parse(jsonStr) as RawLLMResponse;
  } catch {
    return { hardConstraints: {}, softIntentTags: [] };
  }

  const hardConstraints =
    parsed.hardConstraints && typeof parsed.hardConstraints === 'object'
      ? sanitizeHardConstraints(parsed.hardConstraints)
      : {};

  const softIntentTags = Array.isArray(parsed.softIntentTags)
    ? sanitizeSoftIntentTags(parsed.softIntentTags)
    : [];

  return { hardConstraints, softIntentTags };
}

// ---------------------------------------------------------------------------
// 공개 API
// ---------------------------------------------------------------------------

const MODEL = 'claude-sonnet-4-6';

/**
 * 자유형 자연어 문자열을 입력받아 LLM을 호출하고
 * 하드 제약 + 소프트 의도 태그를 포함하는 ExtractedTags를 반환한다.
 *
 * 검색/스코어링 경로에는 사용하지 않는다 - 입력 정규화 단계에서만 호출.
 */
export async function extractRawTags(naturalLanguageInput: string): Promise<ExtractedTags> {
  const client = getClient();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserMessage(naturalLanguageInput) }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    return { hardConstraints: {}, softIntentTags: [] };
  }

  if (import.meta.env?.DEV) {
    console.debug('[keybuddy] LLM 추출 원문:', textBlock.text);
  }
  return parseAndSanitize(textBlock.text);
}

/**
 * extractRawTags의 출력(또는 임의의 unknown 객체)을 받아
 * 스키마에 정의되지 않은 키와 허용되지 않는 열거형 값을 제거하고
 * 정제된 ExtractedTags를 반환한다.
 *
 * - 최상위에 hardConstraints / softIntentTags 외 키는 무시
 * - hardConstraints 중 HARD_CONSTRAINT_KEYS 밖 키 제거
 * - 열거형 키에 HARD_CONSTRAINT_ENUMS 밖 값이 오면 해당 키 제거
 * - 숫자 키에 number 타입이 아닌 값이 오면 해당 키 제거
 * - softIntentTags 항목 중 SOFT_INTENT_VOCAB 밖 값 제거
 */
export function sanitizeTags(raw: unknown): ExtractedTags {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { hardConstraints: {}, softIntentTags: [] };
  }

  const record = raw as Record<string, unknown>;

  const hardConstraints =
    typeof record['hardConstraints'] === 'object' &&
    record['hardConstraints'] !== null &&
    !Array.isArray(record['hardConstraints'])
      ? sanitizeHardConstraints(record['hardConstraints'] as Record<string, unknown>)
      : {};

  const softIntentTags = Array.isArray(record['softIntentTags'])
    ? sanitizeSoftIntentTags(record['softIntentTags'])
    : [];

  return { hardConstraints, softIntentTags };
}

/**
 * extractRawTags -> sanitizeTags -> validateTagSchema 파이프라인을 순서대로 실행한다.
 *
 * 1. extractRawTags(input): LLM으로 자연어에서 원시 태그 추출
 * 2. sanitizeTags(raw): 스키마 밖 키/값 폐기 후 정제
 * 3. validateTagSchema(sanitized): 스키마 준수 여부 검증 - 실패 시 오류 throw
 *
 * 검색/스코어링/결과 생성 경로에서는 이 함수를 사용하지 않는다.
 * 입력 정규화(태그 추출) 단계에서만 호출한다.
 */
export async function extractAndValidateTags(input: string): Promise<ExtractedTags> {
  const raw = await extractRawTags(input);
  const sanitized = sanitizeTags(raw);
  const validationResult = validateTagSchema(sanitized);
  if (!validationResult.valid) {
    throw new Error(`태그 스키마 검증 실패: ${validationResult.errors.join(', ')}`);
  }
  return sanitized;
}

// ---------------------------------------------------------------------------
// 의도 + 명시 제약 분리 추출 (하네싱 1단계)
// ---------------------------------------------------------------------------

/** extractIntentInput 결과: 통제 의도 어휘 + 명시 제약 */
export interface IntentExtraction {
  /** INTENT_VOCABULARY 내 의도 태그 */
  intents: string[];
  /** 사용자가 명시한 하드 제약 */
  hardConstraints: HardConstraints;
  /** 사용자가 직접 언급한 소프트 속성 선호 */
  softIntentTags: SoftIntentTag[];
}

const INTENT_SYSTEM_PROMPT = `당신은 키보드 추천 시스템의 의도/제약 추출기입니다.
사용자의 자연어 입력에서 아래 3가지를 분리해 추출하세요.

1) intents: 사용자의 고수준 사용 목적(use-case). 아래 어휘에서만 선택(복수 가능, 없으면 []):
   [${INTENT_VOCABULARY.map((v) => `"${v}"`).join(', ')}]

2) hardConstraints: 사용자가 명시적으로 요구한 구체 제약(없으면 {}):
   숫자: "price_max","price_min","weight_max_g"
   열거형:
   - "connection": "유선" | "무선" | "유선+무선"
   - "layout": "풀배열" | "텐키리스" | "미니" | "98키" | "99키" | "96키"
   - "switch_type": "기계식" | "펜타그래프" | "무접점 자석축" | "무접점 광축" | "멤브레인" | "무접점"
   - "wireless_type": "전용동글(리시버)" | "블루투스" | "전용동글(리시버), 블루투스" | "블루투스, 전용동글(리시버)" | "유선"
   - "engraving": "한/영 정각" | "영문 정각" | "레이저각인 키캡" | "정보없음"
   - "backlight": "RGB 백라이트" | "레인보우 백라이트" | "단색 백라이트" | "없음"

3) softIntentTags: 사용자가 직접 언급한 구체 속성 선호. 아래 어휘에서만(없으면 []):
   [${(SOFT_INTENT_VOCAB as readonly string[]).map((v) => `"${v}"`).join(', ')}]

규칙:
- 사용 목적(사무/게임/휴대)은 intents로, 구체 속성 선호(RGB/무선/텐키리스 등)는 hardConstraints나 softIntentTags로 분리합니다.
- 어휘/스키마 밖 값은 포함하지 않습니다.
- 반드시 유효한 JSON만 반환합니다 (코드 블록 없이).

응답 형식: {"intents": [...], "hardConstraints": {...}, "softIntentTags": [...]}`;

interface RawIntentResponse {
  intents?: unknown[];
  hardConstraints?: Record<string, unknown>;
  softIntentTags?: unknown[];
}

function sanitizeIntents(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === 'string' && isIntentTag(x));
}

/** LLM 응답 텍스트를 IntentExtraction으로 파싱/정제한다(어휘 밖 값 폐기). */
export function parseIntentInput(text: string): IntentExtraction {
  const jsonStr = extractJsonObject(text);
  if (jsonStr === null) return { intents: [], hardConstraints: {}, softIntentTags: [] };
  let parsed: RawIntentResponse;
  try {
    parsed = JSON.parse(jsonStr) as RawIntentResponse;
  } catch {
    return { intents: [], hardConstraints: {}, softIntentTags: [] };
  }
  const hardConstraints =
    parsed.hardConstraints && typeof parsed.hardConstraints === 'object'
      ? sanitizeHardConstraints(parsed.hardConstraints)
      : {};
  const softIntentTags = Array.isArray(parsed.softIntentTags)
    ? sanitizeSoftIntentTags(parsed.softIntentTags)
    : [];
  return { intents: sanitizeIntents(parsed.intents), hardConstraints, softIntentTags };
}

/**
 * 자유형 자연어를 LLM으로 {의도 어휘, 명시 하드 제약, 명시 소프트 태그}로 분리 추출한다.
 * 어휘/스키마 밖 값은 폐기된다. 입력 정규화 단계에서만 호출(검색 경로 미사용).
 */
export async function extractIntentInput(naturalLanguageInput: string): Promise<IntentExtraction> {
  const client = getClient();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: INTENT_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserMessage(naturalLanguageInput) }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    return { intents: [], hardConstraints: {}, softIntentTags: [] };
  }

  if (import.meta.env?.DEV) {
    console.debug('[keybuddy] 의도/제약 추출 원문:', textBlock.text);
  }
  return parseIntentInput(textBlock.text);
}

// 내부 유틸 (테스트 접근용)
export { SOFT_INTENT_VOCAB, parseAndSanitize };
