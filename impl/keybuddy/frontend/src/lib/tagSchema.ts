/**
 * 태그 파이프라인 스키마 상수 모듈
 *
 * HardConstraint: 반드시 만족해야 하는 필터 술어의 허용 키 목록 + 열거형 값
 * SoftIntentTag: 의도 매핑에 쓰이는 소프트 태그 어휘 목록
 *
 * 추출 결과 중 이 스키마 밖 값은 폐기한다.
 */

// ---------------------------------------------------------------------------
// HardConstraint 허용 키
// ---------------------------------------------------------------------------

/** 숫자 범위 하드 제약 키 */
export const HARD_NUMERIC_KEYS = ['price_max', 'price_min', 'weight_max_g'] as const;

/** 열거형 하드 제약 키 */
export const HARD_ENUM_KEYS = [
  'connection',
  'layout',
  'switch_type',
  'wireless_type',
  'engraving',
  'backlight',
] as const;

/** 모든 하드 제약 허용 키 (숫자 + 열거형) */
export const HARD_CONSTRAINT_KEYS = [...HARD_NUMERIC_KEYS, ...HARD_ENUM_KEYS] as const;

export type HardNumericKey = (typeof HARD_NUMERIC_KEYS)[number];
export type HardEnumKey = (typeof HARD_ENUM_KEYS)[number];
export type HardConstraintKey = (typeof HARD_CONSTRAINT_KEYS)[number];

// ---------------------------------------------------------------------------
// HardConstraint 열거형 값 집합
// ---------------------------------------------------------------------------

export const HARD_CONSTRAINT_ENUMS = {
  connection: ['유선', '무선', '유선+무선'] as const,
  layout: ['풀배열', '텐키리스', '미니', '98키', '99키', '96키'] as const,
  switch_type: [
    '기계식',
    '펜타그래프',
    '무접점 자석축',
    '무접점 광축',
    '멤브레인',
    '무접점',
  ] as const,
  wireless_type: [
    '전용동글(리시버)',
    '블루투스',
    '전용동글(리시버), 블루투스',
    '블루투스, 전용동글(리시버)',
    '유선',
  ] as const,
  engraving: ['한/영 정각', '영문 정각', '레이저각인 키캡', '정보없음'] as const,
  backlight: ['RGB 백라이트', '레인보우 백라이트', '단색 백라이트', '없음'] as const,
} as const satisfies Record<HardEnumKey, readonly string[]>;

export type HardConstraintEnumKey = keyof typeof HARD_CONSTRAINT_ENUMS;
export type HardConstraintEnumValue<K extends HardEnumKey> =
  (typeof HARD_CONSTRAINT_ENUMS)[K][number];

// ---------------------------------------------------------------------------
// SoftIntent 태그 어휘
// ---------------------------------------------------------------------------

/**
 * 소프트 의도 태그 허용 어휘 목록.
 * 이 목록에 없는 추출 태그는 폐기된다.
 */
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

export type SoftIntentTag = (typeof SOFT_INTENT_VOCAB)[number];

// ---------------------------------------------------------------------------
// 헬퍼: 런타임 검증 유틸
// ---------------------------------------------------------------------------

/** 문자열이 SOFT_INTENT_VOCAB 멤버인지 확인 */
export function isSoftIntentTag(value: string): value is SoftIntentTag {
  return (SOFT_INTENT_VOCAB as readonly string[]).includes(value);
}

/** 문자열이 HardConstraintKey 멤버인지 확인 */
export function isHardConstraintKey(value: string): value is HardConstraintKey {
  return (HARD_CONSTRAINT_KEYS as readonly string[]).includes(value);
}

/** 주어진 열거형 키와 값이 허용 조합인지 확인 */
export function isValidHardEnumValue(key: HardEnumKey, value: string): boolean {
  return (HARD_CONSTRAINT_ENUMS[key] as readonly string[]).includes(value);
}
