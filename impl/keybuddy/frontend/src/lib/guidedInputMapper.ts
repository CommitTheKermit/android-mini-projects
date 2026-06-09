/**
 * guidedInputMapper: 단계별 선택 입력 -> 하드 제약 / 소프트 태그 매핑 순수 함수 모듈
 *
 * App.tsx의 questions 배열에 정의된 선택지를
 * - HardConstraints: 결정론 필터에 쓰이는 하드 제약
 * - SoftIntentTag[]: 점수 가중치로 쓰이는 소프트 의도 태그
 * 로 결정론적으로 변환한다.
 *
 * LLM 호출 없이 동작하며, 스키마 매핑이 없는 입력은 빈 객체/배열을 반환한다.
 *
 * 각 함수는 단일 단계(dimension)를 담당하는 순수 함수다.
 */

import type { HardConstraints } from './extractRawTags';
import type { SoftIntentTag } from './tagSchema';

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

// ===========================================================================
// 소프트 의도 태그 매핑 함수들
// 점수 가중치로 쓰이는 단계별 순수 매핑 함수.
// LLM 호출 없이 결정론적으로 동작한다.
// ===========================================================================

// ---------------------------------------------------------------------------
// 소프트 태그용 상수 (소프트 전용 단계)
// ---------------------------------------------------------------------------

export const PURPOSE_OPTIONS = {
  OFFICE: '사무용',
  GAMING: '게임용',
  ANY: '상관없음',
} as const;

export const PORTABILITY_OPTIONS = {
  DESK: '책상에 놓고 쓸 거예요',
  PORTABLE: '자주 가지고 다닐래요',
  ANY: '상관없음',
} as const;

export const SOUND_OPTIONS = {
  VERY_QUIET: '조용해야 해요 (매우 낮음)',
  QUIET: '조금 소리가 났으면 해요 (낮음)',
  NORMAL: '적당한 소리 (보통)',
  CRISPY: '경쾌한 소리 (조금 큼)',
  LOUD: '타건감 위주 (시끄러워도 됨)',
} as const;

export const KEY_FORCE_OPTIONS = {
  LIGHT: '가볍게 눌렸으면 좋겠어요 (35~45g)',
  MEDIUM: '보편적인게 좋아요 (45~55g)',
  HEAVY: '묵직한게 좋아요 (60g 이상)',
  UNKNOWN: '잘 모르겠어요',
} as const;

// ---------------------------------------------------------------------------
// 용도 (questions[0]) -> 소프트 태그
// ---------------------------------------------------------------------------

/**
 * 사용 목적 선택지를 소프트 의도 태그로 변환한다.
 * - 사무용 -> ['사무용']
 * - 게임용 -> ['게이밍']
 * - 상관없음/기타 -> []
 */
export function mapPurposeToSoftTags(answer: string): SoftIntentTag[] {
  switch (answer) {
    case PURPOSE_OPTIONS.OFFICE:
      return ['사무용'];
    case PURPOSE_OPTIONS.GAMING:
      return ['게이밍'];
    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// 휴대성 (questions[1]) -> 소프트 태그
// ---------------------------------------------------------------------------

/**
 * 사용 환경/휴대성 선택지를 소프트 의도 태그로 변환한다.
 * - 자주 가지고 다닐래요 -> ['휴대성', '가벼움']
 * - 책상에 놓고 쓸 거예요 / 상관없음 / 기타 -> []
 */
export function mapPortabilityToSoftTags(answer: string): SoftIntentTag[] {
  switch (answer) {
    case PORTABILITY_OPTIONS.PORTABLE:
      return ['휴대성', '가벼움'];
    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// 소리 (questions[2]) -> 소프트 태그
// ---------------------------------------------------------------------------

/**
 * 타건 소리 선택지를 소프트 의도 태그로 변환한다.
 * - 조용해야 해요 (매우 낮음) -> ['조용함', '저소음']
 * - 조금 소리가 났으면 해요 (낮음) -> ['저소음']
 * - 적당한 소리 (보통) -> []
 * - 경쾌한 소리 (조금 큼) -> ['경쾌함']
 * - 타건감 위주 (시끄러워도 됨) -> ['타건감', '고소음', '경쾌함']
 */
export function mapSoundToSoftTags(answer: string): SoftIntentTag[] {
  switch (answer) {
    case SOUND_OPTIONS.VERY_QUIET:
      return ['조용함', '저소음'];
    case SOUND_OPTIONS.QUIET:
      return ['저소음'];
    case SOUND_OPTIONS.NORMAL:
      return [];
    case SOUND_OPTIONS.CRISPY:
      return ['경쾌함'];
    case SOUND_OPTIONS.LOUD:
      return ['타건감', '고소음', '경쾌함'];
    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// 키압 (questions[4]) -> 소프트 태그
// ---------------------------------------------------------------------------

/**
 * 키 누름 무게감(키압) 선택지를 소프트 의도 태그로 변환한다.
 * - 가볍게 눌렸으면 좋겠어요 (35~45g) -> ['저소음'] (가벼운 스위치는 소음이 낮은 경향)
 * - 보편적인게 좋아요 (45~55g) -> []
 * - 묵직한게 좋아요 (60g 이상) -> ['타건감'] (무거운 스위치는 타건감이 명확한 경향)
 * - 잘 모르겠어요 / 기타 -> []
 */
export function mapKeyForceToSoftTags(answer: string): SoftIntentTag[] {
  switch (answer) {
    case KEY_FORCE_OPTIONS.LIGHT:
      return ['저소음'];
    case KEY_FORCE_OPTIONS.HEAVY:
      return ['타건감'];
    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// 키감 (questions[3]) -> 소프트 태그 (하드 제약과 별도)
// ---------------------------------------------------------------------------

/**
 * 키감 선택지를 소프트 의도 태그로 변환한다.
 * mapKeyFeelToConstraints가 switch_type 하드 제약을 생성하는 것과 별도로,
 * 키감은 타건 특성에 대한 소프트 의도도 표현한다.
 *
 * - 또각또각(클릭/택타일) -> ['기계식', '타건감', '경쾌함']
 * - 서걱서걱(리니어) -> ['기계식', '타건감']
 * - 보글보글(무접점) -> ['무접점', '타건감', '조용함']
 * - 잘 모르겠어요 / 기타 -> []
 */
export function mapKeyFeelToSoftTags(answer: string): SoftIntentTag[] {
  switch (answer) {
    case KEY_FEEL_OPTIONS.TACTILE:
      return ['기계식', '타건감', '경쾌함'];
    case KEY_FEEL_OPTIONS.LINEAR:
      return ['기계식', '타건감'];
    case KEY_FEEL_OPTIONS.TOPRE:
      return ['무접점', '타건감', '조용함'];
    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// 크기 (questions[6]) -> 소프트 태그 (하드 제약과 별도)
// ---------------------------------------------------------------------------

/**
 * 크기 선택지를 소프트 의도 태그로 변환한다.
 * mapLayoutToConstraints가 layout 하드 제약을 생성하는 것과 별도로,
 * 모든 크기 선택지는 소프트 태그를 생성할 수 있다.
 *
 * - 풀배열 -> ['풀배열']
 * - 1800배열 -> ['풀배열'] (풀배열의 콤팩트 변형)
 * - 텐키리스 -> ['텐키리스', '휴대성']
 * - 75%/65% -> ['텐키리스', '휴대성'] (텐키리스보다 소형이지만 유사 크기)
 * - 미니(60%) -> ['미니', '휴대성']
 */
export function mapLayoutToSoftTags(answer: string): SoftIntentTag[] {
  switch (answer) {
    case LAYOUT_OPTIONS.FULL:
      return ['풀배열'];
    case LAYOUT_OPTIONS.COMPACT_FULL:
      return ['풀배열'];
    case LAYOUT_OPTIONS.TKL:
      return ['텐키리스', '휴대성'];
    case LAYOUT_OPTIONS.SEVENTY_FIVE:
      return ['텐키리스', '휴대성'];
    case LAYOUT_OPTIONS.MINI:
      return ['미니', '휴대성'];
    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// 연결방식 (questions[5]) -> 소프트 태그 (하드 제약과 별도)
// ---------------------------------------------------------------------------

/**
 * 연결방식 선택지를 소프트 의도 태그로 변환한다.
 * - 유선 -> [] (유선 전용은 소프트 태그 없음)
 * - 무선 USB 동글 -> ['무선']
 * - 블루투스 -> ['무선', '멀티페어링']
 * - 유/무선 모두 -> ['무선']
 * - 상관없음 / 기타 -> []
 */
export function mapConnectionToSoftTags(answer: string): SoftIntentTag[] {
  switch (answer) {
    case CONNECTION_OPTIONS.DONGLE:
      return ['무선'];
    case CONNECTION_OPTIONS.BLUETOOTH:
      return ['무선', '멀티페어링'];
    case CONNECTION_OPTIONS.BOTH:
      return ['무선'];
    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// 백라이트 (questions[9]) -> 소프트 태그 (하드 제약과 별도)
// ---------------------------------------------------------------------------

/**
 * 백라이트 선택지를 소프트 의도 태그로 변환한다.
 * - RGB -> ['RGB', '백라이트']
 * - 단색 -> ['백라이트']
 * - 없음(배터리 절약) -> ['백라이트없음']
 * - 기타 -> []
 */
export function mapBacklightToSoftTags(answer: string): SoftIntentTag[] {
  switch (answer) {
    case BACKLIGHT_OPTIONS.RGB:
      return ['RGB', '백라이트'];
    case BACKLIGHT_OPTIONS.MONO:
      return ['백라이트'];
    case BACKLIGHT_OPTIONS.NONE:
      return ['백라이트없음'];
    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// 각인 (questions[8]) -> 소프트 태그 (하드 제약과 별도)
// ---------------------------------------------------------------------------

/**
 * 각인 선택지를 소프트 의도 태그로 변환한다.
 * - 한국어+영어 -> ['한영각인']
 * - 영어만 -> ['영문각인']
 * - 한국어만 / 상관없음 / 기타 -> []
 */
export function mapEngravingToSoftTags(answer: string): SoftIntentTag[] {
  switch (answer) {
    case ENGRAVING_OPTIONS.BOTH:
      return ['한영각인'];
    case ENGRAVING_OPTIONS.ENGLISH_ONLY:
      return ['영문각인'];
    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// 통합: 모든 단계 answers -> SoftIntentTag[] (중복 제거)
// ---------------------------------------------------------------------------

/**
 * 단계별 선택 입력 전체(answers)를 SoftIntentTag[]로 병합한다.
 *
 * answers 키는 App.tsx의 questions[].id와 일치해야 한다:
 *   '용도', '휴대성', '소리', '키감', '키압', '연결방식', '크기', '각인', '백라이트'
 *
 * 모든 단계의 소프트 태그를 수집하고 중복을 제거하여 반환한다.
 * LLM 호출 없이 결정론적으로 동작한다.
 */
export function guidedAnswersToSoftTags(answers: Record<string, string>): SoftIntentTag[] {
  const tags: SoftIntentTag[] = [
    ...mapPurposeToSoftTags(answers['용도'] ?? ''),
    ...mapPortabilityToSoftTags(answers['휴대성'] ?? ''),
    ...mapSoundToSoftTags(answers['소리'] ?? ''),
    ...mapKeyForceToSoftTags(answers['키압'] ?? ''),
    ...mapKeyFeelToSoftTags(answers['키감'] ?? ''),
    ...mapLayoutToSoftTags(answers['크기'] ?? ''),
    ...mapConnectionToSoftTags(answers['연결방식'] ?? ''),
    ...mapBacklightToSoftTags(answers['백라이트'] ?? ''),
    ...mapEngravingToSoftTags(answers['각인'] ?? ''),
  ];
  // 중복 제거 (순서 유지)
  return [...new Set(tags)];
}

// ===========================================================================
// 디스패처: 단계 번호 + 선택값 -> TagSet
// Sub-AC 2-1-C: 단계 번호와 선택값을 받아 하드/소프트 매핑 함수에 라우팅
// ===========================================================================

/**
 * 한 단계의 입력에서 생성된 하드 제약 + 소프트 태그 묶음.
 *
 * hard: 결정론 필터에 쓰이는 HardConstraints (한 단계 기여분)
 * soft: 점수 가중치로 쓰이는 SoftIntentTag[]
 */
export interface TagSet {
  hard: HardConstraints;
  soft: SoftIntentTag[];
}

/**
 * 단계 번호(0-9)와 선택값을 받아 적절한 매핑 함수에 라우팅하고
 * TagSet { hard, soft }를 반환하는 디스패처 함수.
 *
 * stepIndex - App.tsx questions 배열 인덱스 (0-9):
 *   0: 용도     - 소프트 전용
 *   1: 휴대성   - 소프트 전용
 *   2: 소리     - 소프트 전용
 *   3: 키감     - 하드 + 소프트
 *   4: 키압     - 소프트 전용
 *   5: 연결방식 - 하드 + 소프트
 *   6: 크기     - 하드 + 소프트
 *   7: 예산     - 하드 전용 (value: { min, max })
 *   8: 각인     - 하드 + 소프트
 *   9: 백라이트 - 하드 + 소프트
 *
 * 예산 단계(7)는 value로 { min: number; max: number }를 받는다.
 * 나머지 단계는 string을 받는다.
 * 알 수 없는 단계 번호나 타입 불일치는 { hard: {}, soft: [] }를 반환한다.
 *
 * LLM 호출 없이 결정론적으로 동작한다.
 */
export function dispatchStepToTagSet(
  stepIndex: number,
  value: string | { min: number; max: number },
): TagSet {
  switch (stepIndex) {
    case 0: // 용도
      if (typeof value !== 'string') return { hard: {}, soft: [] };
      return { hard: {}, soft: mapPurposeToSoftTags(value) };
    case 1: // 휴대성
      if (typeof value !== 'string') return { hard: {}, soft: [] };
      return { hard: {}, soft: mapPortabilityToSoftTags(value) };
    case 2: // 소리
      if (typeof value !== 'string') return { hard: {}, soft: [] };
      return { hard: {}, soft: mapSoundToSoftTags(value) };
    case 3: // 키감
      if (typeof value !== 'string') return { hard: {}, soft: [] };
      return { hard: mapKeyFeelToConstraints(value), soft: mapKeyFeelToSoftTags(value) };
    case 4: // 키압
      if (typeof value !== 'string') return { hard: {}, soft: [] };
      return { hard: {}, soft: mapKeyForceToSoftTags(value) };
    case 5: // 연결방식
      if (typeof value !== 'string') return { hard: {}, soft: [] };
      return { hard: mapConnectionToConstraints(value), soft: mapConnectionToSoftTags(value) };
    case 6: // 크기
      if (typeof value !== 'string') return { hard: {}, soft: [] };
      return { hard: mapLayoutToConstraints(value), soft: mapLayoutToSoftTags(value) };
    case 7: // 예산 (슬라이더 - { min, max } 형태)
      if (typeof value === 'string') return { hard: {}, soft: [] };
      return { hard: mapBudgetToConstraints(value), soft: [] };
    case 8: // 각인
      if (typeof value !== 'string') return { hard: {}, soft: [] };
      return { hard: mapEngravingToConstraints(value), soft: mapEngravingToSoftTags(value) };
    case 9: // 백라이트
      if (typeof value !== 'string') return { hard: {}, soft: [] };
      return { hard: mapBacklightToConstraints(value), soft: mapBacklightToSoftTags(value) };
    default:
      return { hard: {}, soft: [] };
  }
}

/**
 * App.tsx questions[].id -> stepIndex 매핑 테이블.
 * dispatchStepIdToTagSet에서 사용한다.
 */
export const STEP_ID_TO_INDEX: Readonly<Record<string, number>> = {
  용도: 0,
  휴대성: 1,
  소리: 2,
  키감: 3,
  키압: 4,
  연결방식: 5,
  크기: 6,
  예산: 7,
  각인: 8,
  백라이트: 9,
};

/**
 * 단계 ID 문자열('용도', '연결방식' 등)과 선택값을 받아
 * dispatchStepToTagSet으로 라우팅한 뒤 TagSet을 반환한다.
 *
 * 알 수 없는 단계 ID -> { hard: {}, soft: [] }
 * LLM 호출 없이 결정론적으로 동작한다.
 */
export function dispatchStepIdToTagSet(
  stepId: string,
  value: string | { min: number; max: number },
): TagSet {
  const idx = STEP_ID_TO_INDEX[stepId];
  if (idx === undefined) return { hard: {}, soft: [] };
  return dispatchStepToTagSet(idx, value);
}
