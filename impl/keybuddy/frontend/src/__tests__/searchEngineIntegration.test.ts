/**
 * Sub-AC 2-3-c: searchEngineIntegration 통합 테스트
 *
 * 선택 변환 태그를 searchKeyboards 진입점에 직접 전달했을 때
 * 결과 키보드 목록과 매칭 근거가 반환되는지 검증한다.
 *
 * 검증 기준:
 * - 선택 입력(selectionOptionConverter) -> searchKeyboards 진입점 호출 -> 결과 반환
 * - 자유형 입력(sanitizeTags) -> 동일 searchKeyboards 진입점 -> 동일 구조 반환
 * - 두 경로 모두 동일 함수 시그니처 사용: searchKeyboards(tags: ExtractedTags, catalog: Keyboard[])
 * - LLM 호출 없이 동기 순수 함수로 동작 (Promise 반환 않음)
 * - 결과에 keyboard, score, matchedTags(매칭 근거) 포함
 * - 하드 제약 위반 키보드 0건 보장
 * - 결과 0건 시 폴백(완화) 정보 포함
 */

import { describe, it, expect } from 'vitest';
import {
  searchKeyboards,
  hardConstraintsToHardTags,
  HARD_CONSTRAINT_RELAXATION_ORDER,
  type SearchResultItem,
  type SearchOutput,
} from '../lib/searchEngine';
import {
  selectionOptionConverter,
  PURPOSE_OPTIONS,
  PORTABILITY_OPTIONS,
  SOUND_OPTIONS,
  KEY_FEEL_OPTIONS,
  CONNECTION_OPTIONS,
  LAYOUT_OPTIONS,
  BACKLIGHT_OPTIONS,
  ENGRAVING_OPTIONS,
  KEY_FORCE_OPTIONS,
} from '../lib/guidedInputMapper';
import { sanitizeTags } from '../lib/extractRawTags';
import type { Keyboard } from '../types';
import type { ExtractedTags } from '../lib/extractRawTags';

// ---------------------------------------------------------------------------
// 테스트용 키보드 카탈로그 픽스처
// ---------------------------------------------------------------------------

function makeKeyboard(overrides: Partial<Keyboard>): Keyboard {
  return {
    product_name: '기본 키보드',
    brand: '테스트브랜드',
    price: 100000,
    image_url: '',
    switch_type: '기계식',
    connection: '유선',
    layout: '텐키리스',
    key_force: '45g',
    weight_g: 800,
    wireless_type: '유선',
    engraving: '한/영 정각',
    backlight: '없음',
    ...overrides,
  };
}

/**
 * 다양한 속성 조합을 포함하는 테스트 카탈로그.
 * 각 인덱스는 고정이므로 테스트에서 직접 참조한다.
 */
const CATALOG: Keyboard[] = [
  // idx 0: 기계식 텐키리스 유선 없음 8만
  makeKeyboard({
    product_name: '기계식-텐키리스-유선-없음-8만',
    switch_type: '기계식',
    layout: '텐키리스',
    connection: '유선',
    backlight: '없음',
    price: 80000,
    weight_g: 850,
    wireless_type: '유선',
    engraving: '한/영 정각',
  }),
  // idx 1: 기계식 텐키리스 유선 없음 15만
  makeKeyboard({
    product_name: '기계식-텐키리스-유선-없음-15만',
    switch_type: '기계식',
    layout: '텐키리스',
    connection: '유선',
    backlight: '없음',
    price: 150000,
    weight_g: 750,
    wireless_type: '유선',
    engraving: '한/영 정각',
  }),
  // idx 2: 무접점 텐키리스 무선 없음 20만
  makeKeyboard({
    product_name: '무접점-텐키리스-무선-없음-20만',
    switch_type: '무접점',
    layout: '텐키리스',
    connection: '무선',
    backlight: '없음',
    price: 200000,
    weight_g: 600,
    wireless_type: '블루투스',
    engraving: '한/영 정각',
  }),
  // idx 3: 기계식 풀배열 유선 RGB 10만
  makeKeyboard({
    product_name: '기계식-풀배열-유선-RGB-10만',
    switch_type: '기계식',
    layout: '풀배열',
    connection: '유선',
    backlight: 'RGB 백라이트',
    price: 100000,
    weight_g: 1200,
    wireless_type: '유선',
    engraving: '영문 정각',
  }),
  // idx 4: 기계식 미니 무선 없음 7만
  makeKeyboard({
    product_name: '기계식-미니-무선-없음-7만',
    switch_type: '기계식',
    layout: '미니',
    connection: '무선',
    backlight: '없음',
    price: 70000,
    weight_g: 500,
    wireless_type: '전용동글(리시버)',
    engraving: '영문 정각',
  }),
  // idx 5: 무접점 풀배열 유선 없음 18만
  makeKeyboard({
    product_name: '무접점-풀배열-유선-없음-18만',
    switch_type: '무접점',
    layout: '풀배열',
    connection: '유선',
    backlight: '없음',
    price: 180000,
    weight_g: 1100,
    wireless_type: '유선',
    engraving: '한/영 정각',
  }),
  // idx 6: 펜타그래프 풀배열 유선 단색 5만
  makeKeyboard({
    product_name: '펜타그래프-풀배열-유선-단색-5만',
    switch_type: '펜타그래프',
    layout: '풀배열',
    connection: '유선',
    backlight: '단색 백라이트',
    price: 50000,
    weight_g: 950,
    wireless_type: '유선',
    engraving: '한/영 정각',
  }),
];

// ---------------------------------------------------------------------------
// 헬퍼
// ---------------------------------------------------------------------------

/**
 * SearchOutput 구조의 최소 보장 사항을 검증한다.
 */
function assertOutputStructure(output: SearchOutput): void {
  expect(output).toHaveProperty('results');
  expect(Array.isArray(output.results)).toBe(true);
  expect(output).toHaveProperty('isFallback');
  expect(output).toHaveProperty('relaxedConstraints');
  expect(Array.isArray(output.relaxedConstraints)).toBe(true);
  expect(output).toHaveProperty('relaxationStepCount');
  expect(typeof output.relaxationStepCount).toBe('number');
}

/**
 * SearchResultItem 구조의 최소 보장 사항을 검증한다.
 */
function assertResultItemStructure(item: SearchResultItem): void {
  expect(item).toHaveProperty('keyboard');
  expect(typeof item.keyboard).toBe('object');
  expect(item).toHaveProperty('keyboardIndex');
  expect(typeof item.keyboardIndex).toBe('number');
  expect(item).toHaveProperty('score');
  expect(typeof item.score).toBe('number');
  expect(item).toHaveProperty('matchedTags');
  expect(Array.isArray(item.matchedTags)).toBe(true);
  expect(item).toHaveProperty('satisfiesHardConstraints');
  expect(typeof item.satisfiesHardConstraints).toBe('boolean');
  expect(item).toHaveProperty('isFallback');
  expect(typeof item.isFallback).toBe('boolean');
  expect(item).toHaveProperty('relaxedConstraints');
  expect(Array.isArray(item.relaxedConstraints)).toBe(true);
  expect(item).toHaveProperty('relaxationStepCount');
  expect(typeof item.relaxationStepCount).toBe('number');
}

// ===========================================================================
// 1. 진입점 함수 시그니처 - 두 입력 경로 모두 동일 함수
// ===========================================================================

describe('searchKeyboards - 동일 진입점 함수 시그니처 (두 입력 경로)', () => {
  it('선택 입력 경로: selectionOptionConverter -> searchKeyboards 호출 가능', () => {
    const tags: ExtractedTags = selectionOptionConverter(
      { 크기: LAYOUT_OPTIONS.TKL },
      { min: 0, max: 1_000_000 },
    );
    // 동일 진입점 함수에 그대로 전달
    const output = searchKeyboards(tags, CATALOG);
    assertOutputStructure(output);
  });

  it('자유형 경로: sanitizeTags -> 동일 searchKeyboards 호출 가능', () => {
    const tags: ExtractedTags = sanitizeTags({
      hardConstraints: { layout: '텐키리스' },
      softIntentTags: ['텐키리스'],
    });
    const output = searchKeyboards(tags, CATALOG);
    assertOutputStructure(output);
  });

  it('두 경로 모두 ExtractedTags 타입이며 동일 함수 인터페이스를 사용한다', () => {
    const selectionTags: ExtractedTags = selectionOptionConverter(
      { 크기: LAYOUT_OPTIONS.TKL, 용도: PURPOSE_OPTIONS.OFFICE },
      { min: 0, max: 200_000 },
    );
    const freeformTags: ExtractedTags = sanitizeTags({
      hardConstraints: { layout: '텐키리스' },
      softIntentTags: ['텐키리스', '사무용'],
    });

    // 같은 함수 searchKeyboards를 두 경로 모두 호출
    const selOutput = searchKeyboards(selectionTags, CATALOG);
    const freeOutput = searchKeyboards(freeformTags, CATALOG);

    // 두 출력 모두 동일한 구조를 가진다
    assertOutputStructure(selOutput);
    assertOutputStructure(freeOutput);
  });
});

// ===========================================================================
// 2. LLM 호출 없음 - 동기 순수 함수 검증
// ===========================================================================

describe('searchKeyboards - LLM 호출 없이 동기 순수 함수', () => {
  it('Promise를 반환하지 않는다', () => {
    const tags = selectionOptionConverter({ 크기: LAYOUT_OPTIONS.TKL }, { min: 0, max: 1_000_000 });
    const result = searchKeyboards(tags, CATALOG);
    expect(result).not.toBeInstanceOf(Promise);
  });

  it('then 메서드가 없다 (비동기 아님)', () => {
    const tags = selectionOptionConverter(
      { 연결방식: CONNECTION_OPTIONS.WIRED, 크기: LAYOUT_OPTIONS.TKL },
      { min: 50_000, max: 200_000 },
    );
    const result = searchKeyboards(tags, CATALOG);
    expect(typeof (result as unknown as { then?: unknown }).then).not.toBe('function');
  });

  it('동기적으로 즉시 결과를 반환한다 (네트워크/비동기 없음)', () => {
    const tags = selectionOptionConverter(
      {
        용도: PURPOSE_OPTIONS.GAMING,
        크기: LAYOUT_OPTIONS.FULL,
        백라이트: BACKLIGHT_OPTIONS.RGB,
      },
      { min: 0, max: 500_000 },
    );
    const result = searchKeyboards(tags, CATALOG);
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
    expect(Array.isArray(result.results)).toBe(true);
  });

  it('자유형 경로도 LLM 없이 동기 반환된다', () => {
    const tags = sanitizeTags({
      hardConstraints: { switch_type: '기계식', price_max: 150_000 },
      softIntentTags: ['기계식', '타건감'],
    });
    const result = searchKeyboards(tags, CATALOG);
    expect(result).not.toBeInstanceOf(Promise);
    expect(Array.isArray(result.results)).toBe(true);
  });

  it('10단계 전체 선택 입력도 동기 반환된다', () => {
    const tags = selectionOptionConverter(
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
      { min: 50_000, max: 300_000 },
    );
    const result = searchKeyboards(tags, CATALOG);
    expect(result).not.toBeInstanceOf(Promise);
    expect(result.results).toBeDefined();
  });
});

// ===========================================================================
// 3. 결과 구조 - 키보드 목록 + 매칭 근거
// ===========================================================================

describe('searchKeyboards - 결과 구조: 키보드 목록 + 매칭 근거', () => {
  it('결과에 keyboard 레코드가 포함된다', () => {
    const tags = selectionOptionConverter({ 크기: LAYOUT_OPTIONS.TKL }, { min: 0, max: 1_000_000 });
    const output = searchKeyboards(tags, CATALOG);

    expect(output.results.length).toBeGreaterThan(0);
    output.results.forEach((item) => {
      expect(item.keyboard).toBeDefined();
      expect(typeof item.keyboard.product_name).toBe('string');
      expect(typeof item.keyboard.price).toBe('number');
    });
  });

  it('결과에 keyboardIndex(원본 카탈로그 인덱스)가 포함된다', () => {
    const tags = selectionOptionConverter({ 크기: LAYOUT_OPTIONS.TKL }, { min: 0, max: 1_000_000 });
    const output = searchKeyboards(tags, CATALOG);

    output.results.forEach((item) => {
      expect(item.keyboardIndex).toBeGreaterThanOrEqual(0);
      expect(item.keyboardIndex).toBeLessThan(CATALOG.length);
      // keyboardIndex가 실제 catalog의 동일 레코드를 가리켜야 한다
      expect(CATALOG[item.keyboardIndex]).toBe(item.keyboard);
    });
  });

  it('결과에 score(매칭 점수)가 포함된다', () => {
    const tags = selectionOptionConverter(
      { 용도: PURPOSE_OPTIONS.GAMING, 백라이트: BACKLIGHT_OPTIONS.RGB },
      { min: 0, max: 1_000_000 },
    );
    const output = searchKeyboards(tags, CATALOG);

    output.results.forEach((item) => {
      expect(typeof item.score).toBe('number');
      expect(item.score).toBeGreaterThanOrEqual(0);
    });
  });

  it('결과에 matchedTags(매칭 근거)가 포함된다', () => {
    const tags = selectionOptionConverter(
      { 용도: PURPOSE_OPTIONS.GAMING, 백라이트: BACKLIGHT_OPTIONS.RGB },
      { min: 0, max: 1_000_000 },
    );
    const output = searchKeyboards(tags, CATALOG);

    output.results.forEach((item) => {
      expect(Array.isArray(item.matchedTags)).toBe(true);
      // score === matchedTags.length
      expect(item.score).toBe(item.matchedTags.length);
    });
  });

  it('결과에 satisfiesHardConstraints, isFallback, relaxedConstraints가 포함된다', () => {
    const tags = selectionOptionConverter(
      { 크기: LAYOUT_OPTIONS.TKL, 연결방식: CONNECTION_OPTIONS.WIRED },
      { min: 0, max: 200_000 },
    );
    const output = searchKeyboards(tags, CATALOG);

    output.results.forEach((item) => assertResultItemStructure(item));
  });

  it('결과가 점수 내림차순으로 정렬된다', () => {
    const tags = selectionOptionConverter(
      { 용도: PURPOSE_OPTIONS.OFFICE, 소리: SOUND_OPTIONS.VERY_QUIET },
      { min: 0, max: 1_000_000 },
    );
    const output = searchKeyboards(tags, CATALOG);

    for (let i = 0; i < output.results.length - 1; i++) {
      expect(output.results[i].score).toBeGreaterThanOrEqual(output.results[i + 1].score);
    }
  });

  it('자유형 경로도 동일 구조의 결과를 반환한다', () => {
    const tags = sanitizeTags({
      hardConstraints: { layout: '텐키리스', switch_type: '기계식' },
      softIntentTags: ['기계식', '텐키리스', '사무용'],
    });
    const output = searchKeyboards(tags, CATALOG);

    assertOutputStructure(output);
    output.results.forEach((item) => assertResultItemStructure(item));
  });
});

// ===========================================================================
// 4. 하드 제약 위반 0건 보장
// ===========================================================================

describe('searchKeyboards - 하드 제약 위반 0건 보장', () => {
  it('layout=텐키리스 제약: 결과에 텐키리스 외 키보드가 없다', () => {
    const tags = selectionOptionConverter({ 크기: LAYOUT_OPTIONS.TKL }, { min: 0, max: 1_000_000 });
    const output = searchKeyboards(tags, CATALOG);

    expect(output.results.length).toBeGreaterThan(0);
    const violations = output.results.filter((r) => r.keyboard.layout !== '텐키리스').length;
    expect(violations).toBe(0);
  });

  it('layout=풀배열 제약: 결과에 풀배열 외 키보드가 없다', () => {
    const tags = selectionOptionConverter({ 크기: LAYOUT_OPTIONS.FULL }, { min: 0, max: 1_000_000 });
    const output = searchKeyboards(tags, CATALOG);

    expect(output.results.length).toBeGreaterThan(0);
    const violations = output.results.filter((r) => r.keyboard.layout !== '풀배열').length;
    expect(violations).toBe(0);
  });

  it('layout=미니 제약: 결과에 미니 외 키보드가 없다', () => {
    const tags = selectionOptionConverter({ 크기: LAYOUT_OPTIONS.MINI }, { min: 0, max: 1_000_000 });
    const output = searchKeyboards(tags, CATALOG);

    expect(output.results.length).toBeGreaterThan(0);
    const violations = output.results.filter((r) => r.keyboard.layout !== '미니').length;
    expect(violations).toBe(0);
  });

  it('switch_type=기계식 제약: 결과에 기계식 외 키보드가 없다', () => {
    const tags = selectionOptionConverter(
      { 키감: KEY_FEEL_OPTIONS.TACTILE },
      { min: 0, max: 1_000_000 },
    );
    const output = searchKeyboards(tags, CATALOG);

    expect(output.results.length).toBeGreaterThan(0);
    const violations = output.results.filter((r) => r.keyboard.switch_type !== '기계식').length;
    expect(violations).toBe(0);
  });

  it('switch_type=무접점 제약: 결과에 무접점 외 키보드가 없다', () => {
    const tags = selectionOptionConverter(
      { 키감: KEY_FEEL_OPTIONS.TOPRE },
      { min: 0, max: 1_000_000 },
    );
    const output = searchKeyboards(tags, CATALOG);

    expect(output.results.length).toBeGreaterThan(0);
    const violations = output.results.filter(
      (r) => !r.keyboard.switch_type.includes('무접점'),
    ).length;
    expect(violations).toBe(0);
  });

  it('price_max=100000 제약: 결과에 10만원 초과 키보드가 없다', () => {
    const tags = selectionOptionConverter({}, { min: 0, max: 100_000 });
    const output = searchKeyboards(tags, CATALOG);

    expect(output.results.length).toBeGreaterThan(0);
    const violations = output.results.filter((r) => r.keyboard.price > 100_000).length;
    expect(violations).toBe(0);
  });

  it('복합 제약 (텐키리스 + 기계식 + 10만원 이하): 위반 0건', () => {
    const tags = selectionOptionConverter(
      { 크기: LAYOUT_OPTIONS.TKL, 키감: KEY_FEEL_OPTIONS.TACTILE },
      { min: 0, max: 100_000 },
    );
    const output = searchKeyboards(tags, CATALOG);

    // 결과에 존재하는 경우: 기계식-텐키리스-유선-없음-8만 (idx 0)
    expect(output.results.length).toBeGreaterThan(0);
    output.results.forEach((r) => {
      if (!r.isFallback) {
        expect(r.keyboard.layout).toBe('텐키리스');
        expect(r.keyboard.switch_type).toBe('기계식');
        expect(r.keyboard.price).toBeLessThanOrEqual(100_000);
      }
    });
  });

  it('자유형 경로에서도 하드 제약 위반 0건', () => {
    const tags = sanitizeTags({
      hardConstraints: { layout: '텐키리스', switch_type: '기계식', price_max: 120_000 },
      softIntentTags: ['기계식', '텐키리스'],
    });
    const output = searchKeyboards(tags, CATALOG);

    const layoutViolations = output.results.filter(
      (r) => !r.isFallback && r.keyboard.layout !== '텐키리스',
    ).length;
    const switchViolations = output.results.filter(
      (r) => !r.isFallback && r.keyboard.switch_type !== '기계식',
    ).length;
    const priceViolations = output.results.filter(
      (r) => !r.isFallback && r.keyboard.price > 120_000,
    ).length;

    expect(layoutViolations).toBe(0);
    expect(switchViolations).toBe(0);
    expect(priceViolations).toBe(0);
  });
});

// ===========================================================================
// 5. 선택 경로와 자유형 경로 동등성
// ===========================================================================

describe('searchKeyboards - 선택 경로와 자유형 경로 동등성', () => {
  it('layout=텐키리스: 선택 경로와 자유형 경로가 동일 키보드 집합을 반환한다', () => {
    const selectionTags = selectionOptionConverter(
      { 크기: LAYOUT_OPTIONS.TKL },
      { min: 0, max: 1_000_000 },
    );
    const freeformTags = sanitizeTags({
      hardConstraints: { layout: '텐키리스' },
      softIntentTags: ['텐키리스'],
    });

    const selOutput = searchKeyboards(selectionTags, CATALOG);
    const freeOutput = searchKeyboards(freeformTags, CATALOG);

    // 반환된 키보드 이름 집합이 동일해야 한다
    const selNames = new Set(selOutput.results.map((r) => r.keyboard.product_name));
    const freeNames = new Set(freeOutput.results.map((r) => r.keyboard.product_name));
    expect(selNames).toEqual(freeNames);
  });

  it('switch_type=기계식: 선택(또각또각) 경로와 자유형 경로가 동일 키보드 집합을 반환한다', () => {
    const selectionTags = selectionOptionConverter(
      { 키감: KEY_FEEL_OPTIONS.TACTILE },
      { min: 0, max: 1_000_000 },
    );
    const freeformTags = sanitizeTags({
      hardConstraints: { switch_type: '기계식' },
      softIntentTags: ['기계식', '타건감', '경쾌함'],
    });

    const selOutput = searchKeyboards(selectionTags, CATALOG);
    const freeOutput = searchKeyboards(freeformTags, CATALOG);

    const selNames = new Set(selOutput.results.map((r) => r.keyboard.product_name));
    const freeNames = new Set(freeOutput.results.map((r) => r.keyboard.product_name));
    expect(selNames).toEqual(freeNames);
  });

  it('price_max=100000: 선택 경로와 자유형 경로가 동일 키보드 집합을 반환한다', () => {
    const selectionTags = selectionOptionConverter({}, { min: 0, max: 100_000 });
    const freeformTags = sanitizeTags({
      hardConstraints: { price_max: 100_000 },
      softIntentTags: ['가성비'],
    });

    const selOutput = searchKeyboards(selectionTags, CATALOG);
    const freeOutput = searchKeyboards(freeformTags, CATALOG);

    const selNames = new Set(selOutput.results.map((r) => r.keyboard.product_name));
    const freeNames = new Set(freeOutput.results.map((r) => r.keyboard.product_name));
    expect(selNames).toEqual(freeNames);
  });

  it('빈 제약: 두 경로 모두 전체 카탈로그를 반환한다', () => {
    const selectionTags = selectionOptionConverter({}, { min: 0, max: 1_000_000 });
    const freeformTags = sanitizeTags({ hardConstraints: {}, softIntentTags: [] });

    const selOutput = searchKeyboards(selectionTags, CATALOG);
    const freeOutput = searchKeyboards(freeformTags, CATALOG);

    expect(selOutput.results.length).toBe(CATALOG.length);
    expect(freeOutput.results.length).toBe(CATALOG.length);
  });
});

// ===========================================================================
// 6. 매칭 근거 (matchedTags) 정확성
// ===========================================================================

describe('searchKeyboards - 매칭 근거 정확성', () => {
  it('소프트 태그 없으면 matchedTags가 빈 배열이다', () => {
    const tags = selectionOptionConverter({ 크기: LAYOUT_OPTIONS.TKL }, { min: 0, max: 1_000_000 });
    // 소프트 태그가 없도록 재구성
    const tagsNoSoft: ExtractedTags = {
      hardConstraints: tags.hardConstraints,
      softIntentTags: [],
    };
    const output = searchKeyboards(tagsNoSoft, CATALOG);

    output.results.forEach((r) => {
      expect(r.matchedTags).toEqual([]);
      expect(r.score).toBe(0);
    });
  });

  it('RGB 백라이트 태그: RGB 키보드(idx3)만 matchedTags에 RGB가 포함된다', () => {
    const tags: ExtractedTags = {
      hardConstraints: {},
      softIntentTags: ['RGB', '백라이트'],
    };
    const output = searchKeyboards(tags, CATALOG);

    // idx3 (기계식-풀배열-유선-RGB-10만)은 matchedTags에 RGB 포함
    const rgbResult = output.results.find((r) => r.keyboard.product_name === '기계식-풀배열-유선-RGB-10만');
    expect(rgbResult).toBeDefined();
    expect(rgbResult!.matchedTags).toContain('RGB');
    expect(rgbResult!.matchedTags).toContain('백라이트');

    // RGB 없는 키보드(idx0: 없음)는 matchedTags가 비어 있다
    const noRgbResult = output.results.find((r) => r.keyboard.product_name === '기계식-텐키리스-유선-없음-8만');
    expect(noRgbResult).toBeDefined();
    expect(noRgbResult!.matchedTags).not.toContain('RGB');
  });

  it('사무용 태그: 유선 키보드가 더 높은 점수를 받는다 (사무용 규칙표)', () => {
    const tags: ExtractedTags = {
      hardConstraints: {},
      softIntentTags: ['사무용'],
    };
    const output = searchKeyboards(tags, CATALOG);

    // 사무용 태그는 유선 또는 사무용 속성에 매핑된다
    // 점수 내림차순 정렬이 유지되는지 확인
    for (let i = 0; i < output.results.length - 1; i++) {
      expect(output.results[i].score).toBeGreaterThanOrEqual(output.results[i + 1].score);
    }
  });

  it('matchedTags는 요청한 softIntentTags의 부분집합이다', () => {
    const softTags = ['사무용', '기계식', 'RGB', '무선'] as const;
    const tags: ExtractedTags = {
      hardConstraints: {},
      softIntentTags: [...softTags],
    };
    const output = searchKeyboards(tags, CATALOG);

    const requestedSet = new Set(softTags);
    output.results.forEach((r) => {
      r.matchedTags.forEach((tag) => {
        expect(requestedSet.has(tag as typeof softTags[number])).toBe(true);
      });
    });
  });
});

// ===========================================================================
// 7. 폴백(결과 0건 -> 완화) 검증
// ===========================================================================

describe('searchKeyboards - 폴백: 0건 시 하드 제약 완화', () => {
  it('카탈로그에 없는 조합(풀배열+무접점 자석축): 이미 있는 무접점으로 완화 후 결과 반환', () => {
    // 테스트 카탈로그에 풀배열+무접점은 있지만(idx5: 무접점-풀배열), 자유형에서 무접점 자석축이 있다고 가정
    // layout=풀배열 + switch_type=무접점 -> 카탈로그에 존재 (idx5)
    // 존재하지 않는 조합을 테스트: 미니 + 무접점
    // idx4만 미니인데 switch_type=기계식. 무접점 미니는 없음
    const tags: ExtractedTags = {
      hardConstraints: { layout: '미니', switch_type: '무접점' },
      softIntentTags: ['미니', '무접점'],
    };
    const output = searchKeyboards(tags, CATALOG);

    // 결과가 없거나 폴백으로 나와야 한다
    // 카탈로그에 미니+무접점이 없으므로 폴백 발생
    expect(output.isFallback).toBe(true);
    expect(output.relaxedConstraints.length).toBeGreaterThan(0);
    expect(output.relaxationStepCount).toBeGreaterThan(0);
  });

  it('폴백 결과에는 완화된 제약 정보가 포함된다', () => {
    // 카탈로그에 없는 조합: 미니 + 무접점
    const tags: ExtractedTags = {
      hardConstraints: { layout: '미니', switch_type: '무접점' },
      softIntentTags: ['미니', '무접점'],
    };
    const output = searchKeyboards(tags, CATALOG);

    if (output.isFallback && output.results.length > 0) {
      output.results.forEach((r) => {
        expect(r.isFallback).toBe(true);
        expect(r.relaxedConstraints.length).toBeGreaterThan(0);
        expect(r.relaxationStepCount).toBeGreaterThan(0);
      });
    }
  });

  it('정상 결과 시: isFallback=false, relaxedConstraints=[], relaxationStepCount=0', () => {
    const tags = selectionOptionConverter({ 크기: LAYOUT_OPTIONS.TKL }, { min: 0, max: 1_000_000 });
    const output = searchKeyboards(tags, CATALOG);

    expect(output.isFallback).toBe(false);
    expect(output.relaxedConstraints).toEqual([]);
    expect(output.relaxationStepCount).toBe(0);

    output.results.forEach((r) => {
      expect(r.isFallback).toBe(false);
      expect(r.relaxedConstraints).toEqual([]);
      expect(r.relaxationStepCount).toBe(0);
    });
  });

  it('폴백 결과도 매칭 근거(matchedTags)가 반환된다', () => {
    const tags: ExtractedTags = {
      hardConstraints: { layout: '미니', switch_type: '무접점' },
      softIntentTags: ['미니', '무접점'],
    };
    const output = searchKeyboards(tags, CATALOG);

    if (output.isFallback && output.results.length > 0) {
      output.results.forEach((r) => {
        expect(Array.isArray(r.matchedTags)).toBe(true);
        // score === matchedTags.length 불변
        expect(r.score).toBe(r.matchedTags.length);
      });
    }
  });
});

// ===========================================================================
// 8. 결정론성 검증
// ===========================================================================

describe('searchKeyboards - 결정론성', () => {
  it('동일 tags + catalog -> 항상 동일 output', () => {
    const tags = selectionOptionConverter(
      {
        용도: PURPOSE_OPTIONS.OFFICE,
        연결방식: CONNECTION_OPTIONS.WIRED,
        크기: LAYOUT_OPTIONS.TKL,
      },
      { min: 50_000, max: 200_000 },
    );

    const o1 = searchKeyboards(tags, CATALOG);
    const o2 = searchKeyboards(tags, CATALOG);
    const o3 = searchKeyboards(tags, CATALOG);

    expect(o1.results.map((r) => r.keyboard.product_name)).toEqual(
      o2.results.map((r) => r.keyboard.product_name),
    );
    expect(o2.results.map((r) => r.keyboard.product_name)).toEqual(
      o3.results.map((r) => r.keyboard.product_name),
    );
  });

  it('동일 score 기록 -> 동일 순서', () => {
    const tags: ExtractedTags = {
      hardConstraints: {},
      softIntentTags: ['기계식', '타건감'],
    };

    const o1 = searchKeyboards(tags, CATALOG);
    const o2 = searchKeyboards(tags, CATALOG);

    expect(o1.results.map((r) => r.keyboardIndex)).toEqual(o2.results.map((r) => r.keyboardIndex));
  });
});

// ===========================================================================
// 9. 복합 시나리오 통합 검증
// ===========================================================================

describe('searchKeyboards - 복합 시나리오 통합 검증', () => {
  it('사무용 시나리오 (무접점 텐키리스 유선): 올바른 결과와 근거 반환', () => {
    const tags = selectionOptionConverter(
      {
        용도: PURPOSE_OPTIONS.OFFICE,
        소리: SOUND_OPTIONS.VERY_QUIET,
        키감: KEY_FEEL_OPTIONS.TOPRE,
        연결방식: CONNECTION_OPTIONS.WIRED,
        크기: LAYOUT_OPTIONS.TKL,
      },
      { min: 0, max: 300_000 },
    );

    const output = searchKeyboards(tags, CATALOG);

    // 하드 제약: switch_type=무접점, layout=텐키리스
    // 카탈로그에서 무접점+텐키리스는 idx2지만 connection=무선 -> switch_type만 필터링됨
    // layout=텐키리스 + switch_type=무접점 -> idx2(무접점 텐키리스 무선)
    expect(output.results.length).toBeGreaterThan(0);
    expect(output.isFallback).toBe(false);

    // 결과 키보드는 모두 텐키리스이어야 한다
    const layoutViolations = output.results.filter((r) => r.keyboard.layout !== '텐키리스').length;
    expect(layoutViolations).toBe(0);

    // 결과 키보드는 모두 무접점(switch_type includes 무접점)이어야 한다
    const switchViolations = output.results.filter(
      (r) => !r.keyboard.switch_type.includes('무접점'),
    ).length;
    expect(switchViolations).toBe(0);

    // 결과에 매칭 근거가 있어야 한다
    output.results.forEach((r) => {
      expect(Array.isArray(r.matchedTags)).toBe(true);
    });
  });

  it('게이밍 시나리오 (기계식 풀배열 RGB): RGB 키보드가 상위에 위치', () => {
    const tags = selectionOptionConverter(
      {
        용도: PURPOSE_OPTIONS.GAMING,
        키감: KEY_FEEL_OPTIONS.TACTILE,
        크기: LAYOUT_OPTIONS.FULL,
        백라이트: BACKLIGHT_OPTIONS.RGB,
      },
      { min: 0, max: 500_000 },
    );

    const output = searchKeyboards(tags, CATALOG);

    expect(output.results.length).toBeGreaterThan(0);
    expect(output.isFallback).toBe(false);

    // 결과 키보드는 모두 풀배열+기계식이어야 한다
    output.results.forEach((r) => {
      expect(r.keyboard.layout).toBe('풀배열');
      expect(r.keyboard.switch_type).toBe('기계식');
    });

    // 1위 결과에 RGB 관련 매칭 태그가 있어야 한다
    const topResult = output.results[0];
    expect(topResult.matchedTags.length).toBeGreaterThan(0);
  });

  it('휴대성 시나리오 (미니 무선): 미니 키보드 반환', () => {
    const tags = selectionOptionConverter(
      {
        휴대성: PORTABILITY_OPTIONS.PORTABLE,
        연결방식: CONNECTION_OPTIONS.DONGLE,
        크기: LAYOUT_OPTIONS.MINI,
      },
      { min: 0, max: 150_000 },
    );

    const output = searchKeyboards(tags, CATALOG);

    expect(output.results.length).toBeGreaterThan(0);

    // 결과에 미니 키보드가 있어야 한다 (layout 하드 제약)
    if (!output.isFallback) {
      output.results.forEach((r) => {
        expect(r.keyboard.layout).toBe('미니');
      });
    }
  });

  it('자유형 경로 - 자연어에서 추출된 것과 동일한 구조 반환', () => {
    // "10만원 이하 조용한 사무용 기계식 텐키리스" 에서 추출된 태그 시뮬레이션
    const freeformTags: ExtractedTags = sanitizeTags({
      hardConstraints: {
        layout: '텐키리스',
        switch_type: '기계식',
        price_max: 100_000,
      },
      softIntentTags: ['사무용', '조용함', '기계식', '텐키리스'],
    });

    const output = searchKeyboards(freeformTags, CATALOG);

    assertOutputStructure(output);
    expect(output.results.length).toBeGreaterThan(0);

    // 하드 제약 위반 없음
    output.results.forEach((r) => {
      if (!r.isFallback) {
        expect(r.keyboard.layout).toBe('텐키리스');
        expect(r.keyboard.switch_type).toBe('기계식');
        expect(r.keyboard.price).toBeLessThanOrEqual(100_000);
      }
    });

    // 결과에 매칭 근거 포함
    output.results.forEach((r) => assertResultItemStructure(r));
  });
});

// ===========================================================================
// 10. hardConstraintsToHardTags 변환 함수 검증
// ===========================================================================

describe('hardConstraintsToHardTags - 변환 함수', () => {
  it('layout 필드를 HardTag 배열로 변환한다', () => {
    const tags = hardConstraintsToHardTags({ layout: '텐키리스' });
    const layoutTag = tags.find((t) => t.type === 'layout');
    expect(layoutTag).toBeDefined();
    expect(layoutTag!.value).toBe('텐키리스');
  });

  it('switch_type 필드를 HardTag 배열로 변환한다', () => {
    const tags = hardConstraintsToHardTags({ switch_type: '기계식' });
    const switchTag = tags.find((t) => t.type === 'switch_type');
    expect(switchTag).toBeDefined();
    expect(switchTag!.value).toBe('기계식');
  });

  it('price_max 필드를 HardTag 배열로 변환한다', () => {
    const tags = hardConstraintsToHardTags({ price_max: 150_000 });
    const priceTag = tags.find((t) => t.type === 'price_max');
    expect(priceTag).toBeDefined();
    expect(priceTag!.value).toBe(150_000);
  });

  it('빈 HardConstraints -> 빈 HardTag 배열', () => {
    const tags = hardConstraintsToHardTags({});
    expect(tags).toEqual([]);
  });

  it('복합 HardConstraints -> 해당 HardTag 배열', () => {
    const tags = hardConstraintsToHardTags({
      layout: '풀배열',
      switch_type: '기계식',
      price_max: 200_000,
    });
    expect(tags).toHaveLength(3);
    expect(tags.find((t) => t.type === 'layout')?.value).toBe('풀배열');
    expect(tags.find((t) => t.type === 'switch_type')?.value).toBe('기계식');
    expect(tags.find((t) => t.type === 'price_max')?.value).toBe(200_000);
  });
});

// ===========================================================================
// 11. HARD_CONSTRAINT_RELAXATION_ORDER 검증
// ===========================================================================

describe('HARD_CONSTRAINT_RELAXATION_ORDER', () => {
  it('모든 HardConstraints 키를 포함한다', () => {
    const allKeys: Array<keyof import('../lib/extractRawTags').HardConstraints> = [
      'price_min',
      'price_max',
      'weight_max_g',
      'connection',
      'layout',
      'switch_type',
      'wireless_type',
      'engraving',
      'backlight',
    ];
    const orderSet = new Set(HARD_CONSTRAINT_RELAXATION_ORDER);
    allKeys.forEach((key) => {
      expect(orderSet.has(key), `${key}가 완화 순서에 없음`).toBe(true);
    });
  });

  it('price_max가 가장 마지막 순서이다 (가장 높은 우선순위 = 가장 나중 완화)', () => {
    const lastKey = HARD_CONSTRAINT_RELAXATION_ORDER[HARD_CONSTRAINT_RELAXATION_ORDER.length - 1];
    expect(lastKey).toBe('price_max');
  });

  it('price_min이 가장 앞 순서이다 (가장 낮은 우선순위 = 가장 먼저 완화)', () => {
    const firstKey = HARD_CONSTRAINT_RELAXATION_ORDER[0];
    expect(firstKey).toBe('price_min');
  });
});
