/**
 * relaxAndSearch 단위 테스트 (Sub-AC 6-3)
 *
 * relaxAndSearch(hardConstraints, searchFn) 함수 검증:
 * - searchFn 결과가 0개이면 역순 우선순위(HARD_CONSTRAINT_RELAXATION_ORDER)대로
 *   제약을 1개씩 제거하며 searchFn을 재호출한다.
 * - 첫 번째 비공(非空) 결과 시점에
 *   { results, relaxedConstraints: string[], relaxationSteps: number } 를 반환한다.
 * - mock searchFn으로 검색 경로에 LLM 호출 없음을 보장한다.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  relaxAndSearch,
  HARD_CONSTRAINT_RELAXATION_ORDER,
  type RelaxAndSearchResult,
} from '../lib/searchEngine';
import type { HardConstraints } from '../lib/extractRawTags';

// ---------------------------------------------------------------------------
// 픽스처 헬퍼
// ---------------------------------------------------------------------------

type MockResult = { id: number };

/** 항상 빈 배열을 반환하는 mock searchFn */
function alwaysEmpty(_: HardConstraints): MockResult[] {
  return [];
}

/** 항상 결과를 반환하는 mock searchFn */
function alwaysFound(_: HardConstraints): MockResult[] {
  return [{ id: 1 }, { id: 2 }];
}

// ===========================================================================
// 1. 초기 검색에서 결과가 있으면 완화 없이 즉시 반환
// ===========================================================================

describe('relaxAndSearch - 초기 결과 있으면 완화 없이 반환', () => {
  it('searchFn이 즉시 결과를 반환하면 relaxedConstraints=[]', () => {
    const result = relaxAndSearch<MockResult>({ layout: '텐키리스' }, alwaysFound);
    expect(result.relaxedConstraints).toEqual([]);
    expect(result.relaxationSteps).toBe(0);
    expect(result.results.length).toBeGreaterThan(0);
  });

  it('searchFn이 즉시 결과를 반환하면 relaxationSteps=0', () => {
    const result = relaxAndSearch<MockResult>({ switch_type: '기계식' }, alwaysFound);
    expect(result.relaxationSteps).toBe(0);
  });

  it('빈 hardConstraints로 즉시 결과가 나오면 완화 없이 반환', () => {
    const result = relaxAndSearch<MockResult>({}, alwaysFound);
    expect(result.relaxedConstraints).toEqual([]);
    expect(result.relaxationSteps).toBe(0);
    expect(result.results).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('searchFn 호출 횟수: 초기 1회만 호출된다', () => {
    const mockFn = vi.fn().mockReturnValue([{ id: 1 }]);
    relaxAndSearch<MockResult>({ layout: '텐키리스' }, mockFn);
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('searchFn은 원본 hardConstraints로 호출된다', () => {
    const mockFn = vi.fn().mockReturnValue([{ id: 1 }]);
    const hc: HardConstraints = { layout: '텐키리스', price_max: 100_000 };
    relaxAndSearch<MockResult>(hc, mockFn);
    expect(mockFn).toHaveBeenCalledWith(hc);
  });
});

// ===========================================================================
// 2. 결과 0건 -> 제약 1개 완화 후 결과 반환
// ===========================================================================

describe('relaxAndSearch - 1단계 완화 후 결과 반환', () => {
  it('price_min 1개 제약: 첫 완화(price_min 제거) 후 결과 반환', () => {
    // price_min이 HARD_CONSTRAINT_RELAXATION_ORDER[0]이므로 첫 번째로 완화됨
    let callCount = 0;
    const mockFn = vi.fn((hc: HardConstraints): MockResult[] => {
      callCount++;
      // 두 번째 호출(price_min 제거 후)에 결과 반환
      if (callCount >= 2) return [{ id: 99 }];
      return [];
    });

    const result = relaxAndSearch<MockResult>({ price_min: 50_000 }, mockFn);

    expect(result.relaxedConstraints).toEqual(['price_min']);
    expect(result.relaxationSteps).toBe(1);
    expect(result.results).toEqual([{ id: 99 }]);
  });

  it('relaxedConstraints에 제거된 제약 키가 포함된다', () => {
    const mockFn = vi.fn((hc: HardConstraints): MockResult[] => {
      if (!('layout' in hc)) return [{ id: 1 }];
      return [];
    });

    const result = relaxAndSearch<MockResult>({ layout: '텐키리스' }, mockFn);

    expect(result.relaxedConstraints).toContain('layout');
    expect(result.relaxationSteps).toBe(result.relaxedConstraints.length);
  });

  it('relaxationSteps === relaxedConstraints.length 불변', () => {
    let callCount = 0;
    const mockFn = vi.fn((_: HardConstraints): MockResult[] => {
      callCount++;
      if (callCount >= 3) return [{ id: 1 }]; // 2단계 완화 후 결과
      return [];
    });

    const result = relaxAndSearch<MockResult>(
      { layout: '텐키리스', switch_type: '기계식' },
      mockFn,
    );

    expect(result.relaxationSteps).toBe(result.relaxedConstraints.length);
  });
});

// ===========================================================================
// 3. 역순 우선순위 완화 순서 검증
// ===========================================================================

describe('relaxAndSearch - HARD_CONSTRAINT_RELAXATION_ORDER 순서 준수', () => {
  it('HARD_CONSTRAINT_RELAXATION_ORDER 순서대로 제약을 제거한다', () => {
    const callLog: Array<keyof HardConstraints> = [];

    // 항상 빈 배열 반환 -> 모든 제약 순서대로 제거됨
    const mockFn = vi.fn((hc: HardConstraints): MockResult[] => {
      // 이전 호출 대비 제거된 키를 추적
      return [];
    });

    const hc: HardConstraints = {
      price_min: 10_000,
      layout: '텐키리스',
      price_max: 200_000,
    };

    relaxAndSearch<MockResult>(hc, mockFn);

    // mockFn 호출 인수를 통해 제거 순서 검증
    // 1번째 호출: { price_min, layout, price_max }  (초기)
    // 2번째 호출: { layout, price_max }  (price_min 제거 - RELAXATION_ORDER[0])
    // 3번째 호출: { price_max }           (layout 제거 - RELAXATION_ORDER[1] 이후 layout)
    // 4번째 호출: {}                      (price_max 제거 - RELAXATION_ORDER[마지막])
    const calls = mockFn.mock.calls.map(([c]) => Object.keys(c));
    // 첫 번째 호출에는 세 키 모두
    expect(calls[0]).toContain('price_min');
    expect(calls[0]).toContain('layout');
    expect(calls[0]).toContain('price_max');
    // 두 번째 호출: price_min이 제거됨 (가장 낮은 우선순위)
    expect(calls[1]).not.toContain('price_min');
    expect(calls[1]).toContain('layout');
    expect(calls[1]).toContain('price_max');
    // 세 번째 호출: layout도 제거됨
    expect(calls[2]).not.toContain('price_min');
    expect(calls[2]).not.toContain('layout');
    expect(calls[2]).toContain('price_max');
    // 네 번째 호출: 모든 제약 제거
    expect(calls[3]).not.toContain('price_max');
  });

  it('price_min이 layout보다 먼저 완화된다 (RELAXATION_ORDER 반영)', () => {
    const removedOrder: string[] = [];
    let prev: HardConstraints = { price_min: 5_000, layout: '풀배열' };

    const mockFn = vi.fn((hc: HardConstraints): MockResult[] => {
      const removed = (Object.keys(prev) as string[]).filter(
        (k) => !Object.prototype.hasOwnProperty.call(hc, k),
      );
      removed.forEach((k) => removedOrder.push(k));
      prev = hc;
      return [];
    });

    relaxAndSearch<MockResult>({ price_min: 5_000, layout: '풀배열' }, mockFn);

    // price_min이 layout보다 먼저 완화되어야 한다
    const priceMinIdx = removedOrder.indexOf('price_min');
    const layoutIdx = removedOrder.indexOf('layout');
    expect(priceMinIdx).toBeGreaterThanOrEqual(0);
    expect(layoutIdx).toBeGreaterThanOrEqual(0);
    expect(priceMinIdx).toBeLessThan(layoutIdx);
  });

  it('price_max가 가장 마지막으로 완화된다 (RELAXATION_ORDER 마지막)', () => {
    const removedOrder: string[] = [];
    let prev: HardConstraints = {
      price_min: 5_000,
      layout: '풀배열',
      price_max: 100_000,
    };

    const mockFn = vi.fn((hc: HardConstraints): MockResult[] => {
      const removed = (Object.keys(prev) as string[]).filter(
        (k) => !Object.prototype.hasOwnProperty.call(hc, k),
      );
      removed.forEach((k) => removedOrder.push(k));
      prev = hc;
      return [];
    });

    relaxAndSearch<MockResult>(
      { price_min: 5_000, layout: '풀배열', price_max: 100_000 },
      mockFn,
    );

    const lastRemoved = removedOrder[removedOrder.length - 1];
    expect(lastRemoved).toBe('price_max');
  });

  it('활성 제약만 완화 순서에 포함된다 (비활성 키는 건너뜀)', () => {
    let callCount = 0;
    const mockFn = vi.fn((_: HardConstraints): MockResult[] => {
      callCount++;
      // 두 번째 호출(첫 제약 제거 후)에 결과 반환
      if (callCount >= 2) return [{ id: 1 }];
      return [];
    });

    // switch_type만 설정 (price_min, weight_max_g 등은 설정 안 됨)
    const result = relaxAndSearch<MockResult>({ switch_type: '기계식' }, mockFn);

    // switch_type이 완화되었어야 한다
    expect(result.relaxedConstraints).toContain('switch_type');
    // 활성화되지 않은 다른 키는 완화 목록에 없다
    expect(result.relaxedConstraints).not.toContain('price_min');
    expect(result.relaxedConstraints).not.toContain('layout');
  });
});

// ===========================================================================
// 4. 첫 번째 비공(非空) 결과 시점에 즉시 반환
// ===========================================================================

describe('relaxAndSearch - 첫 번째 비공 결과 시점에 즉시 반환', () => {
  it('2단계 완화에서 결과 나오면 3단계는 실행하지 않는다', () => {
    let callCount = 0;
    const mockFn = vi.fn((_: HardConstraints): MockResult[] => {
      callCount++;
      if (callCount === 3) return [{ id: 42 }]; // 3번째 호출(2단계 완화)에서 결과
      return [];
    });

    const result = relaxAndSearch<MockResult>(
      { price_min: 5_000, layout: '텐키리스', price_max: 200_000 },
      mockFn,
    );

    // 3번째 호출(2단계 완화)에서 멈춰야 함
    expect(mockFn).toHaveBeenCalledTimes(3);
    expect(result.relaxationSteps).toBe(2);
    expect(result.results).toEqual([{ id: 42 }]);
  });

  it('첫 번째 완화에서 결과 나오면 즉시 반환 (1단계)', () => {
    let callCount = 0;
    const mockFn = vi.fn((_: HardConstraints): MockResult[] => {
      callCount++;
      if (callCount === 2) return [{ id: 10 }];
      return [];
    });

    const result = relaxAndSearch<MockResult>({ layout: '텐키리스' }, mockFn);

    expect(mockFn).toHaveBeenCalledTimes(2);
    expect(result.relaxationSteps).toBe(1);
    expect(result.results).toEqual([{ id: 10 }]);
  });

  it('모든 완화 후에도 결과 없으면 빈 결과 반환', () => {
    const result = relaxAndSearch<MockResult>(
      { layout: '텐키리스', switch_type: '기계식' },
      alwaysEmpty,
    );

    expect(result.results).toEqual([]);
    // 두 개의 활성 제약이 모두 완화되어야 한다
    expect(result.relaxedConstraints).toContain('layout');
    expect(result.relaxedConstraints).toContain('switch_type');
    expect(result.relaxedConstraints.length).toBe(2);
  });

  it('빈 hardConstraints + 항상 빈 결과: 0단계, 빈 결과', () => {
    const result = relaxAndSearch<MockResult>({}, alwaysEmpty);

    expect(result.results).toEqual([]);
    expect(result.relaxedConstraints).toEqual([]);
    expect(result.relaxationSteps).toBe(0);
  });
});

// ===========================================================================
// 5. 반환 구조 검증
// ===========================================================================

describe('relaxAndSearch - 반환 구조', () => {
  it('results, relaxedConstraints, relaxationSteps 세 필드를 모두 반환한다', () => {
    const result = relaxAndSearch<MockResult>({ layout: '텐키리스' }, alwaysFound);

    expect(result).toHaveProperty('results');
    expect(result).toHaveProperty('relaxedConstraints');
    expect(result).toHaveProperty('relaxationSteps');
  });

  it('results는 배열이다', () => {
    const result = relaxAndSearch<MockResult>({}, alwaysFound);
    expect(Array.isArray(result.results)).toBe(true);
  });

  it('relaxedConstraints는 문자열 배열이다', () => {
    const result = relaxAndSearch<MockResult>({ layout: '텐키리스' }, alwaysFound);
    expect(Array.isArray(result.relaxedConstraints)).toBe(true);
    result.relaxedConstraints.forEach((k) => {
      expect(typeof k).toBe('string');
    });
  });

  it('relaxationSteps는 숫자이다', () => {
    const result = relaxAndSearch<MockResult>({}, alwaysFound);
    expect(typeof result.relaxationSteps).toBe('number');
  });

  it('relaxationSteps === relaxedConstraints.length 불변 조건 (결과 있는 경우)', () => {
    const result = relaxAndSearch<MockResult>({ layout: '텐키리스' }, alwaysFound);
    expect(result.relaxationSteps).toBe(result.relaxedConstraints.length);
  });

  it('relaxationSteps === relaxedConstraints.length 불변 조건 (완화 발생 경우)', () => {
    let callCount = 0;
    const mockFn = vi.fn((_: HardConstraints): MockResult[] => {
      callCount++;
      if (callCount >= 3) return [{ id: 1 }];
      return [];
    });

    const result = relaxAndSearch<MockResult>(
      { layout: '텐키리스', switch_type: '기계식' },
      mockFn,
    );

    expect(result.relaxationSteps).toBe(result.relaxedConstraints.length);
  });

  it('relaxationSteps === relaxedConstraints.length 불변 조건 (결과 없는 경우)', () => {
    const result = relaxAndSearch<MockResult>(
      { layout: '텐키리스', switch_type: '기계식' },
      alwaysEmpty,
    );

    expect(result.relaxationSteps).toBe(result.relaxedConstraints.length);
  });
});

// ===========================================================================
// 6. 원본 hardConstraints 불변성
// ===========================================================================

describe('relaxAndSearch - 원본 hardConstraints 불변성', () => {
  it('원본 hardConstraints 객체를 변경하지 않는다', () => {
    const original: HardConstraints = { layout: '텐키리스', switch_type: '기계식' };
    const snapshot = { ...original };

    relaxAndSearch<MockResult>(original, alwaysEmpty);

    expect(original).toEqual(snapshot);
  });

  it('원본 객체에 새 키가 추가되지 않는다', () => {
    const original: HardConstraints = { price_max: 100_000 };
    const originalKeys = Object.keys(original);

    relaxAndSearch<MockResult>(original, alwaysEmpty);

    expect(Object.keys(original)).toEqual(originalKeys);
  });

  it('원본 객체의 값이 변경되지 않는다', () => {
    const original: HardConstraints = { layout: '텐키리스', price_max: 200_000 };

    relaxAndSearch<MockResult>(original, alwaysEmpty);

    expect(original.layout).toBe('텐키리스');
    expect(original.price_max).toBe(200_000);
  });
});

// ===========================================================================
// 7. 제네릭 타입 지원
// ===========================================================================

describe('relaxAndSearch - 제네릭 타입 지원', () => {
  it('string[] 반환 타입을 지원한다', () => {
    const result = relaxAndSearch<string>({}, (_) => ['a', 'b', 'c']);
    expect(result.results).toEqual(['a', 'b', 'c']);
  });

  it('number[] 반환 타입을 지원한다', () => {
    const result = relaxAndSearch<number>({ price_max: 100_000 }, (_) => [1, 2, 3]);
    expect(result.results).toEqual([1, 2, 3]);
  });

  it('빈 배열 -> 완화 후 number[] 반환', () => {
    let callCount = 0;
    const result = relaxAndSearch<number>({ layout: '텐키리스' }, (_) => {
      callCount++;
      if (callCount >= 2) return [42];
      return [];
    });
    expect(result.results).toEqual([42]);
    expect(result.relaxationSteps).toBe(1);
  });
});

// ===========================================================================
// 8. searchFn 인수 검증 (완화된 제약이 전달되지 않음)
// ===========================================================================

describe('relaxAndSearch - searchFn에 전달되는 인수 검증', () => {
  it('완화된 제약 키는 이후 searchFn 호출 인수에서 제거된다', () => {
    let callCount = 0;
    const mockFn = vi.fn((hc: HardConstraints): MockResult[] => {
      callCount++;
      if (callCount >= 2) return [{ id: 1 }];
      return [];
    });

    relaxAndSearch<MockResult>({ price_min: 10_000, layout: '텐키리스' }, mockFn);

    // 두 번째 호출: price_min(RELAXATION_ORDER[0])이 제거된 상태
    const secondCallArg = mockFn.mock.calls[1][0];
    expect(secondCallArg).not.toHaveProperty('price_min');
    expect(secondCallArg).toHaveProperty('layout');
  });

  it('첫 번째 호출은 원본 hardConstraints로 이루어진다', () => {
    const hc: HardConstraints = { switch_type: '기계식', price_max: 150_000 };
    const mockFn = vi.fn((_: HardConstraints): MockResult[] => []);

    relaxAndSearch<MockResult>(hc, mockFn);

    const firstCallArg = mockFn.mock.calls[0][0];
    expect(firstCallArg).toHaveProperty('switch_type', '기계식');
    expect(firstCallArg).toHaveProperty('price_max', 150_000);
  });
});

// ===========================================================================
// 9. 실제 HARD_CONSTRAINT_RELAXATION_ORDER 준수 검증
// ===========================================================================

describe('relaxAndSearch - HARD_CONSTRAINT_RELAXATION_ORDER 전체 순서 검증', () => {
  it('모든 제약을 지정했을 때 RELAXATION_ORDER 순서대로 완화된다', () => {
    const allConstraints: HardConstraints = {
      price_min: 10_000,
      weight_max_g: 800,
      engraving: '한/영 정각',
      backlight: '없음',
      wireless_type: '유선',
      connection: '유선',
      switch_type: '기계식',
      layout: '텐키리스',
      price_max: 200_000,
    };

    const removedOrder: string[] = [];
    let prevHc: HardConstraints = { ...allConstraints };

    const mockFn = vi.fn((hc: HardConstraints): MockResult[] => {
      const removedNow = (Object.keys(prevHc) as string[]).filter(
        (k) => !Object.prototype.hasOwnProperty.call(hc, k),
      );
      removedNow.forEach((k) => removedOrder.push(k));
      prevHc = { ...hc };
      return []; // 항상 빈 결과 -> 모든 제약 완화
    });

    relaxAndSearch<MockResult>(allConstraints, mockFn);

    // 완화된 순서가 HARD_CONSTRAINT_RELAXATION_ORDER 와 일치해야 한다
    expect(removedOrder).toEqual([...HARD_CONSTRAINT_RELAXATION_ORDER]);
  });
});
