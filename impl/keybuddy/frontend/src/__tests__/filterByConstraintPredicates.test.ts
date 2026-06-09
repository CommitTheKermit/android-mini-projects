/**
 * filterByConstraintPredicates 단위 테스트 (Sub-AC 3-1)
 *
 * 속성 술어(hard constraint predicate) 목록과 키보드 카탈로그를 입력받아
 * 술어를 하나라도 위반하는 키보드를 제거하는 필터 함수 정확성 검증.
 *
 * 커버리지:
 * 1.  빈 constraints -> 모든 키보드 통과 (경계값)
 * 2.  enum_match 단일 술어 - 일치(통과) / 불일치(위반) 케이스
 * 3.  numeric_range lte 단일 술어 - 통과 / 위반 / 경계값
 * 4.  numeric_range gte 단일 술어
 * 5.  boolean_flag 단일 술어
 * 6.  복합 술어 (AND 로직) - 모두 만족 / 일부 위반
 * 7.  violations === 0 핵심 검증 - 반환 결과에 위반 키보드 0건
 * 8.  모든 키보드가 위반 -> 빈 배열 반환
 * 9.  알 수 없는 type -> 항상 false(실패) -> 위반으로 처리
 * 10. 원본 배열 불변성 (순수 함수)
 * 11. 다양한 필드 조합 (layout/switch_type/price/weight_g/connection)
 * 12. 빈 키보드 배열 + 임의 술어 -> 빈 배열
 */

import { describe, it, expect } from 'vitest';
import {
  filterByConstraintPredicates,
  type Constraint,
  type NumericRangeConstraint,
  type EnumMatchConstraint,
  type BooleanFlagConstraint,
  type KeyboardAttributes,
} from '../lib/evaluateConstraint';

// ---------------------------------------------------------------------------
// 헬퍼: 테스트용 키보드 속성 맵 생성
// ---------------------------------------------------------------------------

function makeKb(overrides: Partial<KeyboardAttributes> = {}): KeyboardAttributes {
  return {
    product_name: '테스트 키보드',
    brand: '테스트브랜드',
    price: 100000,
    switch_type: '기계식',
    connection: '유선',
    layout: '텐키리스',
    weight_g: 800,
    wireless_type: '유선',
    engraving: '한/영 정각',
    backlight: '없음',
    ...overrides,
  };
}

// ===========================================================================
// 1. 빈 constraints -> 모든 키보드 통과
// ===========================================================================

describe('filterByConstraintPredicates - 빈 constraints', () => {
  it('빈 constraints + 3개 키보드 -> 3개 모두 반환', () => {
    const kbs = [
      makeKb({ layout: '풀배열' }),
      makeKb({ layout: '텐키리스' }),
      makeKb({ layout: '미니' }),
    ];
    const result = filterByConstraintPredicates(kbs, []);
    expect(result).toHaveLength(3);
  });

  it('빈 constraints + 빈 키보드 배열 -> 빈 배열 반환', () => {
    expect(filterByConstraintPredicates([], [])).toHaveLength(0);
  });

  it('빈 constraints + 1개 키보드 -> 1개 반환', () => {
    const result = filterByConstraintPredicates([makeKb()], []);
    expect(result).toHaveLength(1);
  });
});

// ===========================================================================
// 2. enum_match 단일 술어 - 통과/위반
// ===========================================================================

describe('filterByConstraintPredicates - enum_match 단일 술어', () => {
  const layoutConstraint: EnumMatchConstraint = {
    type: 'enum_match',
    key: 'layout',
    value: '텐키리스',
  };

  it('일치 키보드만 통과: 텐키리스 제약 -> 텐키리스 키보드만 남음', () => {
    const kbs = [
      makeKb({ layout: '텐키리스' }),
      makeKb({ layout: '풀배열' }),
      makeKb({ layout: '미니' }),
      makeKb({ layout: '텐키리스' }),
    ];
    const result = filterByConstraintPredicates(kbs, [layoutConstraint]);
    expect(result).toHaveLength(2);
    result.forEach((kb) => expect(kb.layout).toBe('텐키리스'));
  });

  it('불일치 키보드는 모두 제외: 결과 0건', () => {
    const kbs = [makeKb({ layout: '풀배열' }), makeKb({ layout: '미니' })];
    const result = filterByConstraintPredicates(kbs, [layoutConstraint]);
    expect(result).toHaveLength(0);
  });

  it('switch_type 제약: 기계식만 통과', () => {
    const kbs = [
      makeKb({ switch_type: '기계식' }),
      makeKb({ switch_type: '무접점' }),
      makeKb({ switch_type: '펜타그래프' }),
      makeKb({ switch_type: '기계식' }),
    ];
    const c: EnumMatchConstraint = { type: 'enum_match', key: 'switch_type', value: '기계식' };
    const result = filterByConstraintPredicates(kbs, [c]);
    expect(result).toHaveLength(2);
    result.forEach((kb) => expect(kb.switch_type).toBe('기계식'));
  });

  it('connection 제약: 무선 요구 -> 유선 키보드 제외', () => {
    const kbs = [
      makeKb({ connection: '무선' }),
      makeKb({ connection: '유선' }),
      makeKb({ connection: '유선+무선' }),
    ];
    const c: EnumMatchConstraint = { type: 'enum_match', key: 'connection', value: '무선' };
    const result = filterByConstraintPredicates(kbs, [c]);
    expect(result).toHaveLength(1);
    expect(result[0].connection).toBe('무선');
  });
});

// ===========================================================================
// 3. numeric_range lte (이하) 단일 술어 - 통과/위반/경계값
// ===========================================================================

describe('filterByConstraintPredicates - numeric_range lte 단일 술어', () => {
  const priceConstraint: NumericRangeConstraint = {
    type: 'numeric_range',
    key: 'price',
    op: 'lte',
    value: 100000,
  };

  it('가격 이하 키보드만 통과: 100000원 상한', () => {
    const kbs = [
      makeKb({ price: 80000 }),
      makeKb({ price: 100000 }), // 경계값 - 통과
      makeKb({ price: 150000 }), // 위반
      makeKb({ price: 50000 }),
    ];
    const result = filterByConstraintPredicates(kbs, [priceConstraint]);
    expect(result).toHaveLength(3);
    result.forEach((kb) => expect((kb.price as number)).toBeLessThanOrEqual(100000));
  });

  it('경계값(100000)은 통과해야 한다', () => {
    const kbs = [makeKb({ price: 100000 }), makeKb({ price: 100001 })];
    const result = filterByConstraintPredicates(kbs, [priceConstraint]);
    expect(result).toHaveLength(1);
    expect(result[0].price).toBe(100000);
  });

  it('결과의 모든 키보드 가격이 상한 이하 (violations===0)', () => {
    const kbs = [
      makeKb({ price: 50000 }),
      makeKb({ price: 99999 }),
      makeKb({ price: 100001 }),
      makeKb({ price: 300000 }),
    ];
    const result = filterByConstraintPredicates(kbs, [priceConstraint]);
    const violations = result.filter((kb) => (kb.price as number) > 100000).length;
    expect(violations).toBe(0);
  });
});

// ===========================================================================
// 4. numeric_range gte (이상) 단일 술어
// ===========================================================================

describe('filterByConstraintPredicates - numeric_range gte 단일 술어', () => {
  const weightConstraint: NumericRangeConstraint = {
    type: 'numeric_range',
    key: 'weight_g',
    op: 'gte',
    value: 900,
  };

  it('무게 900g 이상 키보드만 통과', () => {
    const kbs = [
      makeKb({ weight_g: 1200 }),
      makeKb({ weight_g: 900 }),  // 경계값 - 통과
      makeKb({ weight_g: 899 }),  // 위반
      makeKb({ weight_g: 500 }),
    ];
    const result = filterByConstraintPredicates(kbs, [weightConstraint]);
    expect(result).toHaveLength(2);
    result.forEach((kb) => expect((kb.weight_g as number)).toBeGreaterThanOrEqual(900));
  });
});

// ===========================================================================
// 5. boolean_flag 단일 술어
// ===========================================================================

describe('filterByConstraintPredicates - boolean_flag 단일 술어', () => {
  it('expected:true -> true인 키보드만 통과', () => {
    const kbs = [
      { ...makeKb(), wireless: true },
      { ...makeKb(), wireless: false },
      { ...makeKb(), wireless: true },
    ];
    const c: BooleanFlagConstraint = { type: 'boolean_flag', key: 'wireless', expected: true };
    const result = filterByConstraintPredicates(kbs, [c]);
    expect(result).toHaveLength(2);
    result.forEach((kb) => expect(kb.wireless).toBe(true));
  });

  it('expected:false -> false인 키보드만 통과', () => {
    const kbs = [
      { ...makeKb(), is_backlit: true },
      { ...makeKb(), is_backlit: false },
      { ...makeKb(), is_backlit: false },
    ];
    const c: BooleanFlagConstraint = { type: 'boolean_flag', key: 'is_backlit', expected: false };
    const result = filterByConstraintPredicates(kbs, [c]);
    expect(result).toHaveLength(2);
    result.forEach((kb) => expect(kb.is_backlit).toBe(false));
  });
});

// ===========================================================================
// 6. 복합 술어 (AND 로직) - 모두 만족 / 일부 위반
// ===========================================================================

describe('filterByConstraintPredicates - 복합 술어 AND 로직', () => {
  it('layout + price_max 복합: 두 조건 모두 만족하는 키보드만 통과', () => {
    const kbs = [
      makeKb({ layout: '텐키리스', price: 80000 }),   // 통과
      makeKb({ layout: '텐키리스', price: 150000 }),  // price 위반
      makeKb({ layout: '풀배열', price: 80000 }),     // layout 위반
      makeKb({ layout: '풀배열', price: 200000 }),    // 둘 다 위반
      makeKb({ layout: '텐키리스', price: 100000 }),  // 통과 (경계값)
    ];
    const constraints: Constraint[] = [
      { type: 'enum_match', key: 'layout', value: '텐키리스' },
      { type: 'numeric_range', key: 'price', op: 'lte', value: 100000 },
    ];
    const result = filterByConstraintPredicates(kbs, constraints);
    expect(result).toHaveLength(2);
    result.forEach((kb) => {
      expect(kb.layout).toBe('텐키리스');
      expect((kb.price as number)).toBeLessThanOrEqual(100000);
    });
  });

  it('layout + switch_type + price_max 복합: 세 조건 모두 만족해야 통과', () => {
    const kbs = [
      makeKb({ layout: '텐키리스', switch_type: '기계식', price: 80000 }),  // 통과
      makeKb({ layout: '미니', switch_type: '기계식', price: 80000 }),      // layout 위반
      makeKb({ layout: '텐키리스', switch_type: '무접점', price: 80000 }), // switch 위반
      makeKb({ layout: '텐키리스', switch_type: '기계식', price: 200000 }), // price 위반
      makeKb({ layout: '텐키리스', switch_type: '기계식', price: 60000 }),  // 통과
    ];
    const constraints: Constraint[] = [
      { type: 'enum_match', key: 'layout', value: '텐키리스' },
      { type: 'enum_match', key: 'switch_type', value: '기계식' },
      { type: 'numeric_range', key: 'price', op: 'lte', value: 100000 },
    ];
    const result = filterByConstraintPredicates(kbs, constraints);
    expect(result).toHaveLength(2);
    result.forEach((kb) => {
      expect(kb.layout).toBe('텐키리스');
      expect(kb.switch_type).toBe('기계식');
      expect((kb.price as number)).toBeLessThanOrEqual(100000);
    });
  });
});

// ===========================================================================
// 7. violations === 0 핵심 검증
// ===========================================================================

describe('filterByConstraintPredicates - violations === 0 핵심 검증', () => {
  it('다양한 위반 유형 혼합 목록에서 결과의 모든 키보드가 제약을 위반하지 않는다', () => {
    const constraints: Constraint[] = [
      { type: 'enum_match', key: 'layout', value: '텐키리스' },
      { type: 'numeric_range', key: 'price', op: 'lte', value: 150000 },
      { type: 'enum_match', key: 'switch_type', value: '기계식' },
    ];
    const kbs = [
      makeKb({ layout: '텐키리스', price: 100000, switch_type: '기계식' }),   // 통과
      makeKb({ layout: '풀배열', price: 100000, switch_type: '기계식' }),     // layout 위반
      makeKb({ layout: '텐키리스', price: 200000, switch_type: '기계식' }),   // price 위반
      makeKb({ layout: '텐키리스', price: 100000, switch_type: '펜타그래프' }), // switch 위반
      makeKb({ layout: '미니', price: 300000, switch_type: '무접점' }),        // 전부 위반
      makeKb({ layout: '텐키리스', price: 120000, switch_type: '기계식' }),   // 통과
      makeKb({ layout: '텐키리스', price: 150000, switch_type: '기계식' }),   // 통과 (경계값)
    ];

    const result = filterByConstraintPredicates(kbs, constraints);

    // violations === 0 검증
    const layoutViolations = result.filter((kb) => kb.layout !== '텐키리스').length;
    const priceViolations = result.filter((kb) => (kb.price as number) > 150000).length;
    const switchViolations = result.filter((kb) => kb.switch_type !== '기계식').length;
    expect(layoutViolations).toBe(0);
    expect(priceViolations).toBe(0);
    expect(switchViolations).toBe(0);
    expect(result).toHaveLength(3);
  });
});

// ===========================================================================
// 8. 모든 키보드가 위반 -> 빈 배열 반환
// ===========================================================================

describe('filterByConstraintPredicates - 모든 키보드가 위반', () => {
  it('모든 키보드가 layout 위반 -> 빈 배열', () => {
    const kbs = [
      makeKb({ layout: '풀배열' }),
      makeKb({ layout: '미니' }),
      makeKb({ layout: '98키' }),
    ];
    const result = filterByConstraintPredicates(kbs, [
      { type: 'enum_match', key: 'layout', value: '텐키리스' },
    ]);
    expect(result).toHaveLength(0);
  });

  it('모든 키보드가 price 위반 -> 빈 배열', () => {
    const kbs = [
      makeKb({ price: 200000 }),
      makeKb({ price: 300000 }),
    ];
    const result = filterByConstraintPredicates(kbs, [
      { type: 'numeric_range', key: 'price', op: 'lte', value: 50000 },
    ]);
    expect(result).toHaveLength(0);
  });
});

// ===========================================================================
// 9. 알 수 없는 type -> false(실패) -> 위반으로 처리
// ===========================================================================

describe('filterByConstraintPredicates - 알 수 없는 type -> 위반으로 처리', () => {
  it('unknown type 술어 -> evaluateConstraint가 false 반환 -> 모든 키보드 위반 취급', () => {
    const kbs = [
      makeKb({ layout: '텐키리스' }),
      makeKb({ layout: '풀배열' }),
    ];
    const unknownConstraint = {
      type: 'unknown_predicate_type',
      key: 'layout',
      value: '텐키리스',
    } as unknown as Constraint;

    // 알 수 없는 type은 evaluateConstraint가 false 반환 -> 위반 -> 빈 배열
    const result = filterByConstraintPredicates(kbs, [unknownConstraint]);
    expect(result).toHaveLength(0);
  });

  it('유효한 술어와 unknown type 혼합: unknown type 위반으로 0건 반환', () => {
    const kbs = [makeKb({ layout: '텐키리스' })];
    const constraints: Constraint[] = [
      { type: 'enum_match', key: 'layout', value: '텐키리스' }, // 통과
      { type: 'unknown_type', key: 'layout', value: '텐키리스' } as unknown as Constraint, // 위반
    ];
    const result = filterByConstraintPredicates(kbs, constraints);
    expect(result).toHaveLength(0);
  });
});

// ===========================================================================
// 10. 원본 배열 불변성 (순수 함수)
// ===========================================================================

describe('filterByConstraintPredicates - 원본 배열 불변성', () => {
  it('필터링 후 원본 배열의 길이와 참조가 변경되지 않는다', () => {
    const kbs = [
      makeKb({ layout: '텐키리스' }),
      makeKb({ layout: '풀배열' }),
      makeKb({ layout: '미니' }),
    ];
    const original = kbs.slice();
    filterByConstraintPredicates(kbs, [
      { type: 'enum_match', key: 'layout', value: '텐키리스' },
    ]);
    expect(kbs).toHaveLength(3);
    kbs.forEach((kb, i) => expect(kb).toBe(original[i]));
  });

  it('빈 constraints 필터 후 원본 배열 변경 없음', () => {
    const kbs = [makeKb(), makeKb({ layout: '풀배열' })];
    const original = kbs.slice();
    filterByConstraintPredicates(kbs, []);
    expect(kbs).toHaveLength(original.length);
  });
});

// ===========================================================================
// 11. 다양한 필드 조합
// ===========================================================================

describe('filterByConstraintPredicates - 다양한 필드 조합', () => {
  it('weight_g gte + connection enum_match 복합', () => {
    const kbs = [
      makeKb({ weight_g: 1000, connection: '유선' }),   // 통과
      makeKb({ weight_g: 800, connection: '유선' }),    // weight 위반
      makeKb({ weight_g: 1000, connection: '무선' }),   // connection 위반
      makeKb({ weight_g: 900, connection: '유선' }),    // 통과 (경계값)
    ];
    const constraints: Constraint[] = [
      { type: 'numeric_range', key: 'weight_g', op: 'gte', value: 900 },
      { type: 'enum_match', key: 'connection', value: '유선' },
    ];
    const result = filterByConstraintPredicates(kbs, constraints);
    expect(result).toHaveLength(2);
    result.forEach((kb) => {
      expect((kb.weight_g as number)).toBeGreaterThanOrEqual(900);
      expect(kb.connection).toBe('유선');
    });
  });

  it('backlight enum_match + engraving enum_match', () => {
    const kbs = [
      makeKb({ backlight: 'RGB 백라이트', engraving: '한/영 정각' }),   // 통과
      makeKb({ backlight: '없음', engraving: '한/영 정각' }),           // backlight 위반
      makeKb({ backlight: 'RGB 백라이트', engraving: '영문 정각' }),    // engraving 위반
    ];
    const constraints: Constraint[] = [
      { type: 'enum_match', key: 'backlight', value: 'RGB 백라이트' },
      { type: 'enum_match', key: 'engraving', value: '한/영 정각' },
    ];
    const result = filterByConstraintPredicates(kbs, constraints);
    expect(result).toHaveLength(1);
    expect(result[0].backlight).toBe('RGB 백라이트');
    expect(result[0].engraving).toBe('한/영 정각');
  });

  it('price lte + price gte (범위 조합): 범위 내 키보드만 통과', () => {
    const kbs = [
      makeKb({ price: 30000 }),   // 하한 미만 위반
      makeKb({ price: 50000 }),   // 통과 (경계값)
      makeKb({ price: 80000 }),   // 통과
      makeKb({ price: 100000 }),  // 통과 (경계값)
      makeKb({ price: 150000 }),  // 상한 초과 위반
    ];
    const constraints: Constraint[] = [
      { type: 'numeric_range', key: 'price', op: 'gte', value: 50000 },
      { type: 'numeric_range', key: 'price', op: 'lte', value: 100000 },
    ];
    const result = filterByConstraintPredicates(kbs, constraints);
    expect(result).toHaveLength(3);
    result.forEach((kb) => {
      const p = kb.price as number;
      expect(p).toBeGreaterThanOrEqual(50000);
      expect(p).toBeLessThanOrEqual(100000);
    });
  });
});

// ===========================================================================
// 12. 빈 키보드 배열 + 임의 술어 -> 빈 배열
// ===========================================================================

describe('filterByConstraintPredicates - 빈 키보드 배열', () => {
  it('빈 키보드 배열 + 단일 술어 -> 빈 배열', () => {
    const result = filterByConstraintPredicates([], [
      { type: 'enum_match', key: 'layout', value: '텐키리스' },
    ]);
    expect(result).toHaveLength(0);
  });

  it('빈 키보드 배열 + 복합 술어 -> 빈 배열', () => {
    const constraints: Constraint[] = [
      { type: 'enum_match', key: 'layout', value: '텐키리스' },
      { type: 'numeric_range', key: 'price', op: 'lte', value: 100000 },
    ];
    const result = filterByConstraintPredicates([], constraints);
    expect(result).toHaveLength(0);
  });
});

// ===========================================================================
// 13. 실제 키보드 레코드 기반 시나리오 (게이밍 / 사무용)
// ===========================================================================

describe('filterByConstraintPredicates - 실제 키보드 시나리오', () => {
  // 실제 카탈로그 유사 키보드 픽스처
  const catalog: KeyboardAttributes[] = [
    makeKb({ product_name: '게이밍 기계식 풀배열 RGB', switch_type: '기계식', layout: '풀배열', backlight: 'RGB 백라이트', price: 120000, connection: '유선', weight_g: 950 }),
    makeKb({ product_name: '사무용 무접점 텐키리스 무선', switch_type: '무접점', layout: '텐키리스', backlight: '없음', price: 180000, connection: '무선', weight_g: 620 }),
    makeKb({ product_name: '가성비 펜타그래프 풀배열', switch_type: '펜타그래프', layout: '풀배열', backlight: '없음', price: 45000, connection: '유선', weight_g: 900 }),
    makeKb({ product_name: '휴대용 기계식 미니 무선', switch_type: '기계식', layout: '미니', backlight: 'RGB 백라이트', price: 89000, connection: '무선', weight_g: 520 }),
    makeKb({ product_name: '프리미엄 무접점 자석축 텐키리스 유선', switch_type: '무접점 자석축', layout: '텐키리스', backlight: '없음', price: 250000, connection: '유선', weight_g: 780 }),
  ];

  it('게이밍 시나리오: layout=풀배열 + backlight=RGB 백라이트', () => {
    const constraints: Constraint[] = [
      { type: 'enum_match', key: 'layout', value: '풀배열' },
      { type: 'enum_match', key: 'backlight', value: 'RGB 백라이트' },
    ];
    const result = filterByConstraintPredicates(catalog, constraints);
    expect(result).toHaveLength(1);
    expect(result[0].product_name).toBe('게이밍 기계식 풀배열 RGB');
  });

  it('사무용 시나리오: layout=텐키리스 + connection=무선 + price lte 200000', () => {
    const constraints: Constraint[] = [
      { type: 'enum_match', key: 'layout', value: '텐키리스' },
      { type: 'enum_match', key: 'connection', value: '무선' },
      { type: 'numeric_range', key: 'price', op: 'lte', value: 200000 },
    ];
    const result = filterByConstraintPredicates(catalog, constraints);
    expect(result).toHaveLength(1);
    expect(result[0].product_name).toBe('사무용 무접점 텐키리스 무선');
  });

  it('가성비 시나리오: price lte 50000', () => {
    const constraints: Constraint[] = [
      { type: 'numeric_range', key: 'price', op: 'lte', value: 50000 },
    ];
    const result = filterByConstraintPredicates(catalog, constraints);
    expect(result).toHaveLength(1);
    expect(result[0].product_name).toContain('펜타그래프');
  });

  it('violations===0: 복합 제약 결과의 모든 키보드가 제약을 위반하지 않는다', () => {
    const constraints: Constraint[] = [
      { type: 'enum_match', key: 'connection', value: '유선' },
      { type: 'numeric_range', key: 'price', op: 'lte', value: 200000 },
    ];
    const result = filterByConstraintPredicates(catalog, constraints);

    const connViolations = result.filter((kb) => kb.connection !== '유선').length;
    const priceViolations = result.filter((kb) => (kb.price as number) > 200000).length;
    expect(connViolations).toBe(0);
    expect(priceViolations).toBe(0);
  });
});
