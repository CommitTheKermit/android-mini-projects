/**
 * evaluateConstraint: 단일 하드 제약 술어 함수 (Sub-AC 7-2a)
 *
 * 제약 타입(숫자 범위, 열거형 일치, 불리언 플래그)별로
 * 키보드 속성 하나와 제약 조건 하나를 입력받아
 * pass(true) / fail(false) boolean을 반환한다.
 *
 * 설계 원칙:
 * - Constraint 타입 유니온으로 타입 안전성 보장 (타입별 분기 exhaustive)
 * - 속성 키가 없거나 타입 불일치 시 false(fail) 반환 (안전한 기본값)
 * - LLM 호출 없이 순수 함수로 동작, 동일 입력 -> 동일 출력
 */

// ---------------------------------------------------------------------------
// 제약 타입 정의
// ---------------------------------------------------------------------------

/**
 * 숫자 범위 제약
 * - 'lte': 속성 값 <= value  (이하)
 * - 'gte': 속성 값 >= value  (이상)
 * - 'eq' : 속성 값 === value (동일)
 */
export interface NumericRangeConstraint {
  type: 'numeric_range';
  key: string;
  op: 'lte' | 'gte' | 'eq';
  value: number;
}

/**
 * 열거형 일치 제약
 * 속성 값이 주어진 string value와 정확히 일치해야 pass
 */
export interface EnumMatchConstraint {
  type: 'enum_match';
  key: string;
  value: string;
}

/**
 * 불리언 플래그 제약
 * 속성 값이 expected boolean과 일치해야 pass
 */
export interface BooleanFlagConstraint {
  type: 'boolean_flag';
  key: string;
  expected: boolean;
}

/** 제약 유니온 타입 */
export type Constraint = NumericRangeConstraint | EnumMatchConstraint | BooleanFlagConstraint;

/**
 * 키보드 속성 맵.
 * Keyboard 레코드의 string | number 필드 및 추가 파생 필드를 포함할 수 있다.
 */
export type KeyboardAttributes = Record<string, string | number | boolean | undefined>;

// ---------------------------------------------------------------------------
// 핵심 함수: evaluateConstraint
// ---------------------------------------------------------------------------

/**
 * 단일 하드 제약 술어 함수.
 *
 * 제약 타입별 평가 규칙:
 * - numeric_range:
 *     attributes[constraint.key]가 number가 아니면 false.
 *     lte: 속성 값 <= value 이면 true
 *     gte: 속성 값 >= value 이면 true
 *     eq : 속성 값 === value 이면 true
 *
 * - enum_match:
 *     attributes[constraint.key]가 string이 아니면 false.
 *     속성 값 === constraint.value 이면 true (대소문자 구분)
 *
 * - boolean_flag:
 *     attributes[constraint.key]가 boolean이 아니면 false.
 *     속성 값 === constraint.expected 이면 true
 *
 * - 알 수 없는 type: false (안전한 기본값)
 *
 * @param constraint - 평가할 제약 조건
 * @param attributes - 키보드 속성 맵 (Record<string, ...>)
 * @returns 제약을 만족하면 true(pass), 위반하거나 평가 불가하면 false(fail)
 */
export function evaluateConstraint(
  constraint: Constraint,
  attributes: KeyboardAttributes,
): boolean {
  const attrValue = attributes[constraint.key];

  switch (constraint.type) {
    case 'numeric_range': {
      if (typeof attrValue !== 'number') return false;
      switch (constraint.op) {
        case 'lte': return attrValue <= constraint.value;
        case 'gte': return attrValue >= constraint.value;
        case 'eq':  return attrValue === constraint.value;
        default:    return false;
      }
    }

    case 'enum_match': {
      if (typeof attrValue !== 'string') return false;
      return attrValue === constraint.value;
    }

    case 'boolean_flag': {
      if (typeof attrValue !== 'boolean') return false;
      return attrValue === constraint.expected;
    }

    default:
      return false;
  }
}
