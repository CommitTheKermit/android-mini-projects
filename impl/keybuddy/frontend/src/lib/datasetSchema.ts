/**
 * datasetSchema: 키보드 데이터셋에서 '속성명 -> 허용 값 집합' 맵 추출 함수
 *
 * 데이터셋의 각 키보드 레코드를 순회하여
 * 각 속성(필드)에 실제로 존재하는 모든 고유 값을 Set으로 수집한다.
 *
 * 반환 형태:
 *   {
 *     connection: Set { '유선', '무선', '유선+무선' },
 *     layout: Set { '풀배열', '텐키리스', '미니', ... },
 *     price: Set { 42800, 67000, 99000, ... },
 *     ...
 *   }
 *
 * 용도:
 *   - 정적 규칙표(SoftTagRuleTable)의 술어 값이 실제 데이터에 존재하는지 검증
 *   - 데이터셋에서 실제 사용 중인 열거형 값 확인
 */

import type { Keyboard } from '../types';

/** 각 속성의 허용 값 집합. 문자열/숫자 필드를 모두 포함한다 */
export type FieldValueSet = Set<string | number>;

/** 속성명 -> 허용 값 집합 맵 */
export type DatasetSchema = Record<string, FieldValueSet>;

/**
 * 키보드 데이터셋을 입력받아 '속성명 -> 허용 값 집합' 맵을 반환한다.
 *
 * - 모든 Keyboard 레코드를 순회하며 각 필드의 고유 값을 수집한다
 * - 빈 배열을 입력하면 빈 맵({})을 반환한다
 * - undefined/null 값은 집합에 추가하지 않는다
 *
 * @param keyboards - 키보드 카탈로그 레코드 배열
 * @returns 속성명을 키, 고유 값 집합을 값으로 가지는 맵
 */
export function extractDatasetSchema(keyboards: Keyboard[]): DatasetSchema {
  if (keyboards.length === 0) {
    return {};
  }

  const schema: DatasetSchema = {};

  for (const keyboard of keyboards) {
    const entries = Object.entries(keyboard) as Array<[string, string | number]>;
    for (const [field, value] of entries) {
      if (value === undefined || value === null) continue;
      if (!(field in schema)) {
        schema[field] = new Set<string | number>();
      }
      schema[field].add(value);
    }
  }

  return schema;
}

/**
 * 데이터셋 스키마에서 특정 속성의 허용 값 집합을 반환한다.
 * 해당 속성이 없으면 빈 Set을 반환한다.
 *
 * @param schema - extractDatasetSchema로 생성된 맵
 * @param field - 조회할 속성명
 */
export function getFieldValues(schema: DatasetSchema, field: string): FieldValueSet {
  return schema[field] ?? new Set<string | number>();
}

/**
 * 데이터셋 스키마에 특정 속성이 존재하는지 확인한다.
 *
 * @param schema - extractDatasetSchema로 생성된 맵
 * @param field - 확인할 속성명
 */
export function hasField(schema: DatasetSchema, field: string): boolean {
  return field in schema;
}

/**
 * 데이터셋 스키마에서 특정 속성에 특정 값이 존재하는지 확인한다.
 *
 * @param schema - extractDatasetSchema로 생성된 맵
 * @param field - 확인할 속성명
 * @param value - 확인할 값
 */
export function hasValue(
  schema: DatasetSchema,
  field: string,
  value: string | number,
): boolean {
  const valueSet = schema[field];
  return valueSet !== undefined && valueSet.has(value);
}

// ---------------------------------------------------------------------------
// 속성명 무결성 검사
// ---------------------------------------------------------------------------

/**
 * 속성 술어를 가지는 규칙 엔트리 구조.
 * SoftTagRuleEntry와 독립적인 제네릭 타입으로 순환 의존 없이 사용한다.
 */
export interface PredicateRuleEntry {
  predicates: Array<{ field: string }>;
}

/**
 * 규칙표의 모든 술어에서 참조하는 속성 이름을 추출하여
 * 스키마 맵에 존재하지 않는 속성명을 반환한다.
 *
 * - 규칙표의 모든 엔트리의 모든 술어에서 field 이름을 수집한다
 * - 수집된 field 중 schema에 없는 것만 반환한다 (중복 없이)
 * - 빈 규칙표 또는 빈 스키마에서도 안전하게 동작한다
 *
 * @param ruleTable - 속성 술어를 가진 규칙 엔트리 배열
 * @param schema - extractDatasetSchema로 생성된 속성명 맵
 * @returns 스키마에 없는 (무효한) 속성명 배열 (중복 없음)
 */
export function findInvalidFieldNames(
  ruleTable: PredicateRuleEntry[],
  schema: DatasetSchema,
): string[] {
  const referencedFields = new Set<string>();

  for (const entry of ruleTable) {
    for (const predicate of entry.predicates) {
      referencedFields.add(predicate.field);
    }
  }

  return Array.from(referencedFields).filter((field) => !hasField(schema, field));
}
