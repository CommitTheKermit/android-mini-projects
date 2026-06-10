/**
 * buildConstraintStatusMap 단위테스트 (Sub-AC 7-2b)
 *
 * 커버리지:
 * 1. 빈 제약 목록 - 빈 맵 반환 (경계 케이스)
 * 2. 단일 제약 - 충족(pass) 케이스
 * 3. 단일 제약 - 위반(fail) 케이스
 * 4. 복수 제약 - 모두 충족
 * 5. 복수 제약 - 모두 위반
 * 6. 복수 제약 - 혼합 위반/충족 (핵심 케이스)
 * 7. 모든 제약 타입 혼합 (numeric_range + enum_match + boolean_flag)
 * 8. 빈 속성 맵 - 모든 제약 fail
 * 9. 동일 ID 중복 시 마지막 결과 유지
 * 10. 실제 키보드 속성 시나리오 (게이밍/사무용 복합)
 */

import { describe, it, expect } from 'vitest';
import {
  buildConstraintStatusMap,
  type IdentifiedConstraint,
  type KeyboardAttributes,
} from '../lib/evaluateConstraint';

// ---------------------------------------------------------------------------
// 헬퍼
// ---------------------------------------------------------------------------

function attrs(partial: KeyboardAttributes): KeyboardAttributes {
  return partial;
}

// ===========================================================================
// 1. 빈 제약 목록 - 빈 맵 반환 (경계 케이스)
// ===========================================================================

describe('buildConstraintStatusMap - 빈 제약 목록', () => {
  it('빈 배열 + 임의 속성 -> 빈 맵 반환', () => {
    const result = buildConstraintStatusMap([], attrs({ price: 80000 }));
    expect(result).toEqual({});
  });

  it('빈 배열 + 빈 속성 맵 -> 빈 맵 반환', () => {
    const result = buildConstraintStatusMap([], attrs({}));
    expect(result).toEqual({});
  });

  it('반환 타입이 순수 객체(Record)', () => {
    const result = buildConstraintStatusMap([], attrs({}));
    expect(typeof result).toBe('object');
    expect(Object.keys(result).length).toBe(0);
  });
});

// ===========================================================================
// 2. 단일 제약 - 충족 케이스
// ===========================================================================

describe('buildConstraintStatusMap - 단일 제약 충족', () => {
  it('numeric_range lte 충족 -> { id: true }', () => {
    const constraints: IdentifiedConstraint[] = [
      { id: 'price_max', type: 'numeric_range', key: 'price', op: 'lte', value: 100000 },
    ];
    const result = buildConstraintStatusMap(constraints, attrs({ price: 80000 }));
    expect(result).toEqual({ price_max: true });
  });

  it('enum_match 충족 -> { id: true }', () => {
    const constraints: IdentifiedConstraint[] = [
      { id: 'layout_check', type: 'enum_match', key: 'layout', value: '텐키리스' },
    ];
    const result = buildConstraintStatusMap(constraints, attrs({ layout: '텐키리스' }));
    expect(result).toEqual({ layout_check: true });
  });

  it('boolean_flag 충족 -> { id: true }', () => {
    const constraints: IdentifiedConstraint[] = [
      { id: 'wireless_flag', type: 'boolean_flag', key: 'wireless', expected: true },
    ];
    const result = buildConstraintStatusMap(constraints, attrs({ wireless: true }));
    expect(result).toEqual({ wireless_flag: true });
  });
});

// ===========================================================================
// 3. 단일 제약 - 위반 케이스
// ===========================================================================

describe('buildConstraintStatusMap - 단일 제약 위반', () => {
  it('numeric_range lte 위반 -> { id: false }', () => {
    const constraints: IdentifiedConstraint[] = [
      { id: 'price_max', type: 'numeric_range', key: 'price', op: 'lte', value: 50000 },
    ];
    const result = buildConstraintStatusMap(constraints, attrs({ price: 80000 }));
    expect(result).toEqual({ price_max: false });
  });

  it('enum_match 위반 -> { id: false }', () => {
    const constraints: IdentifiedConstraint[] = [
      { id: 'layout_check', type: 'enum_match', key: 'layout', value: '텐키리스' },
    ];
    const result = buildConstraintStatusMap(constraints, attrs({ layout: '풀배열' }));
    expect(result).toEqual({ layout_check: false });
  });

  it('boolean_flag 위반 -> { id: false }', () => {
    const constraints: IdentifiedConstraint[] = [
      { id: 'wireless_flag', type: 'boolean_flag', key: 'wireless', expected: true },
    ];
    const result = buildConstraintStatusMap(constraints, attrs({ wireless: false }));
    expect(result).toEqual({ wireless_flag: false });
  });
});

// ===========================================================================
// 4. 복수 제약 - 모두 충족
// ===========================================================================

describe('buildConstraintStatusMap - 복수 제약 모두 충족', () => {
  it('3개 제약 모두 충족 -> 모두 true', () => {
    const constraints: IdentifiedConstraint[] = [
      { id: 'price_max', type: 'numeric_range', key: 'price', op: 'lte', value: 100000 },
      { id: 'layout_check', type: 'enum_match', key: 'layout', value: '텐키리스' },
      { id: 'switch_check', type: 'enum_match', key: 'switch_type', value: '기계식' },
    ];
    const result = buildConstraintStatusMap(
      constraints,
      attrs({ price: 89000, layout: '텐키리스', switch_type: '기계식' }),
    );
    expect(result).toEqual({
      price_max: true,
      layout_check: true,
      switch_check: true,
    });
  });

  it('경계값 정확히 일치 -> 모두 true', () => {
    const constraints: IdentifiedConstraint[] = [
      { id: 'price_exact', type: 'numeric_range', key: 'price', op: 'lte', value: 100000 },
      { id: 'weight_exact', type: 'numeric_range', key: 'weight_g', op: 'lte', value: 800 },
    ];
    const result = buildConstraintStatusMap(
      constraints,
      attrs({ price: 100000, weight_g: 800 }),
    );
    expect(result).toEqual({ price_exact: true, weight_exact: true });
  });
});

// ===========================================================================
// 5. 복수 제약 - 모두 위반
// ===========================================================================

describe('buildConstraintStatusMap - 복수 제약 모두 위반', () => {
  it('3개 제약 모두 위반 -> 모두 false', () => {
    const constraints: IdentifiedConstraint[] = [
      { id: 'price_max', type: 'numeric_range', key: 'price', op: 'lte', value: 50000 },
      { id: 'layout_check', type: 'enum_match', key: 'layout', value: '텐키리스' },
      { id: 'switch_check', type: 'enum_match', key: 'switch_type', value: '기계식' },
    ];
    const result = buildConstraintStatusMap(
      constraints,
      attrs({ price: 89000, layout: '풀배열', switch_type: '무접점' }),
    );
    expect(result).toEqual({
      price_max: false,
      layout_check: false,
      switch_check: false,
    });
  });
});

// ===========================================================================
// 6. 복수 제약 - 혼합 위반/충족 (핵심 케이스)
// ===========================================================================

describe('buildConstraintStatusMap - 혼합 위반/충족 (핵심 케이스)', () => {
  it('price 충족, layout 위반 -> { price_max: true, layout_check: false }', () => {
    const constraints: IdentifiedConstraint[] = [
      { id: 'price_max', type: 'numeric_range', key: 'price', op: 'lte', value: 100000 },
      { id: 'layout_check', type: 'enum_match', key: 'layout', value: '텐키리스' },
    ];
    const result = buildConstraintStatusMap(
      constraints,
      attrs({ price: 80000, layout: '풀배열' }),
    );
    expect(result.price_max).toBe(true);
    expect(result.layout_check).toBe(false);
  });

  it('price 위반, layout 충족 -> { price_max: false, layout_check: true }', () => {
    const constraints: IdentifiedConstraint[] = [
      { id: 'price_max', type: 'numeric_range', key: 'price', op: 'lte', value: 50000 },
      { id: 'layout_check', type: 'enum_match', key: 'layout', value: '텐키리스' },
    ];
    const result = buildConstraintStatusMap(
      constraints,
      attrs({ price: 89000, layout: '텐키리스' }),
    );
    expect(result.price_max).toBe(false);
    expect(result.layout_check).toBe(true);
  });

  it('4개 제약 중 2개 충족, 2개 위반 - 혼합', () => {
    const constraints: IdentifiedConstraint[] = [
      { id: 'price_max', type: 'numeric_range', key: 'price', op: 'lte', value: 100000 },   // 충족 (80000 <= 100000)
      { id: 'layout_check', type: 'enum_match', key: 'layout', value: '텐키리스' },           // 위반 (풀배열)
      { id: 'switch_check', type: 'enum_match', key: 'switch_type', value: '기계식' },        // 충족
      { id: 'weight_min', type: 'numeric_range', key: 'weight_g', op: 'gte', value: 900 },  // 위반 (750 < 900)
    ];
    const result = buildConstraintStatusMap(
      constraints,
      attrs({ price: 80000, layout: '풀배열', switch_type: '기계식', weight_g: 750 }),
    );
    expect(result).toEqual({
      price_max: true,
      layout_check: false,
      switch_check: true,
      weight_min: false,
    });
  });

  it('맵 키 개수가 제약 개수와 동일', () => {
    const constraints: IdentifiedConstraint[] = [
      { id: 'c1', type: 'numeric_range', key: 'price', op: 'lte', value: 100000 },
      { id: 'c2', type: 'enum_match', key: 'layout', value: '텐키리스' },
      { id: 'c3', type: 'boolean_flag', key: 'wireless', expected: true },
    ];
    const result = buildConstraintStatusMap(
      constraints,
      attrs({ price: 80000, layout: '풀배열', wireless: true }),
    );
    expect(Object.keys(result).length).toBe(3);
  });
});

// ===========================================================================
// 7. 모든 제약 타입 혼합 (numeric_range + enum_match + boolean_flag)
// ===========================================================================

describe('buildConstraintStatusMap - 모든 제약 타입 혼합', () => {
  it('numeric_range + enum_match + boolean_flag 각 1개씩', () => {
    const constraints: IdentifiedConstraint[] = [
      { id: 'budget', type: 'numeric_range', key: 'price', op: 'lte', value: 100000 },
      { id: 'layout', type: 'enum_match', key: 'layout', value: '텐키리스' },
      { id: 'wireless', type: 'boolean_flag', key: 'is_wireless', expected: false },
    ];
    const result = buildConstraintStatusMap(
      constraints,
      attrs({ price: 89000, layout: '텐키리스', is_wireless: false }),
    );
    expect(result).toEqual({
      budget: true,
      layout: true,
      wireless: true,
    });
  });

  it('numeric_range(lte) + numeric_range(gte) + enum_match 혼합', () => {
    const constraints: IdentifiedConstraint[] = [
      { id: 'price_max', type: 'numeric_range', key: 'price', op: 'lte', value: 150000 },
      { id: 'price_min', type: 'numeric_range', key: 'price', op: 'gte', value: 50000 },
      { id: 'conn', type: 'enum_match', key: 'connection', value: '무선' },
    ];
    const result = buildConstraintStatusMap(
      constraints,
      attrs({ price: 100000, connection: '유선' }),
    );
    expect(result).toEqual({
      price_max: true,  // 100000 <= 150000
      price_min: true,  // 100000 >= 50000
      conn: false,      // 유선 !== 무선
    });
  });
});

// ===========================================================================
// 8. 빈 속성 맵 - 모든 제약 fail
// ===========================================================================

describe('buildConstraintStatusMap - 빈 속성 맵', () => {
  it('빈 속성 맵 + 복수 제약 -> 모든 제약 false', () => {
    const constraints: IdentifiedConstraint[] = [
      { id: 'price_max', type: 'numeric_range', key: 'price', op: 'lte', value: 100000 },
      { id: 'layout_check', type: 'enum_match', key: 'layout', value: '텐키리스' },
      { id: 'wireless_flag', type: 'boolean_flag', key: 'wireless', expected: true },
    ];
    const result = buildConstraintStatusMap(constraints, attrs({}));
    expect(result).toEqual({
      price_max: false,
      layout_check: false,
      wireless_flag: false,
    });
  });

  it('빈 속성 + 단일 제약 -> false', () => {
    const constraints: IdentifiedConstraint[] = [
      { id: 'only_one', type: 'enum_match', key: 'switch_type', value: '기계식' },
    ];
    const result = buildConstraintStatusMap(constraints, attrs({}));
    expect(result).toEqual({ only_one: false });
  });
});

// ===========================================================================
// 9. 동일 ID 중복 시 마지막 결과 유지
// ===========================================================================

describe('buildConstraintStatusMap - 동일 ID 중복', () => {
  it('같은 ID로 두 번 등장 - 마지막 평가 결과(false)가 맵에 기록', () => {
    const constraints: IdentifiedConstraint[] = [
      { id: 'price_check', type: 'numeric_range', key: 'price', op: 'lte', value: 100000 }, // true
      { id: 'price_check', type: 'numeric_range', key: 'price', op: 'lte', value: 50000 },  // false (마지막)
    ];
    const result = buildConstraintStatusMap(constraints, attrs({ price: 80000 }));
    expect(result.price_check).toBe(false); // 마지막 값
  });

  it('같은 ID로 두 번 등장 - 마지막 평가 결과(true)가 맵에 기록', () => {
    const constraints: IdentifiedConstraint[] = [
      { id: 'price_check', type: 'numeric_range', key: 'price', op: 'lte', value: 50000 },  // false
      { id: 'price_check', type: 'numeric_range', key: 'price', op: 'lte', value: 100000 }, // true (마지막)
    ];
    const result = buildConstraintStatusMap(constraints, attrs({ price: 80000 }));
    expect(result.price_check).toBe(true); // 마지막 값
  });
});

// ===========================================================================
// 10. 실제 키보드 속성 시나리오
// ===========================================================================

describe('buildConstraintStatusMap - 실제 키보드 속성 시나리오', () => {
  // 실제 키보드 레코드 유사 속성 맵
  const gamingKbAttrs: KeyboardAttributes = {
    product_name: '게이밍 기계식 키보드',
    brand: 'GameBrand',
    price: 129000,
    switch_type: '기계식',
    connection: '유선',
    layout: '풀배열',
    weight_g: 950,
    engraving: '한/영 정각',
    backlight: 'RGB 백라이트',
  };

  it('게이밍 키보드 - 가격 제약 충족, layout 위반 시나리오', () => {
    const constraints: IdentifiedConstraint[] = [
      { id: 'budget', type: 'numeric_range', key: 'price', op: 'lte', value: 150000 },
      { id: 'layout', type: 'enum_match', key: 'layout', value: '텐키리스' }, // 위반
      { id: 'switch', type: 'enum_match', key: 'switch_type', value: '기계식' },
    ];
    const result = buildConstraintStatusMap(constraints, gamingKbAttrs);
    expect(result.budget).toBe(true);
    expect(result.layout).toBe(false);
    expect(result.switch).toBe(true);
  });

  it('게이밍 키보드 - 무선 제약 위반 시나리오', () => {
    const constraints: IdentifiedConstraint[] = [
      { id: 'conn', type: 'enum_match', key: 'connection', value: '무선' }, // 위반
      { id: 'backlight', type: 'enum_match', key: 'backlight', value: 'RGB 백라이트' }, // 충족
    ];
    const result = buildConstraintStatusMap(constraints, gamingKbAttrs);
    expect(result.conn).toBe(false);
    expect(result.backlight).toBe(true);
  });

  // 사무용 키보드 속성
  const officeKbAttrs: KeyboardAttributes = {
    product_name: '조용한 사무용 키보드',
    brand: 'OfficeBrand',
    price: 79000,
    switch_type: '무접점',
    connection: '무선',
    layout: '텐키리스',
    weight_g: 620,
    backlight: '백라이트 없음',
  };

  it('사무용 키보드 - 가격+레이아웃+스위치 모두 충족', () => {
    const constraints: IdentifiedConstraint[] = [
      { id: 'budget', type: 'numeric_range', key: 'price', op: 'lte', value: 100000 },
      { id: 'layout', type: 'enum_match', key: 'layout', value: '텐키리스' },
      { id: 'switch', type: 'enum_match', key: 'switch_type', value: '무접점' },
      { id: 'conn', type: 'enum_match', key: 'connection', value: '무선' },
    ];
    const result = buildConstraintStatusMap(constraints, officeKbAttrs);
    expect(result).toEqual({
      budget: true,
      layout: true,
      switch: true,
      conn: true,
    });
  });

  it('사무용 키보드 - 가격 하한 위반 시나리오', () => {
    const constraints: IdentifiedConstraint[] = [
      { id: 'price_min', type: 'numeric_range', key: 'price', op: 'gte', value: 100000 }, // 위반 (79000 < 100000)
      { id: 'layout', type: 'enum_match', key: 'layout', value: '텐키리스' },
    ];
    const result = buildConstraintStatusMap(constraints, officeKbAttrs);
    expect(result.price_min).toBe(false);
    expect(result.layout).toBe(true);
  });

  it('맵 값은 모두 boolean 타입', () => {
    const constraints: IdentifiedConstraint[] = [
      { id: 'c1', type: 'numeric_range', key: 'price', op: 'lte', value: 100000 },
      { id: 'c2', type: 'enum_match', key: 'layout', value: '텐키리스' },
      { id: 'c3', type: 'enum_match', key: 'switch_type', value: '기계식' }, // 위반
    ];
    const result = buildConstraintStatusMap(constraints, officeKbAttrs);
    for (const val of Object.values(result)) {
      expect(typeof val).toBe('boolean');
    }
  });
});
