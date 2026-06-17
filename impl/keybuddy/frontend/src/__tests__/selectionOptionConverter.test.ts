/**
 * Sub-AC 2-2b: selectionOptionConverter 단위 테스트
 *
 * selectionOptionConverter(answers, budget) 출력을 validateTagSchema에 통과시켜
 * 하드 제약 + 소프트 의도 필드가 모두 포함된 동일 인터페이스를 만족하는지 검증한다.
 *
 * 검증 기준:
 * - 출력이 ExtractedTags 인터페이스(hardConstraints + softIntentTags)를 만족한다
 * - validateTagSchema에 통과한다 (valid: true, errors: [])
 * - hardConstraints 값이 스키마 열거형/숫자 타입을 준수한다
 * - softIntentTags 항목이 모두 SOFT_INTENT_VOCAB에 속한다
 * - 빈 입력, 부분 입력, 전체 입력 모든 경우 통과한다
 * - 동일 입력에 대해 항상 동일 출력을 반환한다 (결정론성)
 * - LLM 호출 없이 동기 순수 함수로 동작한다
 */

import { describe, it, expect } from 'vitest';
import {
  selectionOptionConverter,
  CONNECTION_OPTIONS,
  LAYOUT_OPTIONS,
  ENGRAVING_OPTIONS,
  BACKLIGHT_OPTIONS,
  KEY_FEEL_OPTIONS,
  PURPOSE_OPTIONS,
  PORTABILITY_OPTIONS,
  SOUND_OPTIONS,
  KEY_FORCE_OPTIONS,
} from '../lib/guidedInputMapper';
import { validateTagSchema, SOFT_INTENT_VOCAB } from '../lib/tagSchema';

// ---------------------------------------------------------------------------
// 헬퍼
// ---------------------------------------------------------------------------

const DEFAULT_BUDGET = { min: 0, max: 1_000_000 };

/**
 * selectionOptionConverter 출력을 validateTagSchema에 통과시켜
 * valid: true, errors: [] 임을 단언한다.
 */
function assertPassesSchema(
  answers: Record<string, string>,
  budget = DEFAULT_BUDGET,
) {
  const result = selectionOptionConverter(answers, budget);
  const validation = validateTagSchema(result);
  expect(validation.valid, `검증 실패 (errors: ${validation.errors.join(', ')})`).toBe(true);
  expect(validation.errors).toHaveLength(0);
  return result;
}

// ---------------------------------------------------------------------------
// 기본 구조: 출력에 hardConstraints + softIntentTags 가 항상 존재한다
// ---------------------------------------------------------------------------

describe('selectionOptionConverter - 출력 구조 보장', () => {
  it('빈 answers + 기본 budget -> hardConstraints + softIntentTags 모두 존재', () => {
    const result = selectionOptionConverter({}, DEFAULT_BUDGET);
    expect(result).toHaveProperty('hardConstraints');
    expect(result).toHaveProperty('softIntentTags');
    expect(typeof result.hardConstraints).toBe('object');
    expect(Array.isArray(result.softIntentTags)).toBe(true);
  });

  it('빈 answers -> hardConstraints: {}, softIntentTags: []', () => {
    const result = selectionOptionConverter({}, DEFAULT_BUDGET);
    expect(result.hardConstraints).toEqual({});
    expect(result.softIntentTags).toEqual([]);
  });

  it('알 수 없는 단계 키만 포함된 answers -> 빈 구조 반환', () => {
    const result = selectionOptionConverter(
      { 알수없는단계: '어떤값' },
      DEFAULT_BUDGET,
    );
    expect(result.hardConstraints).toEqual({});
    expect(result.softIntentTags).toEqual([]);
  });

  it('최상위 키는 hardConstraints + softIntentTags 두 가지만 존재한다', () => {
    const result = selectionOptionConverter({ 용도: '사무용' }, DEFAULT_BUDGET);
    const keys = Object.keys(result);
    expect(keys).toContain('hardConstraints');
    expect(keys).toContain('softIntentTags');
    expect(keys).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// validateTagSchema 통과 검증: 빈 입력
// ---------------------------------------------------------------------------

describe('selectionOptionConverter - 빈 입력 validateTagSchema 통과', () => {
  it('빈 answers + 기본 budget -> 스키마 통과', () => {
    assertPassesSchema({}, DEFAULT_BUDGET);
  });

  it('빈 answers + min=0, max=1_000_000 -> 스키마 통과', () => {
    assertPassesSchema({}, { min: 0, max: 1_000_000 });
  });

  it('상관없음/잘 모르겠어요만 있는 answers -> 스키마 통과', () => {
    assertPassesSchema({
      용도: '상관없음',
      휴대성: '상관없음',
      소리: '적당한 소리 (보통)',
      키감: '잘 모르겠어요',
      키압: '잘 모르겠어요',
      연결방식: '상관없음',
      각인: '상관없음',
    });
  });
});

// ---------------------------------------------------------------------------
// validateTagSchema 통과 검증: 하드 제약 단계 단일 입력
// ---------------------------------------------------------------------------

describe('selectionOptionConverter - 하드 제약 단계 단일 입력 스키마 통과', () => {
  it('연결방식: 유선 -> 스키마 통과', () => {
    const result = assertPassesSchema({ 연결방식: CONNECTION_OPTIONS.WIRED });
    expect(result.hardConstraints.connection).toBe('유선');
  });

  it('연결방식: 블루투스 -> 스키마 통과', () => {
    const result = assertPassesSchema({ 연결방식: CONNECTION_OPTIONS.BLUETOOTH });
    expect(result.hardConstraints.connection).toBe('무선');
    expect(result.hardConstraints.wireless_type).toBe('블루투스');
    expect(result.softIntentTags).toContain('무선');
    expect(result.softIntentTags).toContain('멀티페어링');
  });

  it('연결방식: 무선 USB 동글 -> 스키마 통과', () => {
    const result = assertPassesSchema({ 연결방식: CONNECTION_OPTIONS.DONGLE });
    expect(result.hardConstraints.connection).toBe('무선');
    expect(result.hardConstraints.wireless_type).toBe('전용동글(리시버)');
  });

  it('연결방식: 유/무선 모두 -> 스키마 통과', () => {
    const result = assertPassesSchema({ 연결방식: CONNECTION_OPTIONS.BOTH });
    expect(result.hardConstraints.connection).toBe('유선+무선');
  });

  it('크기: 풀배열 -> 스키마 통과', () => {
    const result = assertPassesSchema({ 크기: LAYOUT_OPTIONS.FULL });
    expect(result.hardConstraints.layout).toBe('풀배열');
    expect(result.softIntentTags).toContain('풀배열');
  });

  it('크기: 텐키리스 -> 스키마 통과', () => {
    const result = assertPassesSchema({ 크기: LAYOUT_OPTIONS.TKL });
    expect(result.hardConstraints.layout).toBe('텐키리스');
    expect(result.softIntentTags).toContain('텐키리스');
    expect(result.softIntentTags).toContain('휴대성');
  });

  it('크기: 미니(60%) -> 스키마 통과', () => {
    const result = assertPassesSchema({ 크기: LAYOUT_OPTIONS.MINI });
    expect(result.hardConstraints.layout).toBe('미니');
    expect(result.softIntentTags).toContain('미니');
  });

  it('크기: 1800배열 -> 스키마 통과 (layout 하드 제약 없음)', () => {
    const result = assertPassesSchema({ 크기: LAYOUT_OPTIONS.COMPACT_FULL });
    expect(result.hardConstraints.layout).toBeUndefined();
    expect(result.softIntentTags).toContain('풀배열');
  });

  it('크기: 75%/65% -> 스키마 통과 (layout 하드 제약 없음)', () => {
    for (const layout of [LAYOUT_OPTIONS.SEVENTY_FIVE, LAYOUT_OPTIONS.SIXTY_FIVE]) {
      const result = assertPassesSchema({ 크기: layout });
      expect(result.hardConstraints.layout).toBeUndefined();
      expect(result.softIntentTags).toContain('텐키리스');
    }
  });

  it('각인: 한국어+영어 -> 스키마 통과', () => {
    const result = assertPassesSchema({ 각인: ENGRAVING_OPTIONS.BOTH });
    expect(result.hardConstraints.engraving).toBe('한/영 정각');
    expect(result.softIntentTags).toContain('한영각인');
  });

  it('각인: 영어만 -> 스키마 통과', () => {
    const result = assertPassesSchema({ 각인: ENGRAVING_OPTIONS.ENGLISH_ONLY });
    expect(result.hardConstraints.engraving).toBe('영문 정각');
    expect(result.softIntentTags).toContain('영문각인');
  });

  it('각인: 한국어만 -> 스키마 통과 (engraving 하드 제약 없음)', () => {
    const result = assertPassesSchema({ 각인: ENGRAVING_OPTIONS.KOREAN_ONLY });
    expect(result.hardConstraints.engraving).toBeUndefined();
    expect(result.softIntentTags).toEqual([]);
  });

  it('백라이트: RGB -> 스키마 통과', () => {
    const result = assertPassesSchema({ 백라이트: BACKLIGHT_OPTIONS.RGB });
    expect(result.hardConstraints.backlight).toBe('RGB 백라이트');
    expect(result.softIntentTags).toContain('RGB');
    expect(result.softIntentTags).toContain('백라이트');
  });

  it('백라이트: 단색 -> 스키마 통과', () => {
    const result = assertPassesSchema({ 백라이트: BACKLIGHT_OPTIONS.MONO });
    expect(result.hardConstraints.backlight).toBe('단색 백라이트');
    expect(result.softIntentTags).toContain('백라이트');
  });

  it('백라이트: 없음 -> 스키마 통과', () => {
    const result = assertPassesSchema({ 백라이트: BACKLIGHT_OPTIONS.NONE });
    expect(result.hardConstraints.backlight).toBe('없음');
    expect(result.softIntentTags).toContain('백라이트없음');
  });

  it('키감: 또각또각 -> 스키마 통과 (하드+소프트 동시)', () => {
    const result = assertPassesSchema({ 키감: KEY_FEEL_OPTIONS.TACTILE });
    expect(result.hardConstraints.switch_type).toBe('기계식');
    expect(result.softIntentTags).toContain('기계식');
    expect(result.softIntentTags).toContain('타건감');
    expect(result.softIntentTags).toContain('경쾌함');
  });

  it('키감: 서걱서걱 -> 스키마 통과', () => {
    const result = assertPassesSchema({ 키감: KEY_FEEL_OPTIONS.LINEAR });
    expect(result.hardConstraints.switch_type).toBe('기계식');
    expect(result.softIntentTags).toContain('기계식');
    expect(result.softIntentTags).toContain('타건감');
  });

  it('키감: 보글보글 -> 스키마 통과 (switch_type: 무접점)', () => {
    const result = assertPassesSchema({ 키감: KEY_FEEL_OPTIONS.TOPRE });
    expect(result.hardConstraints.switch_type).toBe('무접점');
    expect(result.softIntentTags).toContain('무접점');
    expect(result.softIntentTags).toContain('조용함');
  });
});

// ---------------------------------------------------------------------------
// validateTagSchema 통과 검증: 소프트 전용 단계 입력
// ---------------------------------------------------------------------------

describe('selectionOptionConverter - 소프트 전용 단계 입력 스키마 통과', () => {
  it('용도: 사무용 -> 스키마 통과', () => {
    const result = assertPassesSchema({ 용도: PURPOSE_OPTIONS.OFFICE });
    expect(result.hardConstraints).toEqual({});
    expect(result.softIntentTags).toContain('사무용');
  });

  it('용도: 게임용 -> 스키마 통과', () => {
    const result = assertPassesSchema({ 용도: PURPOSE_OPTIONS.GAMING });
    expect(result.hardConstraints).toEqual({});
    expect(result.softIntentTags).toContain('게이밍');
  });

  it('휴대성: 자주 가지고 다닐래요 -> 스키마 통과', () => {
    const result = assertPassesSchema({ 휴대성: PORTABILITY_OPTIONS.PORTABLE });
    expect(result.softIntentTags).toContain('휴대성');
    expect(result.softIntentTags).toContain('가벼움');
  });

  it('소리: 조용해야 해요 -> 스키마 통과', () => {
    const result = assertPassesSchema({ 소리: SOUND_OPTIONS.VERY_QUIET });
    expect(result.softIntentTags).toContain('조용함');
    expect(result.softIntentTags).toContain('저소음');
  });

  it('소리: 타건감 위주 -> 스키마 통과', () => {
    const result = assertPassesSchema({ 소리: SOUND_OPTIONS.LOUD });
    expect(result.softIntentTags).toContain('타건감');
    expect(result.softIntentTags).toContain('고소음');
    expect(result.softIntentTags).toContain('경쾌함');
  });

  it('키압: 가볍게 -> 스키마 통과', () => {
    const result = assertPassesSchema({ 키압: KEY_FORCE_OPTIONS.LIGHT });
    expect(result.softIntentTags).toContain('저소음');
  });

  it('키압: 묵직하게 -> 스키마 통과', () => {
    const result = assertPassesSchema({ 키압: KEY_FORCE_OPTIONS.HEAVY });
    expect(result.softIntentTags).toContain('타건감');
  });
});

// ---------------------------------------------------------------------------
// validateTagSchema 통과 검증: 예산(budget) 입력
// ---------------------------------------------------------------------------

describe('selectionOptionConverter - 예산 입력 스키마 통과', () => {
  it('min=0, max=100_000 -> 스키마 통과, price_max=100_000', () => {
    const result = assertPassesSchema({}, { min: 0, max: 100_000 });
    expect(result.hardConstraints.price_max).toBe(100_000);
    expect(result.hardConstraints.price_min).toBeUndefined();
  });

  it('min=50_000, max=200_000 -> 스키마 통과, price_min+price_max 모두 설정', () => {
    const result = assertPassesSchema({}, { min: 50_000, max: 200_000 });
    expect(result.hardConstraints.price_min).toBe(50_000);
    expect(result.hardConstraints.price_max).toBe(200_000);
  });

  it('min=0, max=1_000_000 -> 스키마 통과, 가격 제약 없음', () => {
    const result = assertPassesSchema({}, { min: 0, max: 1_000_000 });
    expect(result.hardConstraints.price_min).toBeUndefined();
    expect(result.hardConstraints.price_max).toBeUndefined();
  });

  it('min=30_000, max=1_000_000 -> 스키마 통과, price_min만 설정', () => {
    const result = assertPassesSchema({}, { min: 30_000, max: 1_000_000 });
    expect(result.hardConstraints.price_min).toBe(30_000);
    expect(result.hardConstraints.price_max).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// validateTagSchema 통과 검증: 복합 입력 (하드 + 소프트 동시)
// ---------------------------------------------------------------------------

describe('selectionOptionConverter - 복합 입력 스키마 통과', () => {
  it('전체 단계 입력 (사무용 시나리오) -> 스키마 통과', () => {
    const result = assertPassesSchema(
      {
        용도: PURPOSE_OPTIONS.OFFICE,
        휴대성: PORTABILITY_OPTIONS.DESK,
        소리: SOUND_OPTIONS.VERY_QUIET,
        키감: KEY_FEEL_OPTIONS.TOPRE,
        키압: KEY_FORCE_OPTIONS.LIGHT,
        연결방식: CONNECTION_OPTIONS.WIRED,
        크기: LAYOUT_OPTIONS.TKL,
        각인: ENGRAVING_OPTIONS.BOTH,
        백라이트: BACKLIGHT_OPTIONS.NONE,
      },
      { min: 50_000, max: 200_000 },
    );
    // 하드 제약 확인
    expect(result.hardConstraints.switch_type).toBe('무접점');
    expect(result.hardConstraints.connection).toBe('유선');
    expect(result.hardConstraints.layout).toBe('텐키리스');
    expect(result.hardConstraints.engraving).toBe('한/영 정각');
    expect(result.hardConstraints.backlight).toBe('없음');
    expect(result.hardConstraints.price_min).toBe(50_000);
    expect(result.hardConstraints.price_max).toBe(200_000);
    // 소프트 태그 확인
    expect(result.softIntentTags).toContain('사무용');
    expect(result.softIntentTags).toContain('조용함');
    expect(result.softIntentTags).toContain('저소음');
    expect(result.softIntentTags).toContain('무접점');
    expect(result.softIntentTags).toContain('텐키리스');
    expect(result.softIntentTags).toContain('한영각인');
    expect(result.softIntentTags).toContain('백라이트없음');
  });

  it('전체 단계 입력 (게이밍 시나리오) -> 스키마 통과', () => {
    const result = assertPassesSchema(
      {
        용도: PURPOSE_OPTIONS.GAMING,
        휴대성: PORTABILITY_OPTIONS.DESK,
        소리: SOUND_OPTIONS.LOUD,
        키감: KEY_FEEL_OPTIONS.TACTILE,
        키압: KEY_FORCE_OPTIONS.HEAVY,
        연결방식: CONNECTION_OPTIONS.WIRED,
        크기: LAYOUT_OPTIONS.FULL,
        각인: ENGRAVING_OPTIONS.ENGLISH_ONLY,
        백라이트: BACKLIGHT_OPTIONS.RGB,
      },
      { min: 100_000, max: 500_000 },
    );
    expect(result.hardConstraints.switch_type).toBe('기계식');
    expect(result.hardConstraints.layout).toBe('풀배열');
    expect(result.hardConstraints.backlight).toBe('RGB 백라이트');
    expect(result.softIntentTags).toContain('게이밍');
    expect(result.softIntentTags).toContain('RGB');
    expect(result.softIntentTags).toContain('타건감');
    expect(result.softIntentTags).toContain('경쾌함');
  });

  it('전체 단계 입력 (휴대용 무선 시나리오) -> 스키마 통과', () => {
    const result = assertPassesSchema(
      {
        용도: PURPOSE_OPTIONS.OFFICE,
        휴대성: PORTABILITY_OPTIONS.PORTABLE,
        소리: SOUND_OPTIONS.QUIET,
        키감: KEY_FEEL_OPTIONS.UNKNOWN,
        키압: KEY_FORCE_OPTIONS.LIGHT,
        연결방식: CONNECTION_OPTIONS.BLUETOOTH,
        크기: LAYOUT_OPTIONS.MINI,
        각인: ENGRAVING_OPTIONS.ANY,
        백라이트: BACKLIGHT_OPTIONS.NONE,
      },
      { min: 0, max: 150_000 },
    );
    expect(result.hardConstraints.connection).toBe('무선');
    expect(result.hardConstraints.wireless_type).toBe('블루투스');
    expect(result.hardConstraints.layout).toBe('미니');
    expect(result.softIntentTags).toContain('무선');
    expect(result.softIntentTags).toContain('멀티페어링');
    expect(result.softIntentTags).toContain('휴대성');
    expect(result.softIntentTags).toContain('가벼움');
    expect(result.softIntentTags).toContain('미니');
    expect(result.softIntentTags).toContain('사무용');
    expect(result.softIntentTags).toContain('저소음');
  });

  it('블루투스 + 미니 + 소리 조용함 -> 스키마 통과', () => {
    assertPassesSchema({
      연결방식: CONNECTION_OPTIONS.BLUETOOTH,
      크기: LAYOUT_OPTIONS.MINI,
      소리: SOUND_OPTIONS.VERY_QUIET,
    });
  });

  it('유/무선 모두 + 풀배열 + 단색 + 영문각인 -> 스키마 통과', () => {
    const result = assertPassesSchema(
      {
        연결방식: CONNECTION_OPTIONS.BOTH,
        크기: LAYOUT_OPTIONS.FULL,
        백라이트: BACKLIGHT_OPTIONS.MONO,
        각인: ENGRAVING_OPTIONS.ENGLISH_ONLY,
      },
      { min: 100_000, max: 500_000 },
    );
    expect(result.hardConstraints.connection).toBe('유선+무선');
    expect(result.hardConstraints.backlight).toBe('단색 백라이트');
    expect(result.hardConstraints.engraving).toBe('영문 정각');
  });
});

// ---------------------------------------------------------------------------
// ExtractedTags 인터페이스 동일성: 자유형과 동일 인터페이스 만족
// ---------------------------------------------------------------------------

describe('selectionOptionConverter - ExtractedTags 인터페이스 만족', () => {
  it('hardConstraints는 객체 타입이다', () => {
    const result = selectionOptionConverter({}, DEFAULT_BUDGET);
    expect(typeof result.hardConstraints).toBe('object');
    expect(result.hardConstraints).not.toBeNull();
    expect(Array.isArray(result.hardConstraints)).toBe(false);
  });

  it('softIntentTags는 배열 타입이다', () => {
    const result = selectionOptionConverter({}, DEFAULT_BUDGET);
    expect(Array.isArray(result.softIntentTags)).toBe(true);
  });

  it('softIntentTags 항목이 모두 SOFT_INTENT_VOCAB에 속한다 - 사무용 시나리오', () => {
    const result = selectionOptionConverter(
      {
        용도: '사무용',
        소리: '조용해야 해요 (매우 낮음)',
        키감: '보글보글 (독특한 무접점 느낌)',
        연결방식: '블루투스',
      },
      DEFAULT_BUDGET,
    );
    const vocab = new Set(SOFT_INTENT_VOCAB);
    result.softIntentTags.forEach((tag) => {
      expect(vocab.has(tag as (typeof SOFT_INTENT_VOCAB)[number])).toBe(true);
    });
  });

  it('softIntentTags 항목이 모두 SOFT_INTENT_VOCAB에 속한다 - 게이밍 전체 단계', () => {
    const result = selectionOptionConverter(
      {
        용도: PURPOSE_OPTIONS.GAMING,
        휴대성: PORTABILITY_OPTIONS.PORTABLE,
        소리: SOUND_OPTIONS.LOUD,
        키감: KEY_FEEL_OPTIONS.TACTILE,
        키압: KEY_FORCE_OPTIONS.HEAVY,
        크기: LAYOUT_OPTIONS.MINI,
        연결방식: CONNECTION_OPTIONS.DONGLE,
        백라이트: BACKLIGHT_OPTIONS.RGB,
        각인: ENGRAVING_OPTIONS.ENGLISH_ONLY,
      },
      { min: 50_000, max: 300_000 },
    );
    const vocab = new Set(SOFT_INTENT_VOCAB);
    result.softIntentTags.forEach((tag) => {
      expect(vocab.has(tag as (typeof SOFT_INTENT_VOCAB)[number])).toBe(true);
    });
  });

  it('softIntentTags에 중복 태그가 없다', () => {
    const result = selectionOptionConverter(
      {
        휴대성: PORTABILITY_OPTIONS.PORTABLE,
        크기: LAYOUT_OPTIONS.TKL,
        소리: SOUND_OPTIONS.VERY_QUIET,
        키감: KEY_FEEL_OPTIONS.TOPRE,
      },
      DEFAULT_BUDGET,
    );
    const unique = new Set(result.softIntentTags);
    expect(result.softIntentTags).toHaveLength(unique.size);
  });

  it('하드 제약 열거형 값이 스키마 허용 값이다 (validateTagSchema 통과로 확인)', () => {
    // 모든 하드 제약 열거형 선택지 조합 검증
    const cases = [
      { 연결방식: CONNECTION_OPTIONS.WIRED },
      { 연결방식: CONNECTION_OPTIONS.BLUETOOTH },
      { 연결방식: CONNECTION_OPTIONS.DONGLE },
      { 연결방식: CONNECTION_OPTIONS.BOTH },
      { 크기: LAYOUT_OPTIONS.FULL },
      { 크기: LAYOUT_OPTIONS.TKL },
      { 크기: LAYOUT_OPTIONS.MINI },
      { 각인: ENGRAVING_OPTIONS.BOTH },
      { 각인: ENGRAVING_OPTIONS.ENGLISH_ONLY },
      { 백라이트: BACKLIGHT_OPTIONS.RGB },
      { 백라이트: BACKLIGHT_OPTIONS.MONO },
      { 백라이트: BACKLIGHT_OPTIONS.NONE },
      { 키감: KEY_FEEL_OPTIONS.TACTILE },
      { 키감: KEY_FEEL_OPTIONS.LINEAR },
      { 키감: KEY_FEEL_OPTIONS.TOPRE },
    ];

    for (const answers of cases) {
      const result = selectionOptionConverter(answers as unknown as Record<string, string>, DEFAULT_BUDGET);
      const validation = validateTagSchema(result);
      expect(
        validation.valid,
        `${JSON.stringify(answers)} 스키마 통과 실패: ${validation.errors.join(', ')}`,
      ).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// validateTagSchema 통과 검증: 연속 시나리오 테이블
// ---------------------------------------------------------------------------

describe('selectionOptionConverter - 대표 시나리오 validateTagSchema 통과', () => {
  const scenarios: Array<{
    desc: string;
    answers: Record<string, string>;
    budget: { min: number; max: number };
  }> = [
    {
      desc: '빈 입력',
      answers: {},
      budget: DEFAULT_BUDGET,
    },
    {
      desc: '사무용 조용한 유선 텐키리스',
      answers: {
        용도: PURPOSE_OPTIONS.OFFICE,
        소리: SOUND_OPTIONS.VERY_QUIET,
        연결방식: CONNECTION_OPTIONS.WIRED,
        크기: LAYOUT_OPTIONS.TKL,
      },
      budget: { min: 50_000, max: 200_000 },
    },
    {
      desc: '게이밍 무선 풀배열 RGB',
      answers: {
        용도: PURPOSE_OPTIONS.GAMING,
        연결방식: CONNECTION_OPTIONS.DONGLE,
        크기: LAYOUT_OPTIONS.FULL,
        백라이트: BACKLIGHT_OPTIONS.RGB,
        키감: KEY_FEEL_OPTIONS.TACTILE,
      },
      budget: { min: 100_000, max: 500_000 },
    },
    {
      desc: '휴대용 블루투스 미니 백라이트없음',
      answers: {
        휴대성: PORTABILITY_OPTIONS.PORTABLE,
        연결방식: CONNECTION_OPTIONS.BLUETOOTH,
        크기: LAYOUT_OPTIONS.MINI,
        백라이트: BACKLIGHT_OPTIONS.NONE,
      },
      budget: { min: 0, max: 100_000 },
    },
    {
      desc: '무접점 텐키리스 단색 한영각인',
      answers: {
        키감: KEY_FEEL_OPTIONS.TOPRE,
        크기: LAYOUT_OPTIONS.TKL,
        백라이트: BACKLIGHT_OPTIONS.MONO,
        각인: ENGRAVING_OPTIONS.BOTH,
      },
      budget: { min: 150_000, max: 400_000 },
    },
    {
      desc: '유무선 겸용 1800배열 (하드 layout 없음)',
      answers: {
        연결방식: CONNECTION_OPTIONS.BOTH,
        크기: LAYOUT_OPTIONS.COMPACT_FULL,
        용도: PURPOSE_OPTIONS.OFFICE,
      },
      budget: DEFAULT_BUDGET,
    },
    {
      desc: '경쾌한 소리 + 묵직한 키압 + 영문각인',
      answers: {
        소리: SOUND_OPTIONS.CRISPY,
        키압: KEY_FORCE_OPTIONS.HEAVY,
        각인: ENGRAVING_OPTIONS.ENGLISH_ONLY,
      },
      budget: { min: 0, max: 300_000 },
    },
    {
      desc: '모든 단계 상관없음/잘 모르겠어요',
      answers: {
        용도: PURPOSE_OPTIONS.ANY,
        휴대성: PORTABILITY_OPTIONS.ANY,
        소리: SOUND_OPTIONS.NORMAL,
        키감: KEY_FEEL_OPTIONS.UNKNOWN,
        키압: KEY_FORCE_OPTIONS.UNKNOWN,
        연결방식: CONNECTION_OPTIONS.ANY,
        각인: ENGRAVING_OPTIONS.ANY,
      },
      budget: DEFAULT_BUDGET,
    },
  ];

  scenarios.forEach(({ desc, answers, budget }) => {
    it(`${desc} -> validateTagSchema 통과`, () => {
      assertPassesSchema(answers, budget);
    });
  });
});

// ---------------------------------------------------------------------------
// 결정론성: 동일 입력 -> 항상 동일 출력
// ---------------------------------------------------------------------------

describe('selectionOptionConverter - 결정론성', () => {
  it('동일 answers + budget -> 항상 동일 ExtractedTags 반환', () => {
    const answers = {
      용도: PURPOSE_OPTIONS.OFFICE,
      연결방식: CONNECTION_OPTIONS.BLUETOOTH,
      크기: LAYOUT_OPTIONS.TKL,
      백라이트: BACKLIGHT_OPTIONS.NONE,
    };
    const budget = { min: 50_000, max: 200_000 };

    const r1 = selectionOptionConverter(answers, budget);
    const r2 = selectionOptionConverter(answers, budget);
    const r3 = selectionOptionConverter(answers, budget);

    expect(r1).toEqual(r2);
    expect(r2).toEqual(r3);
  });

  it('동일 빈 입력 -> 항상 동일 빈 구조 반환', () => {
    const r1 = selectionOptionConverter({}, DEFAULT_BUDGET);
    const r2 = selectionOptionConverter({}, DEFAULT_BUDGET);
    expect(r1).toEqual(r2);
  });

  it('hardConstraints는 결정론적 필터 값이다', () => {
    const answers = { 연결방식: CONNECTION_OPTIONS.BLUETOOTH };
    const r1 = selectionOptionConverter(answers, DEFAULT_BUDGET);
    const r2 = selectionOptionConverter(answers, DEFAULT_BUDGET);
    expect(r1.hardConstraints).toEqual(r2.hardConstraints);
  });

  it('softIntentTags는 결정론적 태그 배열이다', () => {
    const answers = {
      용도: PURPOSE_OPTIONS.GAMING,
      소리: SOUND_OPTIONS.LOUD,
      키감: KEY_FEEL_OPTIONS.TACTILE,
    };
    const r1 = selectionOptionConverter(answers, DEFAULT_BUDGET);
    const r2 = selectionOptionConverter(answers, DEFAULT_BUDGET);
    expect(r1.softIntentTags).toEqual(r2.softIntentTags);
  });
});

// ---------------------------------------------------------------------------
// LLM 호출 없이 동기 순수 함수
// ---------------------------------------------------------------------------

describe('selectionOptionConverter - LLM 호출 없이 동기 순수 함수', () => {
  it('Promise를 반환하지 않는다', () => {
    const result = selectionOptionConverter({ 용도: '사무용' }, DEFAULT_BUDGET);
    expect(result).not.toBeInstanceOf(Promise);
  });

  it('동기적으로 즉시 반환된다', () => {
    // 비동기 함수라면 then()이 있어야 하지만, 동기 함수이므로 then이 없다
    const result = selectionOptionConverter(
      { 연결방식: CONNECTION_OPTIONS.BLUETOOTH, 크기: LAYOUT_OPTIONS.MINI },
      { min: 50_000, max: 200_000 },
    );
    // then 메서드가 없으므로 Promise가 아님
    expect(typeof (result as unknown as { then?: unknown }).then).not.toBe('function');
    expect(typeof result.hardConstraints).toBe('object');
    expect(Array.isArray(result.softIntentTags)).toBe(true);
  });

  it('10단계 전체 입력도 동기 반환된다', () => {
    const result = selectionOptionConverter(
      {
        용도: PURPOSE_OPTIONS.GAMING,
        휴대성: PORTABILITY_OPTIONS.PORTABLE,
        소리: SOUND_OPTIONS.LOUD,
        키감: KEY_FEEL_OPTIONS.TACTILE,
        키압: KEY_FORCE_OPTIONS.HEAVY,
        연결방식: CONNECTION_OPTIONS.DONGLE,
        크기: LAYOUT_OPTIONS.TKL,
        각인: ENGRAVING_OPTIONS.ENGLISH_ONLY,
        백라이트: BACKLIGHT_OPTIONS.RGB,
      },
      { min: 80_000, max: 300_000 },
    );
    expect(result).not.toBeInstanceOf(Promise);
    expect(result.hardConstraints).toBeDefined();
    expect(result.softIntentTags).toBeDefined();
  });
});
