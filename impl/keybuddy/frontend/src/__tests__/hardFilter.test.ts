/**
 * checkLayoutViolation 단위테스트
 *
 * 레이아웃 하드 제약 위반 판정 함수:
 * - 키보드 layout 속성과 layoutTag가 불일치 -> true (위반)
 * - 일치 -> false (통과)
 * - layoutTag 없음(빈 문자열) -> false (제약 없음, 통과)
 */

import { describe, it, expect } from 'vitest';
import { checkLayoutViolation } from '../lib/hardFilter';
import type { Keyboard } from '../types';

// 테스트용 최소 키보드 픽스처 생성 헬퍼
function makeKeyboard(layout: string): Keyboard {
  return {
    product_name: '테스트 키보드',
    brand: '테스트',
    price: 100000,
    image_url: '',
    switch_type: '기계식',
    connection: '유선',
    layout,
    key_force: '45g',
    weight_g: 800,
    wireless_type: '유선',
    engraving: '한/영 정각',
    backlight: 'RGB 백라이트',
  };
}

// ---------------------------------------------------------------------------
// 1. 레이아웃 일치 -> false (위반 아님)
// ---------------------------------------------------------------------------

describe('checkLayoutViolation - 일치 시 false 반환', () => {
  it('풀배열 키보드에 풀배열 태그 -> false', () => {
    expect(checkLayoutViolation(makeKeyboard('풀배열'), '풀배열')).toBe(false);
  });

  it('텐키리스 키보드에 텐키리스 태그 -> false', () => {
    expect(checkLayoutViolation(makeKeyboard('텐키리스'), '텐키리스')).toBe(false);
  });

  it('미니 키보드에 미니 태그 -> false', () => {
    expect(checkLayoutViolation(makeKeyboard('미니'), '미니')).toBe(false);
  });

  it('98키 키보드에 98키 태그 -> false', () => {
    expect(checkLayoutViolation(makeKeyboard('98키'), '98키')).toBe(false);
  });

  it('99키 키보드에 99키 태그 -> false', () => {
    expect(checkLayoutViolation(makeKeyboard('99키'), '99키')).toBe(false);
  });

  it('96키 키보드에 96키 태그 -> false', () => {
    expect(checkLayoutViolation(makeKeyboard('96키'), '96키')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. 레이아웃 불일치 -> true (위반)
// ---------------------------------------------------------------------------

describe('checkLayoutViolation - 불일치 시 true 반환', () => {
  it('풀배열 키보드에 텐키리스 태그 -> true', () => {
    expect(checkLayoutViolation(makeKeyboard('풀배열'), '텐키리스')).toBe(true);
  });

  it('텐키리스 키보드에 풀배열 태그 -> true', () => {
    expect(checkLayoutViolation(makeKeyboard('텐키리스'), '풀배열')).toBe(true);
  });

  it('미니 키보드에 풀배열 태그 -> true', () => {
    expect(checkLayoutViolation(makeKeyboard('미니'), '풀배열')).toBe(true);
  });

  it('미니 키보드에 텐키리스 태그 -> true', () => {
    expect(checkLayoutViolation(makeKeyboard('미니'), '텐키리스')).toBe(true);
  });

  it('98키 키보드에 텐키리스 태그 -> true', () => {
    expect(checkLayoutViolation(makeKeyboard('98키'), '텐키리스')).toBe(true);
  });

  it('96키 키보드에 미니 태그 -> true', () => {
    expect(checkLayoutViolation(makeKeyboard('96키'), '미니')).toBe(true);
  });

  it('99키 키보드에 풀배열 태그 -> true', () => {
    expect(checkLayoutViolation(makeKeyboard('99키'), '풀배열')).toBe(true);
  });

  it('풀배열 키보드에 미니 태그 -> true', () => {
    expect(checkLayoutViolation(makeKeyboard('풀배열'), '미니')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. layoutTag 없음(빈 문자열) -> false (제약 없음, 위반 아님)
// ---------------------------------------------------------------------------

describe('checkLayoutViolation - layoutTag 없음 시 false 반환', () => {
  it('빈 문자열 태그 -> false (제약 없음)', () => {
    expect(checkLayoutViolation(makeKeyboard('풀배열'), '')).toBe(false);
  });

  it('빈 문자열 태그 + 텐키리스 키보드 -> false', () => {
    expect(checkLayoutViolation(makeKeyboard('텐키리스'), '')).toBe(false);
  });

  it('빈 문자열 태그 + 미니 키보드 -> false', () => {
    expect(checkLayoutViolation(makeKeyboard('미니'), '')).toBe(false);
  });
});
