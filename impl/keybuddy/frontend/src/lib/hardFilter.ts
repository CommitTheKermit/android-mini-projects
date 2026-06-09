/**
 * hardFilter: 하드 제약 위반 판정 함수 모음
 *
 * 각 함수는 해당 제약이 위반되면 true, 만족하면 false를 반환한다.
 * layoutTag 등 제약이 빈 문자열이면 제약 없음으로 간주해 false를 반환한다.
 *
 * checkHardConstraintViolation: 디스패처 함수
 * - hardTag.type을 판별해 각 세부 함수로 라우팅한다.
 * - 알 수 없는 type은 false(위반 없음)를 반환한다 (안전한 기본값).
 */

import type { Keyboard } from '../types';

// ---------------------------------------------------------------------------
// HardTag 타입 정의 (디스패처 입력)
// ---------------------------------------------------------------------------

/**
 * 하드 제약 태그의 판별 유니온 타입.
 * - 'layout'      : checkLayoutViolation 으로 라우팅 (Sub-AC 4-1-1)
 * - 'switch_type' : checkSwitchViolation 으로 라우팅 (Sub-AC 4-1-2)
 * - 'form_factor' : checkFormFactorViolation 으로 라우팅 (Sub-AC 4-1-3)
 * - 'price_max'   : checkBudgetViolation 으로 라우팅 (Sub-AC 4-1-4)
 * - 기타 string   : 알 수 없는 유형, false 반환
 */
export type HardTagType = 'layout' | 'switch_type' | 'form_factor' | 'price_max' | string;

export interface HardTag {
  type: HardTagType;
  value: string | number;
}

/**
 * 키보드의 layout 속성과 layoutTag가 불일치하면 true(위반),
 * 일치하거나 layoutTag가 없으면 false(통과)를 반환한다.
 *
 * @param keyboard - 카탈로그 레코드
 * @param layoutTag - hardConstraints.layout 값 (없으면 빈 문자열)
 */
export function checkLayoutViolation(keyboard: Keyboard, layoutTag: string): boolean {
  if (!layoutTag) return false;
  return keyboard.layout !== layoutTag;
}

/**
 * 키보드의 switch_type 속성과 switchTag가 불일치하면 true(위반),
 * 일치하거나 switchTag가 없으면 false(통과)를 반환한다.
 *
 * @param keyboard - 카탈로그 레코드
 * @param switchTag - hardConstraints.switch_type 값 (없으면 빈 문자열)
 */
export function checkSwitchViolation(keyboard: Keyboard, switchTag: string): boolean {
  if (!switchTag) return false;
  return keyboard.switch_type !== switchTag;
}

/**
 * 키보드의 폼팩터(layout 속성)와 formFactorTag가 불일치하면 true(위반),
 * 일치하거나 formFactorTag가 없으면 false(통과)를 반환한다.
 *
 * 폼팩터는 키보드의 물리적 크기/형태를 나타내며 layout 필드에 저장된다.
 * (풀배열, 텐키리스, 미니, 98키, 99키, 96키 등)
 *
 * @param keyboard - 카탈로그 레코드
 * @param formFactorTag - 요청된 폼팩터 태그 값 (없으면 빈 문자열)
 */
export function checkFormFactorViolation(keyboard: Keyboard, formFactorTag: string): boolean {
  if (!formFactorTag) return false;
  return keyboard.layout !== formFactorTag;
}

/**
 * 키보드 가격이 예산 상한(budgetTag)을 초과하면 true(위반),
 * 이하이면 false(통과)를 반환한다.
 *
 * budgetTag가 0 이하이면 제약 없음으로 간주해 false를 반환한다.
 * 경계값(price === budgetTag)은 false(통과)로 처리한다.
 *
 * @param keyboard - 카탈로그 레코드
 * @param budgetTag - hardConstraints.price_max 값 (제약 없으면 0 또는 음수)
 */
export function checkBudgetViolation(keyboard: Keyboard, budgetTag: number): boolean {
  if (budgetTag <= 0) return false;
  return keyboard.price > budgetTag;
}

// ---------------------------------------------------------------------------
// 디스패처: checkHardConstraintViolation (Sub-AC 4-1-5)
// ---------------------------------------------------------------------------

/**
 * hardTag.type을 판별해 Sub-AC 4-1-1~4-1-4의 각 함수로 라우팅한다.
 *
 * 라우팅 규칙:
 * - 'layout'      -> checkLayoutViolation      (Sub-AC 4-1-1)
 * - 'switch_type' -> checkSwitchViolation      (Sub-AC 4-1-2)
 * - 'form_factor' -> checkFormFactorViolation  (Sub-AC 4-1-3)
 * - 'price_max'   -> checkBudgetViolation      (Sub-AC 4-1-4)
 * - 기타(알 수 없는 유형) -> false (위반 없음, 안전한 기본값)
 *
 * @param keyboard - 카탈로그 레코드
 * @param hardTag  - type(유형 판별자) + value(제약 값)를 담은 태그 객체
 * @returns 제약이 위반되면 true, 만족하거나 알 수 없는 유형이면 false
 */
export function checkHardConstraintViolation(keyboard: Keyboard, hardTag: HardTag): boolean {
  switch (hardTag.type) {
    case 'layout':
      return checkLayoutViolation(keyboard, hardTag.value as string);
    case 'switch_type':
      return checkSwitchViolation(keyboard, hardTag.value as string);
    case 'form_factor':
      return checkFormFactorViolation(keyboard, hardTag.value as string);
    case 'price_max':
      return checkBudgetViolation(keyboard, hardTag.value as number);
    default:
      return false;
  }
}
