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

/**
 * 키보드 가격이 예산 하한(priceMinTag) 미만이면 true(위반),
 * 이상이면 false(통과)를 반환한다. priceMinTag가 0 이하이면 제약 없음.
 * 경계값(price === priceMinTag)은 false(통과)로 처리한다.
 */
export function checkPriceMinViolation(keyboard: Keyboard, priceMinTag: number): boolean {
  if (priceMinTag <= 0) return false;
  return keyboard.price < priceMinTag;
}

/**
 * 키보드 무게가 상한(weightMaxTag)을 초과하면 true(위반), 이하면 false(통과).
 * weightMaxTag가 0 이하이면 제약 없음으로 간주한다. 경계값은 통과.
 */
export function checkWeightMaxViolation(keyboard: Keyboard, weightMaxTag: number): boolean {
  if (weightMaxTag <= 0) return false;
  return keyboard.weight_g > weightMaxTag;
}

/**
 * 연결 방식 위반 판정. 호환 매칭을 적용한다:
 * - '유선+무선' 키보드는 유선/무선 어느 요구든 충족한다 (위반 아님).
 * - 그 외에는 connection 값이 요구와 정확히 일치해야 한다.
 *
 * 예: 요구 '무선' -> '무선'/'유선+무선' 통과, '유선' 위반.
 *     요구 '유선+무선' -> '유선+무선'만 통과.
 * connectionTag가 없으면 제약 없음으로 false.
 */
export function checkConnectionViolation(keyboard: Keyboard, connectionTag: string): boolean {
  if (!connectionTag) return false;
  if (keyboard.connection === '유선+무선') return false;
  return keyboard.connection !== connectionTag;
}

/**
 * 무선 방식 위반 판정. 부분 일치(contains)를 적용한다:
 * 키보드 wireless_type 문자열이 요구 값을 포함하지 않으면 위반.
 * 예: 요구 '블루투스' -> '전용동글(리시버), 블루투스' 통과.
 * wirelessTag가 없으면 제약 없음으로 false.
 */
export function checkWirelessTypeViolation(keyboard: Keyboard, wirelessTag: string): boolean {
  if (!wirelessTag) return false;
  return !keyboard.wireless_type.includes(wirelessTag);
}

/**
 * 각인 위반 판정. engraving 값이 요구와 정확히 일치하지 않으면 위반.
 * engravingTag가 없으면 제약 없음으로 false.
 */
export function checkEngravingViolation(keyboard: Keyboard, engravingTag: string): boolean {
  if (!engravingTag) return false;
  return keyboard.engraving !== engravingTag;
}

/**
 * 백라이트 위반 판정. backlight 값이 요구와 정확히 일치하지 않으면 위반.
 * backlightTag가 없으면 제약 없음으로 false.
 */
export function checkBacklightViolation(keyboard: Keyboard, backlightTag: string): boolean {
  if (!backlightTag) return false;
  return keyboard.backlight !== backlightTag;
}

// ---------------------------------------------------------------------------
// 디스패처: checkHardConstraintViolation (Sub-AC 4-1-5)
// ---------------------------------------------------------------------------

/**
 * hardTag.type을 판별해 각 세부 위반 판정 함수로 라우팅한다.
 *
 * 라우팅 규칙:
 * - 'layout'        -> checkLayoutViolation
 * - 'switch_type'   -> checkSwitchViolation
 * - 'form_factor'   -> checkFormFactorViolation
 * - 'price_max'     -> checkBudgetViolation
 * - 'price_min'     -> checkPriceMinViolation
 * - 'weight_max_g'  -> checkWeightMaxViolation
 * - 'connection'    -> checkConnectionViolation (호환 매칭)
 * - 'wireless_type' -> checkWirelessTypeViolation (부분 일치)
 * - 'engraving'     -> checkEngravingViolation
 * - 'backlight'     -> checkBacklightViolation
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
    case 'price_min':
      return checkPriceMinViolation(keyboard, hardTag.value as number);
    case 'weight_max_g':
      return checkWeightMaxViolation(keyboard, hardTag.value as number);
    case 'connection':
      return checkConnectionViolation(keyboard, hardTag.value as string);
    case 'wireless_type':
      return checkWirelessTypeViolation(keyboard, hardTag.value as string);
    case 'engraving':
      return checkEngravingViolation(keyboard, hardTag.value as string);
    case 'backlight':
      return checkBacklightViolation(keyboard, hardTag.value as string);
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// detectNoResult (Sub-AC 6-1)
// ---------------------------------------------------------------------------

/** `detectNoResult` 반환 타입 */
export type NoResultSignal = { type: 'NO_MATCH' } | { type: 'OK' };

/**
 * 하드 제약 필터 결과가 빈 배열이면 `{ type: 'NO_MATCH' }` 신호를 반환하고,
 * 1개 이상이면 `{ type: 'OK' }`를 반환한다.
 *
 * @param filterResults - filterByHardConstraints 의 반환값
 * @returns NoResultSignal - 결과 유무 신호 객체
 */
export function detectNoResult(filterResults: Keyboard[]): NoResultSignal {
  return filterResults.length === 0 ? { type: 'NO_MATCH' } : { type: 'OK' };
}

// ---------------------------------------------------------------------------
// filterByHardConstraints (Sub-AC 4-2)
// ---------------------------------------------------------------------------

/**
 * keyboards 목록에서 hardTags의 모든 제약을 만족하는 키보드만 반환한다.
 *
 * - hardTags가 빈 배열이면 모든 키보드를 그대로 반환한다.
 * - 하나라도 위반하는 키보드는 결과에 포함하지 않는다.
 * - 원본 배열을 변경하지 않는다(순수 함수).
 *
 * @param keyboards - 필터 대상 키보드 목록
 * @param hardTags  - 적용할 하드 제약 태그 배열
 * @returns 모든 하드 제약을 만족하는 키보드 목록
 */
export function filterByHardConstraints(keyboards: Keyboard[], hardTags: HardTag[]): Keyboard[] {
  if (hardTags.length === 0) return keyboards.slice();
  return keyboards.filter(
    (kb) => !hardTags.some((tag) => checkHardConstraintViolation(kb, tag)),
  );
}
