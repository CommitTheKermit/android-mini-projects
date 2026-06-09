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
 * ID를 가진 제약 타입.
 * buildConstraintStatusMap 입력으로 사용된다.
 */
export type IdentifiedConstraint = Constraint & { id: string };

/**
 * 제약 상태 맵 타입.
 * 제약 ID -> pass(true) / fail(false)
 */
export type ConstraintStatusMap = Record<string, boolean>;

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

// ---------------------------------------------------------------------------
// 전체 제약 상태 맵 빌더: buildConstraintStatusMap (Sub-AC 7-2b)
// ---------------------------------------------------------------------------

/**
 * 하드 제약 목록 전체와 키보드 속성을 입력받아
 * 각 제약 ID를 키로 pass/fail 상태를 값으로 하는 맵을 반환한다.
 *
 * 내부적으로 evaluateConstraint(Sub-AC 7-2a)를 활용한다.
 *
 * 설계 원칙:
 * - 빈 제약 목록 -> 빈 맵 반환 (경계 케이스 안전 처리)
 * - 동일 ID가 여러 번 등장하면 마지막 평가 결과가 맵에 기록된다
 * - 순수 함수: LLM 호출 없이 결정론적으로 동작, 동일 입력 -> 동일 출력
 *
 * @param constraints - ID를 포함한 하드 제약 배열 (IdentifiedConstraint[])
 * @param attributes  - 키보드 속성 맵 (KeyboardAttributes)
 * @returns ConstraintStatusMap - { [constraintId]: boolean(pass/fail) }
 */
export function buildConstraintStatusMap(
  constraints: IdentifiedConstraint[],
  attributes: KeyboardAttributes,
): ConstraintStatusMap {
  const statusMap: ConstraintStatusMap = {};
  for (const constraint of constraints) {
    statusMap[constraint.id] = evaluateConstraint(constraint, attributes);
  }
  return statusMap;
}

// ---------------------------------------------------------------------------
// filterByConstraintPredicates (Sub-AC 3-1)
// ---------------------------------------------------------------------------

/**
 * 속성 술어(hard constraint predicate) 목록과 키보드 카탈로그를 입력받아
 * 술어를 하나라도 위반하는 키보드를 제거하는 결정론 필터 함수.
 *
 * - constraints가 빈 배열이면 모든 키보드를 그대로 반환한다.
 * - 하나라도 술어를 위반하는(evaluateConstraint가 false 반환) 키보드는 결과에 포함하지 않는다.
 * - 원본 배열을 변경하지 않는다(순수 함수).
 * - LLM 호출 없이 결정론적으로 동작한다.
 *
 * 위반(violation) 정의:
 *   evaluateConstraint(constraint, keyboardAttributes) === false -> 위반
 *   모든 constraints가 true를 반환하는 키보드만 통과
 *
 * @param keyboards   - 필터 대상 키보드 카탈로그
 * @param constraints - 적용할 속성 술어(Constraint) 배열
 * @returns 모든 술어를 만족하는(위반하지 않는) 키보드 목록
 */
export function filterByConstraintPredicates<T extends KeyboardAttributes>(
  keyboards: T[],
  constraints: Constraint[],
): T[] {
  if (constraints.length === 0) return keyboards.slice();
  return keyboards.filter((kb) =>
    constraints.every((c) => evaluateConstraint(c, kb as KeyboardAttributes)),
  );
}
