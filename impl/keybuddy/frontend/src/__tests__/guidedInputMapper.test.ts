/**
 * guidedInputMapper 단위 테스트
 *
 * 각 단계별 순수 매핑 함수의 입력->하드 제약 변환을 검증한다.
 * - 모든 테스트는 LLM 호출 없이 동작한다 (순수 함수)
 * - 각 단계의 유효 선택지가 올바른 HardConstraints 값으로 변환되는지 확인
 * - 매핑 불가 입력은 빈 객체를 반환하는지 확인
 * - 최종 guidedAnswersToHardConstraints 결과가 validateTagSchema를 통과하는지 확인
 */

import { describe, it, expect } from 'vitest';
import {
  mapBudgetToConstraints,
  mapConnectionToConstraints,
  mapLayoutToConstraints,
  mapEngravingToConstraints,
  mapBacklightToConstraints,
  mapKeyFeelToConstraints,
  guidedAnswersToHardConstraints,
  CONNECTION_OPTIONS,
  LAYOUT_OPTIONS,
  ENGRAVING_OPTIONS,
  BACKLIGHT_OPTIONS,
  KEY_FEEL_OPTIONS,
} from '../lib/guidedInputMapper';
import { validateTagSchema } from '../lib/tagSchema';

// ---------------------------------------------------------------------------
// mapBudgetToConstraints
// ---------------------------------------------------------------------------

describe('mapBudgetToConstraints', () => {
  it('min=0, max=1_000_000 -> 빈 객체 (제약 없음)', () => {
    expect(mapBudgetToConstraints({ min: 0, max: 1_000_000 })).toEqual({});
  });

  it('min > 0 -> price_min 설정', () => {
    const result = mapBudgetToConstraints({ min: 50_000, max: 1_000_000 });
    expect(result.price_min).toBe(50_000);
    expect(result.price_max).toBeUndefined();
  });

  it('max < 1_000_000 -> price_max 설정', () => {
    const result = mapBudgetToConstraints({ min: 0, max: 200_000 });
    expect(result.price_max).toBe(200_000);
    expect(result.price_min).toBeUndefined();
  });

  it('min > 0 && max < 1_000_000 -> price_min + price_max 둘 다 설정', () => {
    const result = mapBudgetToConstraints({ min: 50_000, max: 150_000 });
    expect(result.price_min).toBe(50_000);
    expect(result.price_max).toBe(150_000);
  });

  it('max === 1_000_000 -> price_max 미설정 (상한 없음 취급)', () => {
    const result = mapBudgetToConstraints({ min: 0, max: 1_000_000 });
    expect(result.price_max).toBeUndefined();
  });

  it('min = 0 -> price_min 미설정 (하한 없음)', () => {
    const result = mapBudgetToConstraints({ min: 0, max: 300_000 });
    expect(result.price_min).toBeUndefined();
    expect(result.price_max).toBe(300_000);
  });

  it('경계값: min=10_000, max=999_999 -> 둘 다 설정', () => {
    const result = mapBudgetToConstraints({ min: 10_000, max: 999_999 });
    expect(result.price_min).toBe(10_000);
    expect(result.price_max).toBe(999_999);
  });
});

// ---------------------------------------------------------------------------
// mapConnectionToConstraints
// ---------------------------------------------------------------------------

describe('mapConnectionToConstraints', () => {
  it('유선 -> connection: 유선', () => {
    const result = mapConnectionToConstraints(CONNECTION_OPTIONS.WIRED);
    expect(result.connection).toBe('유선');
    expect(result.wireless_type).toBeUndefined();
  });

  it('무선 USB 동글 -> connection: 무선, wireless_type: 전용동글(리시버)', () => {
    const result = mapConnectionToConstraints(CONNECTION_OPTIONS.DONGLE);
    expect(result.connection).toBe('무선');
    expect(result.wireless_type).toBe('전용동글(리시버)');
  });

  it('블루투스 -> connection: 무선, wireless_type: 블루투스', () => {
    const result = mapConnectionToConstraints(CONNECTION_OPTIONS.BLUETOOTH);
    expect(result.connection).toBe('무선');
    expect(result.wireless_type).toBe('블루투스');
  });

  it('유/무선 모두 -> connection: 유선+무선', () => {
    const result = mapConnectionToConstraints(CONNECTION_OPTIONS.BOTH);
    expect(result.connection).toBe('유선+무선');
    expect(result.wireless_type).toBeUndefined();
  });

  it('상관없음 -> 빈 객체', () => {
    expect(mapConnectionToConstraints(CONNECTION_OPTIONS.ANY)).toEqual({});
  });

  it('알 수 없는 값 -> 빈 객체', () => {
    expect(mapConnectionToConstraints('위성통신')).toEqual({});
    expect(mapConnectionToConstraints('')).toEqual({});
  });

  it('유선 연결은 connection만 설정되고 wireless_type은 없음', () => {
    const result = mapConnectionToConstraints('유선');
    expect(Object.keys(result)).not.toContain('wireless_type');
  });
});

// ---------------------------------------------------------------------------
// mapLayoutToConstraints
// ---------------------------------------------------------------------------

describe('mapLayoutToConstraints', () => {
  it('풀배열 -> layout: 풀배열', () => {
    const result = mapLayoutToConstraints(LAYOUT_OPTIONS.FULL);
    expect(result.layout).toBe('풀배열');
  });

  it('텐키리스 -> layout: 텐키리스', () => {
    const result = mapLayoutToConstraints(LAYOUT_OPTIONS.TKL);
    expect(result.layout).toBe('텐키리스');
  });

  it('미니(60%) -> layout: 미니', () => {
    const result = mapLayoutToConstraints(LAYOUT_OPTIONS.MINI);
    expect(result.layout).toBe('미니');
  });

  it('1800배열 -> 빈 객체 (스키마 단일값 표현 불가)', () => {
    expect(mapLayoutToConstraints(LAYOUT_OPTIONS.COMPACT_FULL)).toEqual({});
  });

  it('75%/65% -> 빈 객체 (스키마 단일값 표현 불가)', () => {
    expect(mapLayoutToConstraints(LAYOUT_OPTIONS.SEVENTY_FIVE)).toEqual({});
  });

  it('알 수 없는 값 -> 빈 객체', () => {
    expect(mapLayoutToConstraints('96키 레이아웃')).toEqual({});
    expect(mapLayoutToConstraints('')).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// mapEngravingToConstraints
// ---------------------------------------------------------------------------

describe('mapEngravingToConstraints', () => {
  it('한국어+영어 -> engraving: 한/영 정각', () => {
    const result = mapEngravingToConstraints(ENGRAVING_OPTIONS.BOTH);
    expect(result.engraving).toBe('한/영 정각');
  });

  it('영어만 -> engraving: 영문 정각', () => {
    const result = mapEngravingToConstraints(ENGRAVING_OPTIONS.ENGLISH_ONLY);
    expect(result.engraving).toBe('영문 정각');
  });

  it('한국어만 -> 빈 객체 (스키마에 한글 단독 각인 없음)', () => {
    expect(mapEngravingToConstraints(ENGRAVING_OPTIONS.KOREAN_ONLY)).toEqual({});
  });

  it('상관없음 -> 빈 객체', () => {
    expect(mapEngravingToConstraints(ENGRAVING_OPTIONS.ANY)).toEqual({});
  });

  it('알 수 없는 값 -> 빈 객체', () => {
    expect(mapEngravingToConstraints('무각인')).toEqual({});
    expect(mapEngravingToConstraints('')).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// mapBacklightToConstraints
// ---------------------------------------------------------------------------

describe('mapBacklightToConstraints', () => {
  it('RGB -> backlight: RGB 백라이트', () => {
    const result = mapBacklightToConstraints(BACKLIGHT_OPTIONS.RGB);
    expect(result.backlight).toBe('RGB 백라이트');
  });

  it('단색 -> backlight: 단색 백라이트', () => {
    const result = mapBacklightToConstraints(BACKLIGHT_OPTIONS.MONO);
    expect(result.backlight).toBe('단색 백라이트');
  });

  it('없음(배터리 절약) -> backlight: 없음', () => {
    const result = mapBacklightToConstraints(BACKLIGHT_OPTIONS.NONE);
    expect(result.backlight).toBe('없음');
  });

  it('알 수 없는 값 -> 빈 객체', () => {
    expect(mapBacklightToConstraints('레이저')).toEqual({});
    expect(mapBacklightToConstraints('')).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// mapKeyFeelToConstraints
// ---------------------------------------------------------------------------

describe('mapKeyFeelToConstraints', () => {
  it('또각또각(택타일) -> switch_type: 기계식', () => {
    const result = mapKeyFeelToConstraints(KEY_FEEL_OPTIONS.TACTILE);
    expect(result.switch_type).toBe('기계식');
  });

  it('서걱서걱(리니어) -> switch_type: 기계식', () => {
    const result = mapKeyFeelToConstraints(KEY_FEEL_OPTIONS.LINEAR);
    expect(result.switch_type).toBe('기계식');
  });

  it('보글보글(무접점) -> switch_type: 무접점', () => {
    const result = mapKeyFeelToConstraints(KEY_FEEL_OPTIONS.TOPRE);
    expect(result.switch_type).toBe('무접점');
  });

  it('잘 모르겠어요 -> 빈 객체 (하드 제약 미생성)', () => {
    expect(mapKeyFeelToConstraints(KEY_FEEL_OPTIONS.UNKNOWN)).toEqual({});
  });

  it('알 수 없는 값 -> 빈 객체', () => {
    expect(mapKeyFeelToConstraints('스프링 특수축')).toEqual({});
    expect(mapKeyFeelToConstraints('')).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// guidedAnswersToHardConstraints - 통합 변환
// ---------------------------------------------------------------------------

describe('guidedAnswersToHardConstraints', () => {
  it('모든 하드 제약 단계를 입력하면 올바른 HardConstraints 객체를 반환한다', () => {
    const answers = {
      연결방식: '블루투스',
      크기: '숫자 패드가 없음 (텐키리스)',
      각인: '한국어, 영어가 모두 필요해요',
      백라이트: '없어도 돼요 (배터리 절약)',
      키감: '또각또각 (걸림이 있는 느낌)',
    };
    const budget = { min: 50_000, max: 200_000 };

    const result = guidedAnswersToHardConstraints(answers, budget);

    expect(result.connection).toBe('무선');
    expect(result.wireless_type).toBe('블루투스');
    expect(result.layout).toBe('텐키리스');
    expect(result.engraving).toBe('한/영 정각');
    expect(result.backlight).toBe('없음');
    expect(result.switch_type).toBe('기계식');
    expect(result.price_min).toBe(50_000);
    expect(result.price_max).toBe(200_000);
  });

  it('빈 answers + 기본 budget -> 빈 HardConstraints', () => {
    const result = guidedAnswersToHardConstraints({}, { min: 0, max: 1_000_000 });
    expect(result).toEqual({});
  });

  it('일부 단계만 답변 -> 해당 제약만 설정, 나머지 미정의', () => {
    const answers = { 연결방식: '유선' };
    const result = guidedAnswersToHardConstraints(answers, { min: 0, max: 1_000_000 });

    expect(result.connection).toBe('유선');
    expect(result.layout).toBeUndefined();
    expect(result.price_max).toBeUndefined();
  });

  it('상관없음/잘 모르겠어요만 있으면 하드 제약 없음', () => {
    const answers = {
      연결방식: '상관없음',
      키감: '잘 모르겠어요',
    };
    const result = guidedAnswersToHardConstraints(answers, { min: 0, max: 1_000_000 });
    expect(result).toEqual({});
  });

  it('미니 + 무선 USB 동글 + RGB + 예산 -> 복합 하드 제약 올바름', () => {
    const answers = {
      크기: 'F1~F12키도 없는 미니 (60%)',
      연결방식: '무선 USB 동글',
      백라이트: '화려한 RGB가 좋아요',
    };
    const result = guidedAnswersToHardConstraints(answers, { min: 0, max: 100_000 });

    expect(result.layout).toBe('미니');
    expect(result.connection).toBe('무선');
    expect(result.wireless_type).toBe('전용동글(리시버)');
    expect(result.backlight).toBe('RGB 백라이트');
    expect(result.price_max).toBe(100_000);
  });

  it('1800배열 선택 시 layout 하드 제약 없음 (하드 필터 미적용)', () => {
    const answers = { 크기: '숫자 패드가 있지만 콤팩트함 (1800배열)' };
    const result = guidedAnswersToHardConstraints(answers, { min: 0, max: 1_000_000 });
    expect(result.layout).toBeUndefined();
  });

  it('75%/65% 선택 시 layout 하드 제약 없음', () => {
    const answers = { 크기: '숫자 패드도, 일부 특수키도 없음 (75%/65%)' };
    const result = guidedAnswersToHardConstraints(answers, { min: 0, max: 1_000_000 });
    expect(result.layout).toBeUndefined();
  });

  it('한국어만 각인 선택 시 engraving 하드 제약 없음', () => {
    const answers = { 각인: '한국어만 적혀있길 바라요' };
    const result = guidedAnswersToHardConstraints(answers, { min: 0, max: 1_000_000 });
    expect(result.engraving).toBeUndefined();
  });

  it('보글보글 선택 시 switch_type: 무접점 하드 제약', () => {
    const answers = { 키감: '보글보글 (독특한 무접점 느낌)' };
    const result = guidedAnswersToHardConstraints(answers, { min: 0, max: 1_000_000 });
    expect(result.switch_type).toBe('무접점');
  });

  it('하드 제약을 생성하지 않는 단계(용도, 휴대성, 소리, 키압) 답변은 무시된다', () => {
    const answers = {
      용도: '사무용',
      휴대성: '자주 가지고 다닐래요',
      소리: '조용해야 해요 (매우 낮음)',
      키압: '가볍게 눌렸으면 좋겠어요 (35~45g)',
    };
    const result = guidedAnswersToHardConstraints(answers, { min: 0, max: 1_000_000 });
    // 이 단계들은 소프트 의도 태그로 처리되므로 하드 제약에 포함되지 않는다
    expect(result).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// validateTagSchema 통과 검증: guidedAnswersToHardConstraints 출력은 항상 유효
// ---------------------------------------------------------------------------

describe('guidedAnswersToHardConstraints - validateTagSchema 통과 보장', () => {
  const cases: Array<{ desc: string; answers: Record<string, string>; budget: { min: number; max: number } }> = [
    {
      desc: '전체 단계 입력',
      answers: {
        연결방식: '블루투스',
        크기: '숫자 패드가 없음 (텐키리스)',
        각인: '한국어, 영어가 모두 필요해요',
        백라이트: '화려한 RGB가 좋아요',
        키감: '또각또각 (걸림이 있는 느낌)',
      },
      budget: { min: 50_000, max: 200_000 },
    },
    {
      desc: '빈 answers',
      answers: {},
      budget: { min: 0, max: 1_000_000 },
    },
    {
      desc: '상관없음 모든 단계',
      answers: {
        연결방식: '상관없음',
        키감: '잘 모르겠어요',
        각인: '상관없음',
      },
      budget: { min: 0, max: 1_000_000 },
    },
    {
      desc: '유/무선 + 풀배열 + 단색 + 영문각인',
      answers: {
        연결방식: '유/무선 모두',
        크기: '숫자 패드가 있는 일반 키보드 (풀배열)',
        백라이트: '은은한 단색 조명이 좋아요',
        각인: '영어만 적혀있길 바라요',
      },
      budget: { min: 100_000, max: 500_000 },
    },
    {
      desc: '무접점 + 미니 + 백라이트없음',
      answers: {
        키감: '보글보글 (독특한 무접점 느낌)',
        크기: 'F1~F12키도 없는 미니 (60%)',
        백라이트: '없어도 돼요 (배터리 절약)',
      },
      budget: { min: 0, max: 300_000 },
    },
  ];

  cases.forEach(({ desc, answers, budget }) => {
    it(`${desc} -> validateTagSchema 통과`, () => {
      const hardConstraints = guidedAnswersToHardConstraints(answers, budget);
      const validation = validateTagSchema({ hardConstraints, softIntentTags: [] });
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });
});

// ---------------------------------------------------------------------------
// 결정론성: 동일 입력은 항상 동일 출력을 반환
// ---------------------------------------------------------------------------

describe('결정론성 검증', () => {
  it('동일 answers + budget는 항상 동일한 HardConstraints를 반환한다', () => {
    const answers = {
      연결방식: '블루투스',
      크기: '숫자 패드가 없음 (텐키리스)',
      키감: '또각또각 (걸림이 있는 느낌)',
    };
    const budget = { min: 30_000, max: 150_000 };

    const result1 = guidedAnswersToHardConstraints(answers, budget);
    const result2 = guidedAnswersToHardConstraints(answers, budget);
    const result3 = guidedAnswersToHardConstraints(answers, budget);

    expect(result1).toEqual(result2);
    expect(result2).toEqual(result3);
  });

  it('각 매핑 함수는 순수 함수 - 외부 상태에 의존하지 않는다', () => {
    const a1 = mapConnectionToConstraints('블루투스');
    const a2 = mapConnectionToConstraints('블루투스');
    expect(a1).toEqual(a2);

    const b1 = mapLayoutToConstraints('숫자 패드가 없음 (텐키리스)');
    const b2 = mapLayoutToConstraints('숫자 패드가 없음 (텐키리스)');
    expect(b1).toEqual(b2);
  });
});
