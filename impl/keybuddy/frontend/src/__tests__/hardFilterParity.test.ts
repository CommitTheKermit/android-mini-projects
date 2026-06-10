/**
 * Sub-AC 2-3-a: hardFilterParity 단위 테스트
 *
 * 선택 변환 태그와 자유형 태그가 동일한 하드 제약 필터 함수를 통과할 때
 * 동일한 키보드 집합이 제외되는지 검증한다.
 *
 * 검증 기준:
 * - 선택 입력(selectionOptionConverter) 경로의 hardConstraints
 * - 자유형 입력(sanitizeTags 시뮬레이션) 경로의 hardConstraints
 * 두 경로가 동일한 제약을 표현하면 filterByHardConstraints 결과가 일치해야 한다.
 *
 * 방법론:
 * 1. selectionOptionConverter(answers, budget) -> ExtractedTags -> hardConstraintsToHardTags -> HardTag[]
 * 2. sanitizeTags(rawJson) -> ExtractedTags -> hardConstraintsToHardTags -> HardTag[]
 * 3. 동일 키보드 카탈로그에 두 HardTag[] 각각으로 filterByHardConstraints 호출
 * 4. 결과 키보드 집합이 일치하는지 확인
 */

import { describe, it, expect } from 'vitest';
import { filterByHardConstraints, type HardTag } from '../lib/hardFilter';
import { selectionOptionConverter, LAYOUT_OPTIONS, KEY_FEEL_OPTIONS, CONNECTION_OPTIONS, BACKLIGHT_OPTIONS, ENGRAVING_OPTIONS } from '../lib/guidedInputMapper';
import { sanitizeTags, type HardConstraints } from '../lib/extractRawTags';
import type { Keyboard } from '../types';

// ---------------------------------------------------------------------------
// 헬퍼: HardConstraints 객체 -> HardTag[] 변환
//
// filterByHardConstraints는 HardTag[] 형태를 입력으로 받는다.
// ExtractedTags.hardConstraints(객체 형태)를 filterByHardConstraints에 사용하려면
// 이 변환이 필요하다.
//
// 구현된 dispatcher 타입: 'layout', 'switch_type', 'price_max'
// 미구현 타입(connection, wireless_type, engraving, backlight)은
// dispatcher의 default 분기로 false(위반 없음)를 반환하므로
// 필터링에 영향을 주지 않는다.
// ---------------------------------------------------------------------------

function hardConstraintsToHardTags(hc: HardConstraints): HardTag[] {
  const tags: HardTag[] = [];
  if (hc.layout !== undefined) tags.push({ type: 'layout', value: hc.layout });
  if (hc.switch_type !== undefined) tags.push({ type: 'switch_type', value: hc.switch_type });
  if (hc.price_max !== undefined) tags.push({ type: 'price_max', value: hc.price_max });
  if (hc.price_min !== undefined) tags.push({ type: 'price_min', value: hc.price_min });
  if (hc.connection !== undefined) tags.push({ type: 'connection', value: hc.connection });
  if (hc.wireless_type !== undefined) tags.push({ type: 'wireless_type', value: hc.wireless_type });
  if (hc.engraving !== undefined) tags.push({ type: 'engraving', value: hc.engraving });
  if (hc.backlight !== undefined) tags.push({ type: 'backlight', value: hc.backlight });
  return tags;
}

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
 * 다양한 속성 조합의 키보드 카탈로그.
 * 제약 필터링 효과를 검증하기 위해 모든 layout/switch_type/price 조합을 포함한다.
 */
const CATALOG: Keyboard[] = [
  // 텐키리스 기계식
  makeKeyboard({ product_name: '텐키리스-기계식-8만', layout: '텐키리스', switch_type: '기계식', price: 80000 }),
  makeKeyboard({ product_name: '텐키리스-기계식-15만', layout: '텐키리스', switch_type: '기계식', price: 150000 }),
  // 텐키리스 무접점
  makeKeyboard({ product_name: '텐키리스-무접점-12만', layout: '텐키리스', switch_type: '무접점', price: 120000 }),
  makeKeyboard({ product_name: '텐키리스-무접점-25만', layout: '텐키리스', switch_type: '무접점', price: 250000 }),
  // 풀배열 기계식
  makeKeyboard({ product_name: '풀배열-기계식-9만', layout: '풀배열', switch_type: '기계식', price: 90000 }),
  makeKeyboard({ product_name: '풀배열-기계식-20만', layout: '풀배열', switch_type: '기계식', price: 200000 }),
  // 풀배열 펜타그래프
  makeKeyboard({ product_name: '풀배열-펜타그래프-5만', layout: '풀배열', switch_type: '펜타그래프', price: 50000 }),
  // 미니 기계식
  makeKeyboard({ product_name: '미니-기계식-7만', layout: '미니', switch_type: '기계식', price: 70000 }),
  makeKeyboard({ product_name: '미니-기계식-13만', layout: '미니', switch_type: '기계식', price: 130000 }),
  // 미니 무접점
  makeKeyboard({ product_name: '미니-무접점-18만', layout: '미니', switch_type: '무접점', price: 180000 }),
  // 98키 기계식
  makeKeyboard({ product_name: '98키-기계식-11만', layout: '98키', switch_type: '기계식', price: 110000 }),
];

// ---------------------------------------------------------------------------
// 핵심 유틸: 선택 경로와 자유형 경로의 필터 결과를 비교하는 헬퍼
// ---------------------------------------------------------------------------

/**
 * 두 HardTag[] 배열을 각각 filterByHardConstraints에 적용하고
 * 결과 product_name 집합이 동일한지 비교한다.
 */
function assertSameFilterResult(selectionTags: HardTag[], freeformTags: HardTag[]): void {
  const selectionResult = filterByHardConstraints(CATALOG, selectionTags);
  const freeformResult = filterByHardConstraints(CATALOG, freeformTags);

  const selectionNames = new Set(selectionResult.map((kb) => kb.product_name));
  const freeformNames = new Set(freeformResult.map((kb) => kb.product_name));

  // 두 결과의 크기가 같아야 한다
  expect(selectionNames.size).toBe(freeformNames.size);

  // 선택 결과의 모든 키보드가 자유형 결과에도 있어야 한다
  for (const name of selectionNames) {
    expect(freeformNames.has(name), `선택 결과에 있는 ${name}이 자유형 결과에 없음`).toBe(true);
  }
  // 역방향 확인
  for (const name of freeformNames) {
    expect(selectionNames.has(name), `자유형 결과에 있는 ${name}이 선택 결과에 없음`).toBe(true);
  }
}

// ===========================================================================
// 시나리오 1: layout=텐키리스 단일 제약
// ===========================================================================

describe('hardFilterParity - layout=텐키리스 단일 제약', () => {
  it('선택 경로와 자유형 경로가 동일한 키보드 집합을 반환한다', () => {
    // 선택 경로: 크기 "텐키리스" 선택
    const selectionTags = selectionOptionConverter(
      { 크기: LAYOUT_OPTIONS.TKL },
      { min: 0, max: 1_000_000 },
    );
    const selectionHardTags = hardConstraintsToHardTags(selectionTags.hardConstraints);

    // 자유형 경로: "텐키리스 키보드 추천해줘"에서 추출된 것을 sanitizeTags로 시뮬레이션
    const freeformRaw = {
      hardConstraints: { layout: '텐키리스' },
      softIntentTags: ['텐키리스'],
    };
    const freeformExtracted = sanitizeTags(freeformRaw);
    const freeformHardTags = hardConstraintsToHardTags(freeformExtracted.hardConstraints);

    assertSameFilterResult(selectionHardTags, freeformHardTags);

    // 결과에 텐키리스가 아닌 키보드가 없어야 한다 (violations === 0)
    const selectionResult = filterByHardConstraints(CATALOG, selectionHardTags);
    const layoutViolations = selectionResult.filter((kb) => kb.layout !== '텐키리스').length;
    expect(layoutViolations).toBe(0);
  });

  it('결과 키보드 수가 양쪽 경로 모두 동일하다', () => {
    const selectionTags = selectionOptionConverter({ 크기: LAYOUT_OPTIONS.TKL }, { min: 0, max: 1_000_000 });
    const freeformExtracted = sanitizeTags({ hardConstraints: { layout: '텐키리스' }, softIntentTags: [] });

    const selectionResult = filterByHardConstraints(CATALOG, hardConstraintsToHardTags(selectionTags.hardConstraints));
    const freeformResult = filterByHardConstraints(CATALOG, hardConstraintsToHardTags(freeformExtracted.hardConstraints));

    expect(selectionResult.length).toBe(freeformResult.length);
    // 텐키리스 키보드 4개
    expect(selectionResult.length).toBe(4);
  });
});

// ===========================================================================
// 시나리오 2: layout=미니 단일 제약
// ===========================================================================

describe('hardFilterParity - layout=미니 단일 제약', () => {
  it('선택 경로와 자유형 경로가 동일한 키보드 집합을 반환한다', () => {
    const selectionTags = selectionOptionConverter(
      { 크기: LAYOUT_OPTIONS.MINI },
      { min: 0, max: 1_000_000 },
    );
    const selectionHardTags = hardConstraintsToHardTags(selectionTags.hardConstraints);

    const freeformExtracted = sanitizeTags({
      hardConstraints: { layout: '미니' },
      softIntentTags: ['미니', '휴대성'],
    });
    const freeformHardTags = hardConstraintsToHardTags(freeformExtracted.hardConstraints);

    assertSameFilterResult(selectionHardTags, freeformHardTags);

    const result = filterByHardConstraints(CATALOG, selectionHardTags);
    result.forEach((kb) => expect(kb.layout).toBe('미니'));
  });

  it('미니 레이아웃 외 키보드가 모두 제외된다', () => {
    const selectionTags = selectionOptionConverter({ 크기: LAYOUT_OPTIONS.MINI }, { min: 0, max: 1_000_000 });
    const freeformExtracted = sanitizeTags({ hardConstraints: { layout: '미니' }, softIntentTags: [] });

    const selectionResult = filterByHardConstraints(CATALOG, hardConstraintsToHardTags(selectionTags.hardConstraints));
    const freeformResult = filterByHardConstraints(CATALOG, hardConstraintsToHardTags(freeformExtracted.hardConstraints));

    // 두 결과가 동일하고 미니 레이아웃 키보드 3개만 남아야 한다
    expect(selectionResult.length).toBe(3);
    expect(freeformResult.length).toBe(3);
  });
});

// ===========================================================================
// 시나리오 3: layout=풀배열 단일 제약
// ===========================================================================

describe('hardFilterParity - layout=풀배열 단일 제약', () => {
  it('선택 경로와 자유형 경로가 동일한 키보드 집합을 반환한다', () => {
    const selectionTags = selectionOptionConverter(
      { 크기: LAYOUT_OPTIONS.FULL },
      { min: 0, max: 1_000_000 },
    );
    const selectionHardTags = hardConstraintsToHardTags(selectionTags.hardConstraints);

    const freeformExtracted = sanitizeTags({
      hardConstraints: { layout: '풀배열' },
      softIntentTags: ['풀배열'],
    });
    const freeformHardTags = hardConstraintsToHardTags(freeformExtracted.hardConstraints);

    assertSameFilterResult(selectionHardTags, freeformHardTags);

    const result = filterByHardConstraints(CATALOG, selectionHardTags);
    // 풀배열 키보드: 풀배열-기계식-9만, 풀배열-기계식-20만, 풀배열-펜타그래프-5만 (3개)
    expect(result.length).toBe(3);
    result.forEach((kb) => expect(kb.layout).toBe('풀배열'));
  });
});

// ===========================================================================
// 시나리오 4: switch_type=기계식 단일 제약
// ===========================================================================

describe('hardFilterParity - switch_type=기계식 단일 제약', () => {
  it('선택 경로(또각또각)와 자유형 경로(기계식)가 동일한 키보드 집합을 반환한다', () => {
    const selectionTags = selectionOptionConverter(
      { 키감: KEY_FEEL_OPTIONS.TACTILE },
      { min: 0, max: 1_000_000 },
    );
    const selectionHardTags = hardConstraintsToHardTags(selectionTags.hardConstraints);

    const freeformExtracted = sanitizeTags({
      hardConstraints: { switch_type: '기계식' },
      softIntentTags: ['기계식', '타건감', '경쾌함'],
    });
    const freeformHardTags = hardConstraintsToHardTags(freeformExtracted.hardConstraints);

    assertSameFilterResult(selectionHardTags, freeformHardTags);

    const result = filterByHardConstraints(CATALOG, selectionHardTags);
    result.forEach((kb) => expect(kb.switch_type).toBe('기계식'));
    const switchViolations = result.filter((kb) => kb.switch_type !== '기계식').length;
    expect(switchViolations).toBe(0);
  });

  it('선택 경로(서걱서걱)도 기계식으로 매핑되어 또각또각과 동일한 결과를 반환한다', () => {
    const tactileTags = selectionOptionConverter({ 키감: KEY_FEEL_OPTIONS.TACTILE }, { min: 0, max: 1_000_000 });
    const linearTags = selectionOptionConverter({ 키감: KEY_FEEL_OPTIONS.LINEAR }, { min: 0, max: 1_000_000 });

    // 둘 다 switch_type: 기계식으로 매핑되므로 결과가 같아야 한다
    const tactileResult = filterByHardConstraints(CATALOG, hardConstraintsToHardTags(tactileTags.hardConstraints));
    const linearResult = filterByHardConstraints(CATALOG, hardConstraintsToHardTags(linearTags.hardConstraints));

    const tactileNames = new Set(tactileResult.map((kb) => kb.product_name));
    const linearNames = new Set(linearResult.map((kb) => kb.product_name));
    expect(tactileNames).toEqual(linearNames);
  });
});

// ===========================================================================
// 시나리오 5: switch_type=무접점 단일 제약
// ===========================================================================

describe('hardFilterParity - switch_type=무접점 단일 제약', () => {
  it('선택 경로(보글보글)와 자유형 경로(무접점)가 동일한 키보드 집합을 반환한다', () => {
    const selectionTags = selectionOptionConverter(
      { 키감: KEY_FEEL_OPTIONS.TOPRE },
      { min: 0, max: 1_000_000 },
    );
    const selectionHardTags = hardConstraintsToHardTags(selectionTags.hardConstraints);

    const freeformExtracted = sanitizeTags({
      hardConstraints: { switch_type: '무접점' },
      softIntentTags: ['무접점', '조용함'],
    });
    const freeformHardTags = hardConstraintsToHardTags(freeformExtracted.hardConstraints);

    assertSameFilterResult(selectionHardTags, freeformHardTags);

    const result = filterByHardConstraints(CATALOG, selectionHardTags);
    // 무접점 키보드: 텐키리스-무접점-12만, 텐키리스-무접점-25만, 미니-무접점-18만 (3개)
    expect(result.length).toBe(3);
    const switchViolations = result.filter((kb) => kb.switch_type !== '무접점').length;
    expect(switchViolations).toBe(0);
  });
});

// ===========================================================================
// 시나리오 6: price_max 단일 제약
// ===========================================================================

describe('hardFilterParity - price_max 단일 제약', () => {
  it('선택 경로(budget max=100000)와 자유형 경로(price_max=100000)가 동일한 키보드 집합을 반환한다', () => {
    const selectionTags = selectionOptionConverter(
      {},
      { min: 0, max: 100000 },
    );
    const selectionHardTags = hardConstraintsToHardTags(selectionTags.hardConstraints);

    const freeformExtracted = sanitizeTags({
      hardConstraints: { price_max: 100000 },
      softIntentTags: ['가성비'],
    });
    const freeformHardTags = hardConstraintsToHardTags(freeformExtracted.hardConstraints);

    assertSameFilterResult(selectionHardTags, freeformHardTags);

    const result = filterByHardConstraints(CATALOG, selectionHardTags);
    const priceViolations = result.filter((kb) => kb.price > 100000).length;
    expect(priceViolations).toBe(0);
    result.forEach((kb) => expect(kb.price).toBeLessThanOrEqual(100000));
  });

  it('budget max=150000 선택 경로와 자유형 경로가 동일하다', () => {
    const selectionTags = selectionOptionConverter({}, { min: 0, max: 150000 });
    const freeformExtracted = sanitizeTags({ hardConstraints: { price_max: 150000 }, softIntentTags: [] });

    const selectionResult = filterByHardConstraints(CATALOG, hardConstraintsToHardTags(selectionTags.hardConstraints));
    const freeformResult = filterByHardConstraints(CATALOG, hardConstraintsToHardTags(freeformExtracted.hardConstraints));

    expect(selectionResult.length).toBe(freeformResult.length);
    const selectionNames = new Set(selectionResult.map((kb) => kb.product_name));
    const freeformNames = new Set(freeformResult.map((kb) => kb.product_name));
    expect(selectionNames).toEqual(freeformNames);
  });
});

// ===========================================================================
// 시나리오 7: 복합 제약 (layout + switch_type + price_max)
// ===========================================================================

describe('hardFilterParity - 복합 제약 (layout=텐키리스 + switch_type=기계식 + price_max=100000)', () => {
  it('선택 경로와 자유형 경로가 동일한 키보드 집합을 반환한다', () => {
    // 선택 경로: 크기=텐키리스, 키감=또각또각, budget max=100000
    const selectionTags = selectionOptionConverter(
      {
        크기: LAYOUT_OPTIONS.TKL,
        키감: KEY_FEEL_OPTIONS.TACTILE,
      },
      { min: 0, max: 100000 },
    );
    const selectionHardTags = hardConstraintsToHardTags(selectionTags.hardConstraints);

    // 자유형 경로: "10만원 이하 텐키리스 기계식 키보드" 에서 추출된 것 시뮬레이션
    const freeformExtracted = sanitizeTags({
      hardConstraints: {
        layout: '텐키리스',
        switch_type: '기계식',
        price_max: 100000,
      },
      softIntentTags: ['텐키리스', '기계식', '타건감'],
    });
    const freeformHardTags = hardConstraintsToHardTags(freeformExtracted.hardConstraints);

    assertSameFilterResult(selectionHardTags, freeformHardTags);

    // 결과 검증: 텐키리스-기계식-8만 (1개)만 통과
    const result = filterByHardConstraints(CATALOG, selectionHardTags);
    expect(result.length).toBe(1);
    expect(result[0].product_name).toBe('텐키리스-기계식-8만');

    const layoutViolations = result.filter((kb) => kb.layout !== '텐키리스').length;
    const switchViolations = result.filter((kb) => kb.switch_type !== '기계식').length;
    const priceViolations = result.filter((kb) => kb.price > 100000).length;
    expect(layoutViolations).toBe(0);
    expect(switchViolations).toBe(0);
    expect(priceViolations).toBe(0);
  });

  it('복합 제약 결과에 위반 건수가 없다 (violations === 0)', () => {
    const selectionTags = selectionOptionConverter(
      { 크기: LAYOUT_OPTIONS.MINI, 키감: KEY_FEEL_OPTIONS.TOPRE },
      { min: 0, max: 200000 },
    );
    const freeformExtracted = sanitizeTags({
      hardConstraints: { layout: '미니', switch_type: '무접점', price_max: 200000 },
      softIntentTags: [],
    });

    const selectionResult = filterByHardConstraints(CATALOG, hardConstraintsToHardTags(selectionTags.hardConstraints));
    const freeformResult = filterByHardConstraints(CATALOG, hardConstraintsToHardTags(freeformExtracted.hardConstraints));

    // 두 결과가 동일해야 한다
    const selectionNames = new Set(selectionResult.map((kb) => kb.product_name));
    const freeformNames = new Set(freeformResult.map((kb) => kb.product_name));
    expect(selectionNames).toEqual(freeformNames);

    // violations 검증
    selectionResult.forEach((kb) => {
      expect(kb.layout).toBe('미니');
      expect(kb.switch_type).toBe('무접점');
      expect(kb.price).toBeLessThanOrEqual(200000);
    });
  });
});

// ===========================================================================
// 시나리오 8: 빈 제약 (모든 키보드 통과)
// ===========================================================================

describe('hardFilterParity - 빈 제약 (제약 없음)', () => {
  it('선택 경로와 자유형 경로 모두 빈 제약이면 동일한 전체 카탈로그를 반환한다', () => {
    // 선택 경로: 아무것도 선택하지 않음
    const selectionTags = selectionOptionConverter({}, { min: 0, max: 1_000_000 });
    const selectionHardTags = hardConstraintsToHardTags(selectionTags.hardConstraints);

    // 자유형 경로: 제약 없음
    const freeformExtracted = sanitizeTags({
      hardConstraints: {},
      softIntentTags: [],
    });
    const freeformHardTags = hardConstraintsToHardTags(freeformExtracted.hardConstraints);

    const selectionResult = filterByHardConstraints(CATALOG, selectionHardTags);
    const freeformResult = filterByHardConstraints(CATALOG, freeformHardTags);

    // 둘 다 전체 카탈로그를 반환해야 한다
    expect(selectionResult.length).toBe(CATALOG.length);
    expect(freeformResult.length).toBe(CATALOG.length);
    expect(selectionResult.length).toBe(freeformResult.length);
  });
});

// ===========================================================================
// 시나리오 9: 불가능한 제약 (결과 0건)
// ===========================================================================

describe('hardFilterParity - 불가능한 제약 (결과 0건)', () => {
  it('선택 경로와 자유형 경로 모두 위반 키보드 제외 후 0건을 반환한다', () => {
    // 선택 경로: 풀배열 + 무접점 (카탈로그에 없는 조합)
    const selectionTags = selectionOptionConverter(
      { 크기: LAYOUT_OPTIONS.FULL, 키감: KEY_FEEL_OPTIONS.TOPRE },
      { min: 0, max: 1_000_000 },
    );
    const selectionHardTags = hardConstraintsToHardTags(selectionTags.hardConstraints);

    // 자유형 경로: 같은 불가능한 제약
    const freeformExtracted = sanitizeTags({
      hardConstraints: { layout: '풀배열', switch_type: '무접점' },
      softIntentTags: [],
    });
    const freeformHardTags = hardConstraintsToHardTags(freeformExtracted.hardConstraints);

    const selectionResult = filterByHardConstraints(CATALOG, selectionHardTags);
    const freeformResult = filterByHardConstraints(CATALOG, freeformHardTags);

    // 두 경로 모두 0건
    expect(selectionResult.length).toBe(0);
    expect(freeformResult.length).toBe(0);
  });
});

// ===========================================================================
// 시나리오 10: 소프트태그 차이는 필터링 결과에 영향 없음
// ===========================================================================

describe('hardFilterParity - 소프트태그 차이는 하드 필터링 결과에 영향 없음', () => {
  it('동일한 하드 제약이면 소프트태그가 달라도 filterByHardConstraints 결과는 동일하다', () => {
    // 선택 경로: 텐키리스 + 소프트태그 ['텐키리스', '휴대성']
    const selectionTags = selectionOptionConverter(
      { 크기: LAYOUT_OPTIONS.TKL, 용도: '사무용' },
      { min: 0, max: 1_000_000 },
    );
    const selectionHardTags = hardConstraintsToHardTags(selectionTags.hardConstraints);

    // 자유형 경로: 동일한 layout 하드 제약, 다른 소프트태그
    const freeformExtracted = sanitizeTags({
      hardConstraints: { layout: '텐키리스' },
      softIntentTags: ['조용함', '사무용', '가벼움'], // 다른 소프트태그
    });
    const freeformHardTags = hardConstraintsToHardTags(freeformExtracted.hardConstraints);

    // 소프트태그가 달라도 하드 필터링 결과는 동일해야 한다
    const selectionResult = filterByHardConstraints(CATALOG, selectionHardTags);
    const freeformResult = filterByHardConstraints(CATALOG, freeformHardTags);

    expect(selectionResult.length).toBe(freeformResult.length);
    const selectionNames = new Set(selectionResult.map((kb) => kb.product_name));
    const freeformNames = new Set(freeformResult.map((kb) => kb.product_name));
    expect(selectionNames).toEqual(freeformNames);
  });
});

// ===========================================================================
// 시나리오 11: 1800배열/75% 선택 -> 하드 제약 없음 (자유형 빈 layout과 동일)
// ===========================================================================

describe('hardFilterParity - 1800배열 선택은 layout 하드 제약 없음으로 처리', () => {
  it('1800배열 선택 경로와 자유형 빈 layout 경로가 동일한 전체 결과를 반환한다', () => {
    // 선택 경로: 1800배열 (mapLayoutToConstraints에서 빈 객체 반환)
    const selectionTags = selectionOptionConverter(
      { 크기: LAYOUT_OPTIONS.COMPACT_FULL },
      { min: 0, max: 1_000_000 },
    );
    // layout 하드 제약이 없어야 한다
    expect(selectionTags.hardConstraints.layout).toBeUndefined();

    const selectionHardTags = hardConstraintsToHardTags(selectionTags.hardConstraints);

    // 자유형 경로: layout 제약 없음 (LLM이 1800배열을 인식 못하는 경우)
    const freeformExtracted = sanitizeTags({
      hardConstraints: {}, // layout 없음
      softIntentTags: ['풀배열'],
    });
    const freeformHardTags = hardConstraintsToHardTags(freeformExtracted.hardConstraints);

    // 둘 다 layout 필터 없이 전체 카탈로그 반환
    const selectionResult = filterByHardConstraints(CATALOG, selectionHardTags);
    const freeformResult = filterByHardConstraints(CATALOG, freeformHardTags);

    expect(selectionResult.length).toBe(CATALOG.length);
    expect(freeformResult.length).toBe(CATALOG.length);
  });
});

// ===========================================================================
// 시나리오 12: 연속 시나리오 테이블 - 선택/자유형 동일 결과 보장
// ===========================================================================

describe('hardFilterParity - 연속 시나리오 테이블', () => {
  const scenarios: Array<{
    desc: string;
    selectionAnswers: Record<string, string>;
    selectionBudget: { min: number; max: number };
    freeformHardConstraints: Record<string, unknown>;
    expectedLayout?: string;
    expectedSwitchType?: string;
    expectedMaxPrice?: number;
  }> = [
    {
      desc: '텐키리스',
      selectionAnswers: { 크기: LAYOUT_OPTIONS.TKL },
      selectionBudget: { min: 0, max: 1_000_000 },
      freeformHardConstraints: { layout: '텐키리스' },
      expectedLayout: '텐키리스',
    },
    {
      desc: '미니',
      selectionAnswers: { 크기: LAYOUT_OPTIONS.MINI },
      selectionBudget: { min: 0, max: 1_000_000 },
      freeformHardConstraints: { layout: '미니' },
      expectedLayout: '미니',
    },
    {
      desc: '풀배열',
      selectionAnswers: { 크기: LAYOUT_OPTIONS.FULL },
      selectionBudget: { min: 0, max: 1_000_000 },
      freeformHardConstraints: { layout: '풀배열' },
      expectedLayout: '풀배열',
    },
    {
      desc: '기계식',
      selectionAnswers: { 키감: KEY_FEEL_OPTIONS.TACTILE },
      selectionBudget: { min: 0, max: 1_000_000 },
      freeformHardConstraints: { switch_type: '기계식' },
      expectedSwitchType: '기계식',
    },
    {
      desc: '무접점',
      selectionAnswers: { 키감: KEY_FEEL_OPTIONS.TOPRE },
      selectionBudget: { min: 0, max: 1_000_000 },
      freeformHardConstraints: { switch_type: '무접점' },
      expectedSwitchType: '무접점',
    },
    {
      desc: '15만원 이하',
      selectionAnswers: {},
      selectionBudget: { min: 0, max: 150000 },
      freeformHardConstraints: { price_max: 150000 },
      expectedMaxPrice: 150000,
    },
    {
      desc: '텐키리스 + 기계식',
      selectionAnswers: { 크기: LAYOUT_OPTIONS.TKL, 키감: KEY_FEEL_OPTIONS.TACTILE },
      selectionBudget: { min: 0, max: 1_000_000 },
      freeformHardConstraints: { layout: '텐키리스', switch_type: '기계식' },
      expectedLayout: '텐키리스',
      expectedSwitchType: '기계식',
    },
    {
      desc: '미니 + 무접점 + 20만원 이하',
      selectionAnswers: { 크기: LAYOUT_OPTIONS.MINI, 키감: KEY_FEEL_OPTIONS.TOPRE },
      selectionBudget: { min: 0, max: 200000 },
      freeformHardConstraints: { layout: '미니', switch_type: '무접점', price_max: 200000 },
      expectedLayout: '미니',
      expectedSwitchType: '무접점',
      expectedMaxPrice: 200000,
    },
  ];

  scenarios.forEach(({ desc, selectionAnswers, selectionBudget, freeformHardConstraints, expectedLayout, expectedSwitchType, expectedMaxPrice }) => {
    it(`${desc}: 선택 경로와 자유형 경로가 동일한 결과를 반환한다`, () => {
      const selectionTags = selectionOptionConverter(selectionAnswers, selectionBudget);
      const selectionHardTags = hardConstraintsToHardTags(selectionTags.hardConstraints);

      const freeformExtracted = sanitizeTags({ hardConstraints: freeformHardConstraints, softIntentTags: [] });
      const freeformHardTags = hardConstraintsToHardTags(freeformExtracted.hardConstraints);

      // 두 경로의 결과가 동일해야 한다
      const selectionResult = filterByHardConstraints(CATALOG, selectionHardTags);
      const freeformResult = filterByHardConstraints(CATALOG, freeformHardTags);

      expect(selectionResult.length).toBe(freeformResult.length);
      const selectionNames = new Set(selectionResult.map((kb) => kb.product_name));
      const freeformNames = new Set(freeformResult.map((kb) => kb.product_name));
      expect(selectionNames).toEqual(freeformNames);

      // 결과의 violations === 0 검증
      if (expectedLayout !== undefined) {
        const violations = selectionResult.filter((kb) => kb.layout !== expectedLayout).length;
        expect(violations).toBe(0);
      }
      if (expectedSwitchType !== undefined) {
        const violations = selectionResult.filter((kb) => kb.switch_type !== expectedSwitchType).length;
        expect(violations).toBe(0);
      }
      if (expectedMaxPrice !== undefined) {
        const violations = selectionResult.filter((kb) => kb.price > expectedMaxPrice).length;
        expect(violations).toBe(0);
      }
    });
  });
});
