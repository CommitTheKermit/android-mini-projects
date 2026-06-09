/**
 * hardFilter: 하드 제약 위반 판정 함수 모음
 *
 * 각 함수는 해당 제약이 위반되면 true, 만족하면 false를 반환한다.
 * layoutTag 등 제약이 빈 문자열이면 제약 없음으로 간주해 false를 반환한다.
 */

import type { Keyboard } from '../types';

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
