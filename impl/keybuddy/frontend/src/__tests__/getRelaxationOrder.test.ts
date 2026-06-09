/**
 * getRelaxationOrder 단위 테스트 (Sub-AC 6-2)
 *
 * priority 속성을 가진 하드 제약 배열을 받아
 * priority 오름차순(낮은 우선순위 항목이 먼저)으로 정렬된 새 배열을 반환함을 검증한다.
 */

import { describe, it, expect } from 'vitest';
import { getRelaxationOrder, type PrioritizedHardConstraint } from '../lib/searchEngine';

// ---------------------------------------------------------------------------
// 픽스처 헬퍼
// ---------------------------------------------------------------------------

function makeConstraint(priority: number, label?: string): PrioritizedHardConstraint {
  return { priority, label: label ?? `constraint-${priority}` };
}

// ===========================================================================
// 1. 빈 배열 - 빈 배열 반환
// ===========================================================================

describe('getRelaxationOrder - 빈 배열', () => {
  it('빈 배열을 받으면 빈 배열을 반환한다', () => {
    const result = getRelaxationOrder([]);
    expect(result).toEqual([]);
  });

  it('반환된 빈 배열은 새 배열이다 (동일 참조 아님)', () => {
    const input: PrioritizedHardConstraint[] = [];
    const result = getRelaxationOrder(input);
    expect(result).not.toBe(input);
  });
});

// ===========================================================================
// 2. 단일 요소 - 그대로 반환
// ===========================================================================

describe('getRelaxationOrder - 단일 요소', () => {
  it('단일 요소 배열은 동일 요소를 담은 새 배열을 반환한다', () => {
    const item = makeConstraint(5, 'layout');
    const result = getRelaxationOrder([item]);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(item);
  });

  it('반환 배열은 원본과 다른 참조이다', () => {
    const input = [makeConstraint(3)];
    const result = getRelaxationOrder(input);
    expect(result).not.toBe(input);
  });
});

// ===========================================================================
// 3. priority 오름차순 정렬 검증 (낮은 우선순위 먼저)
// ===========================================================================

describe('getRelaxationOrder - priority 오름차순 정렬', () => {
  it('이미 오름차순인 배열은 동일 순서를 반환한다', () => {
    const input = [
      makeConstraint(1, 'price_min'),
      makeConstraint(3, 'engraving'),
      makeConstraint(5, 'layout'),
      makeConstraint(9, 'price_max'),
    ];
    const result = getRelaxationOrder(input);
    expect(result.map((c) => c.priority)).toEqual([1, 3, 5, 9]);
  });

  it('내림차순 배열을 오름차순으로 정렬한다', () => {
    const input = [
      makeConstraint(9, 'price_max'),
      makeConstraint(5, 'layout'),
      makeConstraint(3, 'engraving'),
      makeConstraint(1, 'price_min'),
    ];
    const result = getRelaxationOrder(input);
    expect(result.map((c) => c.priority)).toEqual([1, 3, 5, 9]);
  });

  it('무작위 순서 배열을 오름차순으로 정렬한다', () => {
    const input = [
      makeConstraint(7, 'switch_type'),
      makeConstraint(2, 'weight_max_g'),
      makeConstraint(9, 'price_max'),
      makeConstraint(4, 'backlight'),
      makeConstraint(1, 'price_min'),
    ];
    const result = getRelaxationOrder(input);
    expect(result.map((c) => c.priority)).toEqual([1, 2, 4, 7, 9]);
  });

  it('priority 값이 첫 번째인 항목이 항상 배열 첫 번째에 위치한다', () => {
    const input = [
      makeConstraint(8, 'layout'),
      makeConstraint(1, 'price_min'),
      makeConstraint(5, 'connection'),
    ];
    const result = getRelaxationOrder(input);
    expect(result[0].priority).toBe(1);
  });

  it('priority 값이 가장 큰 항목이 항상 배열 마지막에 위치한다', () => {
    const input = [
      makeConstraint(3, 'engraving'),
      makeConstraint(9, 'price_max'),
      makeConstraint(6, 'wireless_type'),
    ];
    const result = getRelaxationOrder(input);
    expect(result[result.length - 1].priority).toBe(9);
  });

  it('결과 배열은 priority 오름차순으로 정렬되어 있다', () => {
    const input = [
      makeConstraint(6),
      makeConstraint(2),
      makeConstraint(8),
      makeConstraint(1),
      makeConstraint(4),
    ];
    const result = getRelaxationOrder(input);
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].priority).toBeLessThanOrEqual(result[i + 1].priority);
    }
  });
});

// ===========================================================================
// 4. 원본 배열 불변성 (순수 함수)
// ===========================================================================

describe('getRelaxationOrder - 원본 배열 불변성', () => {
  it('원본 배열을 변경하지 않는다', () => {
    const input = [
      makeConstraint(9, 'price_max'),
      makeConstraint(1, 'price_min'),
      makeConstraint(5, 'layout'),
    ];
    const originalLabels = input.map((c) => c.label as string);
    getRelaxationOrder(input);
    expect(input.map((c) => c.label as string)).toEqual(originalLabels);
  });

  it('반환된 배열이 원본과 다른 참조임을 보장한다', () => {
    const input = [makeConstraint(3), makeConstraint(1), makeConstraint(5)];
    const result = getRelaxationOrder(input);
    expect(result).not.toBe(input);
  });

  it('반환 배열 수정이 원본에 영향을 주지 않는다', () => {
    const originalItem = makeConstraint(5, 'layout');
    const input = [originalItem, makeConstraint(1), makeConstraint(9)];
    const result = getRelaxationOrder(input);
    result.splice(0, 1);
    expect(input).toHaveLength(3);
  });
});

// ===========================================================================
// 5. 동일 priority 항목 - 입력 순서 유지 (안정 정렬)
// ===========================================================================

describe('getRelaxationOrder - 동일 priority 항목 순서', () => {
  it('동일 priority 항목은 입력 순서가 유지된다', () => {
    const a = makeConstraint(3, 'first');
    const b = makeConstraint(3, 'second');
    const c = makeConstraint(3, 'third');
    const result = getRelaxationOrder([a, b, c]);
    // 모두 priority=3으로 동일하므로 순서는 입력 그대로
    expect(result.map((c) => c.label)).toEqual(['first', 'second', 'third']);
  });

  it('일부 동일 priority가 섞인 경우 정렬이 유지된다', () => {
    const input = [
      makeConstraint(5, 'a'),
      makeConstraint(1, 'b'),
      makeConstraint(5, 'c'),
      makeConstraint(1, 'd'),
    ];
    const result = getRelaxationOrder(input);
    expect(result[0].priority).toBe(1);
    expect(result[1].priority).toBe(1);
    expect(result[2].priority).toBe(5);
    expect(result[3].priority).toBe(5);
  });
});

// ===========================================================================
// 6. 실제 하드 제약 시나리오 검증
// ===========================================================================

describe('getRelaxationOrder - 실제 하드 제약 시나리오', () => {
  it('HARD_CONSTRAINT_RELAXATION_ORDER와 동일한 의미의 priority 번호 기반으로 정렬된다', () => {
    // price_min(1) < weight_max_g(2) < layout(8) < price_max(9) 순으로 완화되어야 함
    const constraints: PrioritizedHardConstraint[] = [
      { priority: 9, type: 'price_max', value: 150000 },
      { priority: 1, type: 'price_min', value: 50000 },
      { priority: 8, type: 'layout', value: '텐키리스' },
      { priority: 2, type: 'weight_max_g', value: 800 },
    ];

    const result = getRelaxationOrder(constraints);

    // 낮은 우선순위(price_min=1, weight_max_g=2)가 먼저 오고
    // 높은 우선순위(layout=8, price_max=9)가 나중에 와야 한다
    expect((result[0] as { type: string }).type).toBe('price_min');
    expect((result[1] as { type: string }).type).toBe('weight_max_g');
    expect((result[2] as { type: string }).type).toBe('layout');
    expect((result[3] as { type: string }).type).toBe('price_max');
  });

  it('완화 시 낮은 priority 항목이 먼저 제거되어야 함을 시뮬레이션', () => {
    const constraints: PrioritizedHardConstraint[] = [
      { priority: 3, type: 'switch_type' },
      { priority: 1, type: 'price_min' },
      { priority: 5, type: 'price_max' },
    ];

    const relaxOrder = getRelaxationOrder(constraints);

    // 첫 번째로 완화되는 항목은 가장 낮은 우선순위 (price_min, priority=1)
    expect((relaxOrder[0] as { type: string }).type).toBe('price_min');
    // 마지막으로 완화되는 항목은 가장 높은 우선순위 (price_max, priority=5)
    expect((relaxOrder[relaxOrder.length - 1] as { type: string }).type).toBe('price_max');
  });

  it('단일 하드 제약 - 그대로 반환', () => {
    const constraint: PrioritizedHardConstraint = { priority: 7, type: 'layout', value: '풀배열' };
    const result = getRelaxationOrder([constraint]);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(constraint);
  });
});

// ===========================================================================
// 7. 경계값 및 엣지 케이스
// ===========================================================================

describe('getRelaxationOrder - 경계값 및 엣지 케이스', () => {
  it('priority=0인 항목이 포함되면 가장 먼저 완화된다', () => {
    const input = [
      makeConstraint(5, 'a'),
      makeConstraint(0, 'zero'),
      makeConstraint(3, 'b'),
    ];
    const result = getRelaxationOrder(input);
    expect(result[0].label).toBe('zero');
  });

  it('음수 priority 항목이 포함되면 가장 먼저 완화된다', () => {
    const input = [
      makeConstraint(5, 'a'),
      makeConstraint(-1, 'negative'),
      makeConstraint(3, 'b'),
    ];
    const result = getRelaxationOrder(input);
    expect(result[0].label).toBe('negative');
  });

  it('모든 항목의 priority가 동일하면 길이는 변하지 않는다', () => {
    const input = [
      makeConstraint(3, 'a'),
      makeConstraint(3, 'b'),
      makeConstraint(3, 'c'),
    ];
    const result = getRelaxationOrder(input);
    expect(result).toHaveLength(3);
  });

  it('큰 배열도 올바르게 정렬된다', () => {
    const input = Array.from({ length: 20 }, (_, i) => makeConstraint(20 - i));
    const result = getRelaxationOrder(input);
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].priority).toBeLessThanOrEqual(result[i + 1].priority);
    }
  });
});
