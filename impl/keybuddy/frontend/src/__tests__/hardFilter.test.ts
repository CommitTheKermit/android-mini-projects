/**
 * checkLayoutViolation / checkSwitchViolation 단위테스트
 *
 * 하드 제약 위반 판정 함수:
 * - 키보드 속성과 태그가 불일치 -> true (위반)
 * - 일치 -> false (통과)
 * - 태그 없음(빈 문자열) -> false (제약 없음, 통과)
 */

import { describe, it, expect } from 'vitest';
import { checkLayoutViolation, checkSwitchViolation } from '../lib/hardFilter';
import type { Keyboard } from '../types';

// 테스트용 최소 키보드 픽스처 생성 헬퍼 (layout 기반)
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

// 테스트용 최소 키보드 픽스처 생성 헬퍼 (switch_type 기반)
function makeKeyboardWithSwitch(switchType: string): Keyboard {
  return {
    product_name: '스위치 테스트 키보드',
    brand: '테스트',
    price: 80000,
    image_url: '',
    switch_type: switchType,
    connection: '유선',
    layout: '텐키리스',
    key_force: '45g',
    weight_g: 750,
    wireless_type: '유선',
    engraving: '한/영 정각',
    backlight: '없음',
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

// ===========================================================================
// checkSwitchViolation 테스트
// ===========================================================================

// ---------------------------------------------------------------------------
// 4. 스위치 일치 -> false (위반 아님)
// ---------------------------------------------------------------------------

describe('checkSwitchViolation - 일치 시 false 반환', () => {
  it('기계식 키보드에 기계식 태그 -> false', () => {
    expect(checkSwitchViolation(makeKeyboardWithSwitch('기계식'), '기계식')).toBe(false);
  });

  it('펜타그래프 키보드에 펜타그래프 태그 -> false', () => {
    expect(checkSwitchViolation(makeKeyboardWithSwitch('펜타그래프'), '펜타그래프')).toBe(false);
  });

  it('무접점 자석축 키보드에 무접점 자석축 태그 -> false', () => {
    expect(checkSwitchViolation(makeKeyboardWithSwitch('무접점 자석축'), '무접점 자석축')).toBe(false);
  });

  it('무접점 광축 키보드에 무접점 광축 태그 -> false', () => {
    expect(checkSwitchViolation(makeKeyboardWithSwitch('무접점 광축'), '무접점 광축')).toBe(false);
  });

  it('멤브레인 키보드에 멤브레인 태그 -> false', () => {
    expect(checkSwitchViolation(makeKeyboardWithSwitch('멤브레인'), '멤브레인')).toBe(false);
  });

  it('무접점 키보드에 무접점 태그 -> false', () => {
    expect(checkSwitchViolation(makeKeyboardWithSwitch('무접점'), '무접점')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 5. 스위치 불일치 -> true (위반)
// ---------------------------------------------------------------------------

describe('checkSwitchViolation - 불일치 시 true 반환', () => {
  it('기계식 키보드에 펜타그래프 태그 -> true', () => {
    expect(checkSwitchViolation(makeKeyboardWithSwitch('기계식'), '펜타그래프')).toBe(true);
  });

  it('펜타그래프 키보드에 기계식 태그 -> true', () => {
    expect(checkSwitchViolation(makeKeyboardWithSwitch('펜타그래프'), '기계식')).toBe(true);
  });

  it('무접점 자석축 키보드에 기계식 태그 -> true', () => {
    expect(checkSwitchViolation(makeKeyboardWithSwitch('무접점 자석축'), '기계식')).toBe(true);
  });

  it('무접점 광축 키보드에 멤브레인 태그 -> true', () => {
    expect(checkSwitchViolation(makeKeyboardWithSwitch('무접점 광축'), '멤브레인')).toBe(true);
  });

  it('멤브레인 키보드에 무접점 자석축 태그 -> true', () => {
    expect(checkSwitchViolation(makeKeyboardWithSwitch('멤브레인'), '무접점 자석축')).toBe(true);
  });

  it('무접점 키보드에 기계식 태그 -> true', () => {
    expect(checkSwitchViolation(makeKeyboardWithSwitch('무접점'), '기계식')).toBe(true);
  });

  it('기계식 키보드에 무접점 태그 -> true', () => {
    expect(checkSwitchViolation(makeKeyboardWithSwitch('기계식'), '무접점')).toBe(true);
  });

  it('펜타그래프 키보드에 무접점 광축 태그 -> true', () => {
    expect(checkSwitchViolation(makeKeyboardWithSwitch('펜타그래프'), '무접점 광축')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 6. switchTag 없음(빈 문자열) -> false (제약 없음, 위반 아님)
// ---------------------------------------------------------------------------

describe('checkSwitchViolation - switchTag 없음 시 false 반환', () => {
  it('빈 문자열 태그 -> false (제약 없음)', () => {
    expect(checkSwitchViolation(makeKeyboardWithSwitch('기계식'), '')).toBe(false);
  });

  it('빈 문자열 태그 + 펜타그래프 키보드 -> false', () => {
    expect(checkSwitchViolation(makeKeyboardWithSwitch('펜타그래프'), '')).toBe(false);
  });

  it('빈 문자열 태그 + 무접점 자석축 키보드 -> false', () => {
    expect(checkSwitchViolation(makeKeyboardWithSwitch('무접점 자석축'), '')).toBe(false);
  });

  it('빈 문자열 태그 + 멤브레인 키보드 -> false', () => {
    expect(checkSwitchViolation(makeKeyboardWithSwitch('멤브레인'), '')).toBe(false);
  });
});
