/**
 * 태그추출 통제 어휘 - Edge Function 사본.
 *
 * 클라이언트 `frontend/src/lib/tagSchema.ts`(SOFT_INTENT_VOCAB / HARD enum)와
 * `frontend/src/lib/intentProfile.ts`(INTENT_VOCABULARY)의 값을 그대로 복제한 것이다.
 * 카탈로그 사본과 동일하게 수동 동기화한다 - 원본 어휘가 바뀌면 이 파일도 함께 고칠 것.
 *
 * 용도: 자연어 → {intents, hardConstraints, softIntentTags} 추출 프롬프트에 어휘를 주입하고,
 * LLM 응답에서 어휘 밖 값을 서버에서 1차 정제하는 데 쓴다.
 */

/** 통제된 고수준 의도 어휘 (intentProfile.ts INTENT_VOCABULARY와 동일) */
export const INTENT_VOCABULARY = ['사무용', '게이밍', '휴대용'] as const;

/** 숫자 범위 하드 제약 키 */
export const HARD_NUMERIC_KEYS = ['price_max', 'price_min', 'weight_max_g'] as const;

/** 열거형 하드 제약 키 → 허용 값 집합 */
export const HARD_CONSTRAINT_ENUMS = {
  connection: ['유선', '무선', '유선+무선'],
  layout: ['풀배열', '텐키리스', '미니', '98키', '99키', '96키'],
  switch_type: ['기계식', '펜타그래프', '무접점 자석축', '무접점 광축', '멤브레인', '무접점'],
  wireless_type: [
    '전용동글(리시버)',
    '블루투스',
    '전용동글(리시버), 블루투스',
    '블루투스, 전용동글(리시버)',
    '유선',
  ],
  engraving: ['한/영 정각', '영문 정각', '레이저각인 키캡', '정보없음'],
  backlight: ['RGB 백라이트', '레인보우 백라이트', '단색 백라이트', '없음'],
} as const;

/** 소프트 의도 태그 어휘 (tagSchema.ts SOFT_INTENT_VOCAB와 동일) */
export const SOFT_INTENT_VOCAB = [
  '조용함',
  '저소음',
  '고소음',
  '경쾌함',
  '사무용',
  '게이밍',
  '휴대성',
  '가벼움',
  '무거움',
  '타건감',
  'RGB',
  '백라이트',
  '백라이트없음',
  '무선',
  '멀티페어링',
  '가성비',
  '기계식',
  '무접점',
  '펜타그래프',
  '한영각인',
  '영문각인',
  '풀배열',
  '텐키리스',
  '미니',
] as const;

export type IntentTag = (typeof INTENT_VOCABULARY)[number];
export type SoftIntentTag = (typeof SOFT_INTENT_VOCAB)[number];
export type HardEnumKey = keyof typeof HARD_CONSTRAINT_ENUMS;

/** 열거형 하드 제약 키 목록 */
export const HARD_ENUM_KEYS = Object.keys(HARD_CONSTRAINT_ENUMS) as HardEnumKey[];

export interface HardConstraints {
  price_max?: number;
  price_min?: number;
  weight_max_g?: number;
  connection?: string;
  layout?: string;
  switch_type?: string;
  wireless_type?: string;
  engraving?: string;
  backlight?: string;
}

/** 자연어 추출 결과: 의도 어휘 + 명시 하드 제약 + 명시 소프트 태그 */
export interface IntentExtraction {
  intents: IntentTag[];
  hardConstraints: HardConstraints;
  softIntentTags: SoftIntentTag[];
}

export function isIntentTag(value: string): value is IntentTag {
  return (INTENT_VOCABULARY as readonly string[]).includes(value);
}

export function isSoftIntentTag(value: string): value is SoftIntentTag {
  return (SOFT_INTENT_VOCAB as readonly string[]).includes(value);
}

export function isHardNumericKey(value: string): boolean {
  return (HARD_NUMERIC_KEYS as readonly string[]).includes(value);
}

export function isHardEnumKey(value: string): value is HardEnumKey {
  return (HARD_ENUM_KEYS as readonly string[]).includes(value);
}

export function isValidHardEnumValue(key: HardEnumKey, value: string): boolean {
  return (HARD_CONSTRAINT_ENUMS[key] as readonly string[]).includes(value);
}
