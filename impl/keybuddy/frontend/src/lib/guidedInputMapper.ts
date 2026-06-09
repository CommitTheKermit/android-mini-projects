/**
 * guidedInputMapper: 단계별 선택 입력 -> 하드 제약 매핑 순수 함수 모듈
 *
 * App.tsx의 questions 배열에 정의된 선택지를 HardConstraints로 결정론적으로 변환한다.
 * LLM 호출 없이 동작하며, 스키마 매핑이 없는 입력은 빈 객체를 반환한다(하드 제약 미생성).
 *
 * 각 함수는 단일 단계(dimension)를 담당하는 순수 함수다.
 */

import type { HardConstraints } from './extractRawTags';

// ---------------------------------------------------------------------------
// 예산 (budget range) -> price_min / price_max
// ---------------------------------------------------------------------------

/**
 * 예산 슬라이더 범위를 가격 하드 제약으로 변환한다.
 * - min > 0  -> price_min
 * - max < 1_000_000 -> price_max (1,000,000 이상은 상한 없음으로 간주)
 */
export function mapBudgetToConstraints(
  budget: { min: number; max: number },
): Pick<HardConstraints, 'price_min' | 'price_max'> {
  const result: Pick<HardConstraints, 'price_min' | 'price_max'> = {};
  if (budget.min > 0) result.price_min = budget.min;
  if (budget.max < 1_000_000) result.price_max = budget.max;
  return result;
}

// ---------------------------------------------------------------------------
// 연결방식 (App.tsx questions[5]) -> connection / wireless_type
// ---------------------------------------------------------------------------

export const CONNECTION_OPTIONS = {
  WIRED: '유선',
  DONGLE: '무선 USB 동글',
  BLUETOOTH: '블루투스',
  BOTH: '유/무선 모두',
  ANY: '상관없음',
} as const;

/**
 * 연결방식 선택지를 connection/wireless_type 하드 제약으로 변환한다.
 * '상관없음' 또는 알 수 없는 값은 빈 객체를 반환한다.
 */
export function mapConnectionToConstraints(
  answer: string,
): Pick<HardConstraints, 'connection' | 'wireless_type'> {
  switch (answer) {
    case CONNECTION_OPTIONS.WIRED:
      return { connection: '유선' };
    case CONNECTION_OPTIONS.DONGLE:
      return { connection: '무선', wireless_type: '전용동글(리시버)' };
    case CONNECTION_OPTIONS.BLUETOOTH:
      return { connection: '무선', wireless_type: '블루투스' };
    case CONNECTION_OPTIONS.BOTH:
      return { connection: '유선+무선' };
    default:
      return {};
  }
}

// ---------------------------------------------------------------------------
// 크기 (App.tsx questions[6]) -> layout
// ---------------------------------------------------------------------------

export const LAYOUT_OPTIONS = {
  FULL: '숫자 패드가 있는 일반 키보드 (풀배열)',
  COMPACT_FULL: '숫자 패드가 있지만 콤팩트함 (1800배열)',
  TKL: '숫자 패드가 없음 (텐키리스)',
  SEVENTY_FIVE: '숫자 패드도, 일부 특수키도 없음 (75%/65%)',
  MINI: 'F1~F12키도 없는 미니 (60%)',
} as const;

/**
 * 크기 선택지를 layout 하드 제약으로 변환한다.
 * - 1800배열(COMPACT_FULL)과 75%/65%(SEVENTY_FIVE)는 스키마 단일 열거형으로 표현 불가
 *   -> 하드 제약 없음(빈 객체 반환)
 */
export function mapLayoutToConstraints(answer: string): Pick<HardConstraints, 'layout'> {
  switch (answer) {
    case LAYOUT_OPTIONS.FULL:
      return { layout: '풀배열' };
    case LAYOUT_OPTIONS.TKL:
      return { layout: '텐키리스' };
    case LAYOUT_OPTIONS.MINI:
      return { layout: '미니' };
    // 1800배열, 75%/65%: 스키마 매핑 없음 -> 하드 제약 미생성
    case LAYOUT_OPTIONS.COMPACT_FULL:
    case LAYOUT_OPTIONS.SEVENTY_FIVE:
    default:
      return {};
  }
}

// ---------------------------------------------------------------------------
// 각인 (App.tsx questions[8]) -> engraving
// ---------------------------------------------------------------------------

export const ENGRAVING_OPTIONS = {
  BOTH: '한국어, 영어가 모두 필요해요',
  ENGLISH_ONLY: '영어만 적혀있길 바라요',
  KOREAN_ONLY: '한국어만 적혀있길 바라요',
  ANY: '상관없음',
} as const;

/**
 * 각인 선택지를 engraving 하드 제약으로 변환한다.
 * - KOREAN_ONLY: 스키마에 한국어 단독 각인 열거형 없음 -> 하드 제약 미생성
 * - ANY/기타: 빈 객체
 */
export function mapEngravingToConstraints(answer: string): Pick<HardConstraints, 'engraving'> {
  switch (answer) {
    case ENGRAVING_OPTIONS.BOTH:
      return { engraving: '한/영 정각' };
    case ENGRAVING_OPTIONS.ENGLISH_ONLY:
      return { engraving: '영문 정각' };
    default:
      return {};
  }
}

// ---------------------------------------------------------------------------
// 백라이트 (App.tsx questions[9]) -> backlight
// ---------------------------------------------------------------------------

export const BACKLIGHT_OPTIONS = {
  RGB: '화려한 RGB가 좋아요',
  MONO: '은은한 단색 조명이 좋아요',
  NONE: '없어도 돼요 (배터리 절약)',
} as const;

/**
 * 백라이트 선택지를 backlight 하드 제약으로 변환한다.
 */
export function mapBacklightToConstraints(answer: string): Pick<HardConstraints, 'backlight'> {
  switch (answer) {
    case BACKLIGHT_OPTIONS.RGB:
      return { backlight: 'RGB 백라이트' };
    case BACKLIGHT_OPTIONS.MONO:
      return { backlight: '단색 백라이트' };
    case BACKLIGHT_OPTIONS.NONE:
      return { backlight: '없음' };
    default:
      return {};
  }
}

// ---------------------------------------------------------------------------
// 키감 (App.tsx questions[3]) -> switch_type
// ---------------------------------------------------------------------------

export const KEY_FEEL_OPTIONS = {
  TACTILE: '또각또각 (걸림이 있는 느낌)',
  LINEAR: '서걱서걱 (부드럽게 들어가는 느낌)',
  TOPRE: '보글보글 (독특한 무접점 느낌)',
  UNKNOWN: '잘 모르겠어요',
} as const;

/**
 * 키감 선택지를 switch_type 하드 제약으로 변환한다.
 * - 또각또각(클릭/택타일)과 서걱서걱(리니어) -> 기계식
 * - 보글보글(무접점 특유의 느낌) -> 무접점
 * - 잘 모르겠어요/기타 -> 하드 제약 미생성
 */
export function mapKeyFeelToConstraints(answer: string): Pick<HardConstraints, 'switch_type'> {
  switch (answer) {
    case KEY_FEEL_OPTIONS.TACTILE:
    case KEY_FEEL_OPTIONS.LINEAR:
      return { switch_type: '기계식' };
    case KEY_FEEL_OPTIONS.TOPRE:
      return { switch_type: '무접점' };
    default:
      return {};
  }
}

// ---------------------------------------------------------------------------
// 통합: 모든 단계 answers + budget -> HardConstraints
// ---------------------------------------------------------------------------

/**
 * 단계별 선택 입력 전체(answers + budget)를 HardConstraints로 병합한다.
 *
 * answers 키는 App.tsx의 questions[].id와 일치해야 한다:
 *   '용도', '휴대성', '소리', '키감', '키압', '연결방식', '크기', '예산', '각인', '백라이트'
 *
 * 하드 제약을 생성하는 단계: 연결방식, 크기, 각인, 백라이트, 키감, 예산
 * 나머지 단계(용도, 휴대성, 소리, 키압)는 소프트 의도 태그로 처리한다.
 *
 * LLM 호출 없이 결정론적으로 동작한다.
 */
export function guidedAnswersToHardConstraints(
  answers: Record<string, string>,
  budget: { min: number; max: number },
): HardConstraints {
  return {
    ...mapBudgetToConstraints(budget),
    ...mapConnectionToConstraints(answers['연결방식'] ?? ''),
    ...mapLayoutToConstraints(answers['크기'] ?? ''),
    ...mapEngravingToConstraints(answers['각인'] ?? ''),
    ...mapBacklightToConstraints(answers['백라이트'] ?? ''),
    ...mapKeyFeelToConstraints(answers['키감'] ?? ''),
  };
}
