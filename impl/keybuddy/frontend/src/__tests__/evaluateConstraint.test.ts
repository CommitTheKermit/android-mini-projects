/**
 * evaluateConstraint 단위테스트 (Sub-AC 7-2a)
 *
 * 커버리지:
 * 1. numeric_range - lte/gte/eq 충족/위반 케이스 + 경계값 + missing/타입불일치
 * 2. enum_match    - 일치/불일치 + 대소문자 + missing/타입불일치
 * 3. boolean_flag  - expected true/false + missing/타입불일치
 * 4. 알 수 없는 type - false 반환 (안전한 기본값)
 * 5. 속성 키 부재 - 모든 제약 타입에서 false 반환
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateConstraint,
  type NumericRangeConstraint,
  type EnumMatchConstraint,
  type BooleanFlagConstraint,
  type Constraint,
  type KeyboardAttributes,
} from '../lib/evaluateConstraint';

// ---------------------------------------------------------------------------
// 헬퍼: 속성 맵 생성
// ---------------------------------------------------------------------------

function attrs(partial: KeyboardAttributes): KeyboardAttributes {
  return partial;
}

// ===========================================================================
// 1. numeric_range
// ===========================================================================

// ---------------------------------------------------------------------------
// 1-1. lte (이하)
// ---------------------------------------------------------------------------

describe('evaluateConstraint - numeric_range lte (이하)', () => {
  const constraint: NumericRangeConstraint = {
    type: 'numeric_range',
    key: 'price',
    op: 'lte',
    value: 100000,
  };

  it('price(80000) <= 100000 -> true (충족)', () => {
    expect(evaluateConstraint(constraint, attrs({ price: 80000 }))).toBe(true);
  });

  it('price(100000) <= 100000 -> true (경계값 동일, 충족)', () => {
    expect(evaluateConstraint(constraint, attrs({ price: 100000 }))).toBe(true);
  });

  it('price(99999) <= 100000 -> true (경계값-1, 충족)', () => {
    expect(evaluateConstraint(constraint, attrs({ price: 99999 }))).toBe(true);
  });

  it('price(100001) <= 100000 -> false (경계값+1, 위반)', () => {
    expect(evaluateConstraint(constraint, attrs({ price: 100001 }))).toBe(false);
  });

  it('price(200000) <= 100000 -> false (위반)', () => {
    expect(evaluateConstraint(constraint, attrs({ price: 200000 }))).toBe(false);
  });

  it('price(0) <= 100000 -> true (0은 항상 이하)', () => {
    expect(evaluateConstraint(constraint, attrs({ price: 0 }))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 1-2. gte (이상)
// ---------------------------------------------------------------------------

describe('evaluateConstraint - numeric_range gte (이상)', () => {
  const constraint: NumericRangeConstraint = {
    type: 'numeric_range',
    key: 'weight_g',
    op: 'gte',
    value: 900,
  };

  it('weight_g(1000) >= 900 -> true (충족)', () => {
    expect(evaluateConstraint(constraint, attrs({ weight_g: 1000 }))).toBe(true);
  });

  it('weight_g(900) >= 900 -> true (경계값 동일, 충족)', () => {
    expect(evaluateConstraint(constraint, attrs({ weight_g: 900 }))).toBe(true);
  });

  it('weight_g(901) >= 900 -> true (경계값+1, 충족)', () => {
    expect(evaluateConstraint(constraint, attrs({ weight_g: 901 }))).toBe(true);
  });

  it('weight_g(899) >= 900 -> false (경계값-1, 위반)', () => {
    expect(evaluateConstraint(constraint, attrs({ weight_g: 899 }))).toBe(false);
  });

  it('weight_g(500) >= 900 -> false (위반)', () => {
    expect(evaluateConstraint(constraint, attrs({ weight_g: 500 }))).toBe(false);
  });

  it('weight_g(0) >= 900 -> false (0은 항상 이하)', () => {
    expect(evaluateConstraint(constraint, attrs({ weight_g: 0 }))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 1-3. eq (숫자 동일)
// ---------------------------------------------------------------------------

describe('evaluateConstraint - numeric_range eq (숫자 동일)', () => {
  const constraint: NumericRangeConstraint = {
    type: 'numeric_range',
    key: 'price',
    op: 'eq',
    value: 50000,
  };

  it('price(50000) === 50000 -> true (충족)', () => {
    expect(evaluateConstraint(constraint, attrs({ price: 50000 }))).toBe(true);
  });

  it('price(49999) === 50000 -> false (위반)', () => {
    expect(evaluateConstraint(constraint, attrs({ price: 49999 }))).toBe(false);
  });

  it('price(50001) === 50000 -> false (위반)', () => {
    expect(evaluateConstraint(constraint, attrs({ price: 50001 }))).toBe(false);
  });

  it('price(0) === 50000 -> false (위반)', () => {
    expect(evaluateConstraint(constraint, attrs({ price: 0 }))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 1-4. numeric_range - 타입 불일치 및 키 부재
// ---------------------------------------------------------------------------

describe('evaluateConstraint - numeric_range 타입 불일치/키 부재', () => {
  const constraint: NumericRangeConstraint = {
    type: 'numeric_range',
    key: 'price',
    op: 'lte',
    value: 100000,
  };

  it('속성 값이 string("80000")이면 false (타입 불일치)', () => {
    expect(evaluateConstraint(constraint, attrs({ price: '80000' as unknown as number }))).toBe(false);
  });

  it('속성 값이 boolean(true)이면 false (타입 불일치)', () => {
    expect(evaluateConstraint(constraint, attrs({ price: true as unknown as number }))).toBe(false);
  });

  it('키가 없으면 false (속성 부재)', () => {
    expect(evaluateConstraint(constraint, attrs({}))).toBe(false);
  });

  it('키가 undefined이면 false', () => {
    expect(evaluateConstraint(constraint, attrs({ price: undefined }))).toBe(false);
  });

  it('다른 키만 있고 price 키가 없으면 false', () => {
    expect(evaluateConstraint(constraint, attrs({ weight_g: 800 }))).toBe(false);
  });
});

// ===========================================================================
// 2. enum_match
// ===========================================================================

// ---------------------------------------------------------------------------
// 2-1. 충족 케이스
// ---------------------------------------------------------------------------

describe('evaluateConstraint - enum_match 충족', () => {
  it('layout 정확히 일치 -> true', () => {
    const c: EnumMatchConstraint = { type: 'enum_match', key: 'layout', value: '텐키리스' };
    expect(evaluateConstraint(c, attrs({ layout: '텐키리스' }))).toBe(true);
  });

  it('switch_type 정확히 일치 -> true', () => {
    const c: EnumMatchConstraint = { type: 'enum_match', key: 'switch_type', value: '기계식' };
    expect(evaluateConstraint(c, attrs({ switch_type: '기계식' }))).toBe(true);
  });

  it('connection 정확히 일치 -> true', () => {
    const c: EnumMatchConstraint = { type: 'enum_match', key: 'connection', value: '무선' };
    expect(evaluateConstraint(c, attrs({ connection: '무선' }))).toBe(true);
  });

  it('backlight 정확히 일치 -> true', () => {
    const c: EnumMatchConstraint = { type: 'enum_match', key: 'backlight', value: 'RGB 백라이트' };
    expect(evaluateConstraint(c, attrs({ backlight: 'RGB 백라이트' }))).toBe(true);
  });

  it('engraving 정확히 일치 -> true', () => {
    const c: EnumMatchConstraint = { type: 'enum_match', key: 'engraving', value: '한/영 정각' };
    expect(evaluateConstraint(c, attrs({ engraving: '한/영 정각' }))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2-2. 위반 케이스
// ---------------------------------------------------------------------------

describe('evaluateConstraint - enum_match 위반', () => {
  it('layout 불일치 -> false', () => {
    const c: EnumMatchConstraint = { type: 'enum_match', key: 'layout', value: '텐키리스' };
    expect(evaluateConstraint(c, attrs({ layout: '풀배열' }))).toBe(false);
  });

  it('switch_type 불일치 -> false', () => {
    const c: EnumMatchConstraint = { type: 'enum_match', key: 'switch_type', value: '기계식' };
    expect(evaluateConstraint(c, attrs({ switch_type: '무접점' }))).toBe(false);
  });

  it('connection 불일치 -> false', () => {
    const c: EnumMatchConstraint = { type: 'enum_match', key: 'connection', value: '무선' };
    expect(evaluateConstraint(c, attrs({ connection: '유선' }))).toBe(false);
  });

  it('대소문자 다름 -> false (대소문자 구분)', () => {
    const c: EnumMatchConstraint = { type: 'enum_match', key: 'layout', value: '텐키리스' };
    expect(evaluateConstraint(c, attrs({ layout: '텐키리스 ' }))).toBe(false); // trailing space
  });

  it('빈 문자열 vs 유효 값 -> false', () => {
    const c: EnumMatchConstraint = { type: 'enum_match', key: 'layout', value: '텐키리스' };
    expect(evaluateConstraint(c, attrs({ layout: '' }))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2-3. enum_match - 타입 불일치 및 키 부재
// ---------------------------------------------------------------------------

describe('evaluateConstraint - enum_match 타입 불일치/키 부재', () => {
  const c: EnumMatchConstraint = { type: 'enum_match', key: 'layout', value: '텐키리스' };

  it('속성 값이 number이면 false (타입 불일치)', () => {
    expect(evaluateConstraint(c, attrs({ layout: 1 as unknown as string }))).toBe(false);
  });

  it('속성 값이 boolean이면 false (타입 불일치)', () => {
    expect(evaluateConstraint(c, attrs({ layout: true as unknown as string }))).toBe(false);
  });

  it('키가 없으면 false (속성 부재)', () => {
    expect(evaluateConstraint(c, attrs({}))).toBe(false);
  });

  it('키가 undefined이면 false', () => {
    expect(evaluateConstraint(c, attrs({ layout: undefined }))).toBe(false);
  });

  it('다른 키만 있고 layout 키 없으면 false', () => {
    expect(evaluateConstraint(c, attrs({ price: 80000 }))).toBe(false);
  });
});

// ===========================================================================
// 3. boolean_flag
// ===========================================================================

// ---------------------------------------------------------------------------
// 3-1. expected: true
// ---------------------------------------------------------------------------

describe('evaluateConstraint - boolean_flag expected:true', () => {
  const c: BooleanFlagConstraint = { type: 'boolean_flag', key: 'wireless', expected: true };

  it('속성 true, expected true -> true (충족)', () => {
    expect(evaluateConstraint(c, attrs({ wireless: true }))).toBe(true);
  });

  it('속성 false, expected true -> false (위반)', () => {
    expect(evaluateConstraint(c, attrs({ wireless: false }))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3-2. expected: false
// ---------------------------------------------------------------------------

describe('evaluateConstraint - boolean_flag expected:false', () => {
  const c: BooleanFlagConstraint = { type: 'boolean_flag', key: 'wireless', expected: false };

  it('속성 false, expected false -> true (충족)', () => {
    expect(evaluateConstraint(c, attrs({ wireless: false }))).toBe(true);
  });

  it('속성 true, expected false -> false (위반)', () => {
    expect(evaluateConstraint(c, attrs({ wireless: true }))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3-3. boolean_flag - 타입 불일치 및 키 부재
// ---------------------------------------------------------------------------

describe('evaluateConstraint - boolean_flag 타입 불일치/키 부재', () => {
  const c: BooleanFlagConstraint = { type: 'boolean_flag', key: 'wireless', expected: true };

  it('속성 값이 string("true")이면 false (타입 불일치)', () => {
    expect(evaluateConstraint(c, attrs({ wireless: 'true' as unknown as boolean }))).toBe(false);
  });

  it('속성 값이 number(1)이면 false (타입 불일치)', () => {
    expect(evaluateConstraint(c, attrs({ wireless: 1 as unknown as boolean }))).toBe(false);
  });

  it('속성 값이 number(0)이면 false (타입 불일치)', () => {
    expect(evaluateConstraint(c, attrs({ wireless: 0 as unknown as boolean }))).toBe(false);
  });

  it('키가 없으면 false (속성 부재)', () => {
    expect(evaluateConstraint(c, attrs({}))).toBe(false);
  });

  it('키가 undefined이면 false', () => {
    expect(evaluateConstraint(c, attrs({ wireless: undefined }))).toBe(false);
  });
});

// ===========================================================================
// 4. 알 수 없는 type - false 반환 (안전한 기본값)
// ===========================================================================

describe('evaluateConstraint - 알 수 없는 type -> false (안전한 기본값)', () => {
  it('type: "unknown_type" -> false', () => {
    const c = { type: 'unknown_type', key: 'layout', value: '텐키리스' } as unknown as Constraint;
    expect(evaluateConstraint(c, attrs({ layout: '텐키리스' }))).toBe(false);
  });

  it('type: 빈 문자열 -> false', () => {
    const c = { type: '', key: 'price', value: 100000 } as unknown as Constraint;
    expect(evaluateConstraint(c, attrs({ price: 100000 }))).toBe(false);
  });

  it('type: "string_range" (오타) -> false', () => {
    const c = { type: 'string_range', key: 'price', op: 'lte', value: 100000 } as unknown as Constraint;
    expect(evaluateConstraint(c, attrs({ price: 80000 }))).toBe(false);
  });
});

// ===========================================================================
// 5. 복합 시나리오: 실제 키보드 속성 맵에 여러 제약 적용
// ===========================================================================

describe('evaluateConstraint - 복합 시나리오', () => {
  // 실제 키보드 레코드와 동일한 속성 맵
  const kbAttrs: KeyboardAttributes = {
    product_name: '테스트 기계식 키보드',
    brand: '테스트브랜드',
    price: 89000,
    switch_type: '기계식',
    connection: '유선',
    layout: '텐키리스',
    weight_g: 750,
    wireless_type: '유선',
    engraving: '한/영 정각',
    backlight: 'RGB 백라이트',
  };

  it('price lte 100000 -> true (충족)', () => {
    const c: NumericRangeConstraint = { type: 'numeric_range', key: 'price', op: 'lte', value: 100000 };
    expect(evaluateConstraint(c, kbAttrs)).toBe(true);
  });

  it('price lte 80000 -> false (위반)', () => {
    const c: NumericRangeConstraint = { type: 'numeric_range', key: 'price', op: 'lte', value: 80000 };
    expect(evaluateConstraint(c, kbAttrs)).toBe(false);
  });

  it('weight_g gte 800 -> false (750 < 800, 위반)', () => {
    const c: NumericRangeConstraint = { type: 'numeric_range', key: 'weight_g', op: 'gte', value: 800 };
    expect(evaluateConstraint(c, kbAttrs)).toBe(false);
  });

  it('weight_g lte 800 -> true (750 <= 800, 충족)', () => {
    const c: NumericRangeConstraint = { type: 'numeric_range', key: 'weight_g', op: 'lte', value: 800 };
    expect(evaluateConstraint(c, kbAttrs)).toBe(true);
  });

  it('layout enum_match 텐키리스 -> true (충족)', () => {
    const c: EnumMatchConstraint = { type: 'enum_match', key: 'layout', value: '텐키리스' };
    expect(evaluateConstraint(c, kbAttrs)).toBe(true);
  });

  it('layout enum_match 풀배열 -> false (위반)', () => {
    const c: EnumMatchConstraint = { type: 'enum_match', key: 'layout', value: '풀배열' };
    expect(evaluateConstraint(c, kbAttrs)).toBe(false);
  });

  it('switch_type enum_match 기계식 -> true (충족)', () => {
    const c: EnumMatchConstraint = { type: 'enum_match', key: 'switch_type', value: '기계식' };
    expect(evaluateConstraint(c, kbAttrs)).toBe(true);
  });

  it('switch_type enum_match 무접점 -> false (위반)', () => {
    const c: EnumMatchConstraint = { type: 'enum_match', key: 'switch_type', value: '무접점' };
    expect(evaluateConstraint(c, kbAttrs)).toBe(false);
  });

  it('connection enum_match 유선 -> true (충족)', () => {
    const c: EnumMatchConstraint = { type: 'enum_match', key: 'connection', value: '유선' };
    expect(evaluateConstraint(c, kbAttrs)).toBe(true);
  });

  it('connection enum_match 무선 -> false (위반)', () => {
    const c: EnumMatchConstraint = { type: 'enum_match', key: 'connection', value: '무선' };
    expect(evaluateConstraint(c, kbAttrs)).toBe(false);
  });

  it('여러 제약 순차 평가: 모두 충족 케이스', () => {
    const constraints: Constraint[] = [
      { type: 'numeric_range', key: 'price', op: 'lte', value: 100000 },
      { type: 'enum_match', key: 'layout', value: '텐키리스' },
      { type: 'enum_match', key: 'switch_type', value: '기계식' },
    ];
    const results = constraints.map((c) => evaluateConstraint(c, kbAttrs));
    expect(results).toEqual([true, true, true]);
  });

  it('여러 제약 순차 평가: 일부 위반 케이스', () => {
    const constraints: Constraint[] = [
      { type: 'numeric_range', key: 'price', op: 'lte', value: 80000 }, // 위반 (89000 > 80000)
      { type: 'enum_match', key: 'layout', value: '텐키리스' },           // 충족
      { type: 'enum_match', key: 'switch_type', value: '무접점' },        // 위반
    ];
    const results = constraints.map((c) => evaluateConstraint(c, kbAttrs));
    expect(results).toEqual([false, true, false]);
  });
});

// ===========================================================================
// 6. 빈 속성 맵 - 모든 제약 타입에서 false
// ===========================================================================

describe('evaluateConstraint - 빈 속성 맵 -> 모든 타입 false', () => {
  const empty: KeyboardAttributes = {};

  it('numeric_range + 빈 속성 맵 -> false', () => {
    const c: NumericRangeConstraint = { type: 'numeric_range', key: 'price', op: 'lte', value: 100000 };
    expect(evaluateConstraint(c, empty)).toBe(false);
  });

  it('enum_match + 빈 속성 맵 -> false', () => {
    const c: EnumMatchConstraint = { type: 'enum_match', key: 'layout', value: '텐키리스' };
    expect(evaluateConstraint(c, empty)).toBe(false);
  });

  it('boolean_flag + 빈 속성 맵 -> false', () => {
    const c: BooleanFlagConstraint = { type: 'boolean_flag', key: 'wireless', expected: true };
    expect(evaluateConstraint(c, empty)).toBe(false);
  });
});
