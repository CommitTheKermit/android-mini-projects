/**
 * checkLayoutViolation / checkSwitchViolation 단위테스트
 *
 * 하드 제약 위반 판정 함수:
 * - 키보드 속성과 태그가 불일치 -> true (위반)
 * - 일치 -> false (통과)
 * - 태그 없음(빈 문자열) -> false (제약 없음, 통과)
 */

import { describe, it, expect } from 'vitest';
import {
  checkLayoutViolation,
  checkSwitchViolation,
  checkFormFactorViolation,
  checkBudgetViolation,
  checkHardConstraintViolation,
} from '../lib/hardFilter';
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

// ===========================================================================
// checkFormFactorViolation 테스트
// ===========================================================================

// 폼팩터 테스트용 키보드 픽스처 헬퍼 (layout 기반)
function makeKeyboardWithFormFactor(layout: string): Keyboard {
  return {
    product_name: '폼팩터 테스트 키보드',
    brand: '테스트',
    price: 90000,
    image_url: '',
    switch_type: '기계식',
    connection: '유선',
    layout,
    key_force: '45g',
    weight_g: 800,
    wireless_type: '유선',
    engraving: '한/영 정각',
    backlight: '없음',
  };
}

// ---------------------------------------------------------------------------
// 7. 폼팩터 일치 -> false (위반 아님)
// ---------------------------------------------------------------------------

describe('checkFormFactorViolation - 일치 시 false 반환', () => {
  it('풀배열 키보드에 풀배열 태그 -> false', () => {
    expect(checkFormFactorViolation(makeKeyboardWithFormFactor('풀배열'), '풀배열')).toBe(false);
  });

  it('텐키리스 키보드에 텐키리스 태그 -> false', () => {
    expect(checkFormFactorViolation(makeKeyboardWithFormFactor('텐키리스'), '텐키리스')).toBe(false);
  });

  it('미니 키보드에 미니 태그 -> false', () => {
    expect(checkFormFactorViolation(makeKeyboardWithFormFactor('미니'), '미니')).toBe(false);
  });

  it('98키 키보드에 98키 태그 -> false', () => {
    expect(checkFormFactorViolation(makeKeyboardWithFormFactor('98키'), '98키')).toBe(false);
  });

  it('99키 키보드에 99키 태그 -> false', () => {
    expect(checkFormFactorViolation(makeKeyboardWithFormFactor('99키'), '99키')).toBe(false);
  });

  it('96키 키보드에 96키 태그 -> false', () => {
    expect(checkFormFactorViolation(makeKeyboardWithFormFactor('96키'), '96키')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 8. 폼팩터 불일치 -> true (위반)
// ---------------------------------------------------------------------------

describe('checkFormFactorViolation - 불일치 시 true 반환', () => {
  it('풀배열 키보드에 텐키리스 태그 -> true', () => {
    expect(checkFormFactorViolation(makeKeyboardWithFormFactor('풀배열'), '텐키리스')).toBe(true);
  });

  it('텐키리스 키보드에 풀배열 태그 -> true', () => {
    expect(checkFormFactorViolation(makeKeyboardWithFormFactor('텐키리스'), '풀배열')).toBe(true);
  });

  it('미니 키보드에 풀배열 태그 -> true', () => {
    expect(checkFormFactorViolation(makeKeyboardWithFormFactor('미니'), '풀배열')).toBe(true);
  });

  it('미니 키보드에 텐키리스 태그 -> true', () => {
    expect(checkFormFactorViolation(makeKeyboardWithFormFactor('미니'), '텐키리스')).toBe(true);
  });

  it('98키 키보드에 텐키리스 태그 -> true', () => {
    expect(checkFormFactorViolation(makeKeyboardWithFormFactor('98키'), '텐키리스')).toBe(true);
  });

  it('96키 키보드에 미니 태그 -> true', () => {
    expect(checkFormFactorViolation(makeKeyboardWithFormFactor('96키'), '미니')).toBe(true);
  });

  it('99키 키보드에 풀배열 태그 -> true', () => {
    expect(checkFormFactorViolation(makeKeyboardWithFormFactor('99키'), '풀배열')).toBe(true);
  });

  it('풀배열 키보드에 미니 태그 -> true', () => {
    expect(checkFormFactorViolation(makeKeyboardWithFormFactor('풀배열'), '미니')).toBe(true);
  });

  it('텐키리스 키보드에 96키 태그 -> true', () => {
    expect(checkFormFactorViolation(makeKeyboardWithFormFactor('텐키리스'), '96키')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 9. formFactorTag 없음(빈 문자열) -> false (제약 없음, 위반 아님)
// ---------------------------------------------------------------------------

describe('checkFormFactorViolation - formFactorTag 없음 시 false 반환', () => {
  it('빈 문자열 태그 -> false (제약 없음)', () => {
    expect(checkFormFactorViolation(makeKeyboardWithFormFactor('풀배열'), '')).toBe(false);
  });

  it('빈 문자열 태그 + 텐키리스 키보드 -> false', () => {
    expect(checkFormFactorViolation(makeKeyboardWithFormFactor('텐키리스'), '')).toBe(false);
  });

  it('빈 문자열 태그 + 미니 키보드 -> false', () => {
    expect(checkFormFactorViolation(makeKeyboardWithFormFactor('미니'), '')).toBe(false);
  });

  it('빈 문자열 태그 + 98키 키보드 -> false', () => {
    expect(checkFormFactorViolation(makeKeyboardWithFormFactor('98키'), '')).toBe(false);
  });
});

// ===========================================================================
// checkBudgetViolation 테스트
// ===========================================================================

// 예산 테스트용 키보드 픽스처 헬퍼 (price 기반)
function makeKeyboardWithPrice(price: number): Keyboard {
  return {
    product_name: '예산 테스트 키보드',
    brand: '테스트',
    price,
    image_url: '',
    switch_type: '기계식',
    connection: '유선',
    layout: '텐키리스',
    key_force: '45g',
    weight_g: 800,
    wireless_type: '유선',
    engraving: '한/영 정각',
    backlight: '없음',
  };
}

// ---------------------------------------------------------------------------
// 10. 가격이 상한 이하 -> false (위반 아님)
// ---------------------------------------------------------------------------

describe('checkBudgetViolation - 가격이 상한 이하 시 false 반환', () => {
  it('가격(50000)이 상한(100000)보다 작으면 -> false', () => {
    expect(checkBudgetViolation(makeKeyboardWithPrice(50000), 100000)).toBe(false);
  });

  it('가격(100000)이 상한(100000)과 같으면(경계값) -> false', () => {
    expect(checkBudgetViolation(makeKeyboardWithPrice(100000), 100000)).toBe(false);
  });

  it('가격(1)이 상한(200000)보다 훨씬 작으면 -> false', () => {
    expect(checkBudgetViolation(makeKeyboardWithPrice(1), 200000)).toBe(false);
  });

  it('가격(99999)이 상한(100000)보다 1 작으면 -> false', () => {
    expect(checkBudgetViolation(makeKeyboardWithPrice(99999), 100000)).toBe(false);
  });

  it('가격(0)이 상한(50000)보다 작으면 -> false', () => {
    expect(checkBudgetViolation(makeKeyboardWithPrice(0), 50000)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 11. 가격이 상한 초과 -> true (위반)
// ---------------------------------------------------------------------------

describe('checkBudgetViolation - 가격이 상한 초과 시 true 반환', () => {
  it('가격(100001)이 상한(100000)보다 1 크면 -> true', () => {
    expect(checkBudgetViolation(makeKeyboardWithPrice(100001), 100000)).toBe(true);
  });

  it('가격(200000)이 상한(100000)보다 2배 크면 -> true', () => {
    expect(checkBudgetViolation(makeKeyboardWithPrice(200000), 100000)).toBe(true);
  });

  it('가격(150000)이 상한(100000) 초과 -> true', () => {
    expect(checkBudgetViolation(makeKeyboardWithPrice(150000), 100000)).toBe(true);
  });

  it('가격(500000)이 상한(300000) 초과 -> true', () => {
    expect(checkBudgetViolation(makeKeyboardWithPrice(500000), 300000)).toBe(true);
  });

  it('가격(80001)이 상한(80000) 경계 초과 -> true', () => {
    expect(checkBudgetViolation(makeKeyboardWithPrice(80001), 80000)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 12. budgetTag가 0 이하 -> false (제약 없음, 위반 아님)
// ---------------------------------------------------------------------------

describe('checkBudgetViolation - budgetTag가 0 이하 시 false 반환 (제약 없음)', () => {
  it('budgetTag가 0이면 제약 없음 -> false', () => {
    expect(checkBudgetViolation(makeKeyboardWithPrice(999999), 0)).toBe(false);
  });

  it('budgetTag가 음수(-1)이면 제약 없음 -> false', () => {
    expect(checkBudgetViolation(makeKeyboardWithPrice(100000), -1)).toBe(false);
  });

  it('budgetTag가 매우 큰 음수이면 제약 없음 -> false', () => {
    expect(checkBudgetViolation(makeKeyboardWithPrice(1000000), -999999)).toBe(false);
  });
});

// ===========================================================================
// checkHardConstraintViolation 디스패처 테스트 (Sub-AC 4-1-5)
// ===========================================================================

// 디스패처 테스트용 키보드 픽스처
function makeDispatcherKeyboard(): Keyboard {
  return {
    product_name: '디스패처 테스트 키보드',
    brand: '테스트',
    price: 100000,
    image_url: '',
    switch_type: '기계식',
    connection: '유선',
    layout: '텐키리스',
    key_force: '45g',
    weight_g: 800,
    wireless_type: '유선',
    engraving: '한/영 정각',
    backlight: 'RGB 백라이트',
  };
}

// ---------------------------------------------------------------------------
// 13. type: 'layout' -> checkLayoutViolation 으로 라우팅 (Sub-AC 4-1-1)
// ---------------------------------------------------------------------------

describe('checkHardConstraintViolation - type:layout -> checkLayoutViolation 라우팅', () => {
  it('layout 일치 -> false (위반 없음)', () => {
    const kb = makeDispatcherKeyboard(); // layout: 텐키리스
    expect(checkHardConstraintViolation(kb, { type: 'layout', value: '텐키리스' })).toBe(false);
  });

  it('layout 불일치 -> true (위반)', () => {
    const kb = makeDispatcherKeyboard(); // layout: 텐키리스
    expect(checkHardConstraintViolation(kb, { type: 'layout', value: '풀배열' })).toBe(true);
  });

  it('layout value 빈 문자열 -> false (제약 없음)', () => {
    const kb = makeDispatcherKeyboard();
    expect(checkHardConstraintViolation(kb, { type: 'layout', value: '' })).toBe(false);
  });

  it('checkLayoutViolation 직접 호출과 동일한 결과를 반환한다', () => {
    const kb = makeDispatcherKeyboard();
    const direct = checkLayoutViolation(kb, '미니');
    const dispatched = checkHardConstraintViolation(kb, { type: 'layout', value: '미니' });
    expect(dispatched).toBe(direct);
  });
});

// ---------------------------------------------------------------------------
// 14. type: 'switch_type' -> checkSwitchViolation 으로 라우팅 (Sub-AC 4-1-2)
// ---------------------------------------------------------------------------

describe('checkHardConstraintViolation - type:switch_type -> checkSwitchViolation 라우팅', () => {
  it('switch_type 일치 -> false', () => {
    const kb = makeDispatcherKeyboard(); // switch_type: 기계식
    expect(checkHardConstraintViolation(kb, { type: 'switch_type', value: '기계식' })).toBe(false);
  });

  it('switch_type 불일치 -> true', () => {
    const kb = makeDispatcherKeyboard(); // switch_type: 기계식
    expect(checkHardConstraintViolation(kb, { type: 'switch_type', value: '무접점' })).toBe(true);
  });

  it('switch_type value 빈 문자열 -> false (제약 없음)', () => {
    const kb = makeDispatcherKeyboard();
    expect(checkHardConstraintViolation(kb, { type: 'switch_type', value: '' })).toBe(false);
  });

  it('checkSwitchViolation 직접 호출과 동일한 결과를 반환한다', () => {
    const kb = makeDispatcherKeyboard();
    const direct = checkSwitchViolation(kb, '펜타그래프');
    const dispatched = checkHardConstraintViolation(kb, { type: 'switch_type', value: '펜타그래프' });
    expect(dispatched).toBe(direct);
  });
});

// ---------------------------------------------------------------------------
// 15. type: 'form_factor' -> checkFormFactorViolation 으로 라우팅 (Sub-AC 4-1-3)
// ---------------------------------------------------------------------------

describe('checkHardConstraintViolation - type:form_factor -> checkFormFactorViolation 라우팅', () => {
  it('form_factor 일치 -> false', () => {
    const kb = makeDispatcherKeyboard(); // layout: 텐키리스
    expect(checkHardConstraintViolation(kb, { type: 'form_factor', value: '텐키리스' })).toBe(false);
  });

  it('form_factor 불일치 -> true', () => {
    const kb = makeDispatcherKeyboard(); // layout: 텐키리스
    expect(checkHardConstraintViolation(kb, { type: 'form_factor', value: '미니' })).toBe(true);
  });

  it('form_factor value 빈 문자열 -> false (제약 없음)', () => {
    const kb = makeDispatcherKeyboard();
    expect(checkHardConstraintViolation(kb, { type: 'form_factor', value: '' })).toBe(false);
  });

  it('checkFormFactorViolation 직접 호출과 동일한 결과를 반환한다', () => {
    const kb = makeDispatcherKeyboard();
    const direct = checkFormFactorViolation(kb, '풀배열');
    const dispatched = checkHardConstraintViolation(kb, { type: 'form_factor', value: '풀배열' });
    expect(dispatched).toBe(direct);
  });
});

// ---------------------------------------------------------------------------
// 16. type: 'price_max' -> checkBudgetViolation 으로 라우팅 (Sub-AC 4-1-4)
// ---------------------------------------------------------------------------

describe('checkHardConstraintViolation - type:price_max -> checkBudgetViolation 라우팅', () => {
  it('가격이 상한 이하 -> false', () => {
    const kb = makeDispatcherKeyboard(); // price: 100000
    expect(checkHardConstraintViolation(kb, { type: 'price_max', value: 150000 })).toBe(false);
  });

  it('가격이 상한 초과 -> true', () => {
    const kb = makeDispatcherKeyboard(); // price: 100000
    expect(checkHardConstraintViolation(kb, { type: 'price_max', value: 80000 })).toBe(true);
  });

  it('가격이 상한과 동일(경계값) -> false', () => {
    const kb = makeDispatcherKeyboard(); // price: 100000
    expect(checkHardConstraintViolation(kb, { type: 'price_max', value: 100000 })).toBe(false);
  });

  it('budgetTag가 0 -> false (제약 없음)', () => {
    const kb = makeDispatcherKeyboard();
    expect(checkHardConstraintViolation(kb, { type: 'price_max', value: 0 })).toBe(false);
  });

  it('checkBudgetViolation 직접 호출과 동일한 결과를 반환한다', () => {
    const kb = makeDispatcherKeyboard();
    const direct = checkBudgetViolation(kb, 50000);
    const dispatched = checkHardConstraintViolation(kb, { type: 'price_max', value: 50000 });
    expect(dispatched).toBe(direct);
  });
});

// ---------------------------------------------------------------------------
// 17. 알 수 없는 type -> false 반환 (안전한 기본값)
// ---------------------------------------------------------------------------

describe('checkHardConstraintViolation - 알 수 없는 type -> false 반환', () => {
  it('type: "connection" (미구현 유형) -> false', () => {
    const kb = makeDispatcherKeyboard();
    expect(checkHardConstraintViolation(kb, { type: 'connection', value: '무선' })).toBe(false);
  });

  it('type: "wireless_type" (미구현 유형) -> false', () => {
    const kb = makeDispatcherKeyboard();
    expect(checkHardConstraintViolation(kb, { type: 'wireless_type', value: '블루투스' })).toBe(false);
  });

  it('type: "weight_max_g" (미구현 유형) -> false', () => {
    const kb = makeDispatcherKeyboard();
    expect(checkHardConstraintViolation(kb, { type: 'weight_max_g', value: 500 })).toBe(false);
  });

  it('type: "unknown_type" -> false', () => {
    const kb = makeDispatcherKeyboard();
    expect(checkHardConstraintViolation(kb, { type: 'unknown_type', value: '임의값' })).toBe(false);
  });

  it('type: 빈 문자열 -> false', () => {
    const kb = makeDispatcherKeyboard();
    expect(checkHardConstraintViolation(kb, { type: '', value: '' })).toBe(false);
  });

  it('type: "engraving" -> false', () => {
    const kb = makeDispatcherKeyboard();
    expect(checkHardConstraintViolation(kb, { type: 'engraving', value: '한/영 정각' })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 18. 복합 시나리오: 여러 하드태그 순차 적용
// ---------------------------------------------------------------------------

describe('checkHardConstraintViolation - 복합 시나리오', () => {
  it('layout + switch_type 모두 일치하는 키보드는 두 태그 모두 false', () => {
    const kb = makeDispatcherKeyboard(); // layout: 텐키리스, switch_type: 기계식
    expect(checkHardConstraintViolation(kb, { type: 'layout', value: '텐키리스' })).toBe(false);
    expect(checkHardConstraintViolation(kb, { type: 'switch_type', value: '기계식' })).toBe(false);
  });

  it('layout 불일치 + switch_type 일치: layout만 위반 반환', () => {
    const kb = makeDispatcherKeyboard(); // layout: 텐키리스, switch_type: 기계식
    expect(checkHardConstraintViolation(kb, { type: 'layout', value: '풀배열' })).toBe(true);
    expect(checkHardConstraintViolation(kb, { type: 'switch_type', value: '기계식' })).toBe(false);
  });

  it('가격 위반 키보드: price_max 태그는 true, layout 태그는 false(일치)', () => {
    const kb = makeDispatcherKeyboard(); // price: 100000, layout: 텐키리스
    expect(checkHardConstraintViolation(kb, { type: 'price_max', value: 50000 })).toBe(true);
    expect(checkHardConstraintViolation(kb, { type: 'layout', value: '텐키리스' })).toBe(false);
  });
});
