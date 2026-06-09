/**
 * datasetSchema 단위 테스트
 *
 * 검증 대상:
 * 1. extractDatasetSchema - 데이터셋에서 속성명 -> 허용 값 집합 추출
 *    - 빈 배열 입력 시 빈 맵 반환
 *    - 속성명 목록이 Keyboard 필드와 일치
 *    - 각 속성의 유효 값이 올바르게 추출 및 중복 제거
 *    - 샘플 데이터셋의 실제 값 검증
 * 2. getFieldValues - 특정 속성 값 집합 조회
 * 3. hasField - 속성 존재 여부
 * 4. hasValue - 속성 값 존재 여부
 */

import { describe, it, expect } from 'vitest';
import {
  extractDatasetSchema,
  getFieldValues,
  hasField,
  hasValue,
} from '../lib/datasetSchema';
import type { Keyboard } from '../types';

// ---------------------------------------------------------------------------
// 테스트 픽스처
// ---------------------------------------------------------------------------

function makeKeyboard(overrides: Partial<Keyboard> = {}): Keyboard {
  return {
    product_name: '기본 테스트 키보드',
    brand: '테스트브랜드',
    price: 50000,
    image_url: 'https://example.com/img.jpg',
    switch_type: '기계식',
    connection: '유선',
    layout: '텐키리스',
    key_force: '45g',
    weight_g: 750,
    wireless_type: '유선',
    engraving: '한/영 정각',
    backlight: 'RGB 백라이트',
    ...overrides,
  };
}

/** 테스트용 최소 샘플 데이터셋 (3개 레코드) */
const SAMPLE_DATASET: Keyboard[] = [
  makeKeyboard({
    product_name: 'AULA F87',
    brand: 'AULA',
    price: 42800,
    switch_type: '기계식',
    connection: '유선',
    layout: '텐키리스',
    key_force: '43g',
    weight_g: 916,
    wireless_type: '유선',
    engraving: '한/영 정각',
    backlight: 'RGB 백라이트',
  }),
  makeKeyboard({
    product_name: '로지텍 KEYS-TO-GO 2',
    brand: '로지텍',
    price: 89000,
    switch_type: '펜타그래프',
    connection: '무선',
    layout: '미니',
    key_force: '0g',
    weight_g: 222,
    wireless_type: '블루투스',
    engraving: '한/영 정각',
    backlight: '없음',
  }),
  makeKeyboard({
    product_name: '앱코 MK108',
    brand: '앱코',
    price: 18900,
    switch_type: '멤브레인',
    connection: '유선',
    layout: '풀배열',
    key_force: '0g',
    weight_g: 711,
    wireless_type: '유선',
    engraving: '한/영 정각',
    backlight: '레인보우 백라이트',
  }),
];

/** 단일 키보드 데이터셋 */
const SINGLE_DATASET: Keyboard[] = [
  makeKeyboard({
    product_name: 'COX CS108',
    brand: 'COX',
    price: 62900,
    switch_type: '기계식',
    connection: '유선+무선',
    layout: '풀배열',
    key_force: '43g',
    weight_g: 1200,
    wireless_type: '전용동글(리시버), 블루투스',
    engraving: '한/영 정각',
    backlight: 'RGB 백라이트',
  }),
];

/** 중복 값이 포함된 데이터셋 (connection: 유선 중복) */
const DUPLICATE_DATASET: Keyboard[] = [
  makeKeyboard({ product_name: 'A', brand: 'X', connection: '유선', layout: '텐키리스', price: 30000 }),
  makeKeyboard({ product_name: 'B', brand: 'X', connection: '유선', layout: '풀배열', price: 50000 }),
  makeKeyboard({ product_name: 'C', brand: 'Y', connection: '무선', layout: '텐키리스', price: 70000 }),
];

// ---------------------------------------------------------------------------
// 1. 빈 배열 입력
// ---------------------------------------------------------------------------

describe('extractDatasetSchema - 빈 배열 입력', () => {
  it('빈 배열이면 빈 맵({})을 반환한다', () => {
    const schema = extractDatasetSchema([]);
    expect(schema).toEqual({});
  });

  it('빈 배열 결과의 키 개수는 0이다', () => {
    const schema = extractDatasetSchema([]);
    expect(Object.keys(schema)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 2. 속성명 목록 검증
// ---------------------------------------------------------------------------

describe('extractDatasetSchema - 속성명 목록', () => {
  it('단일 키보드 데이터셋에서 Keyboard 인터페이스의 모든 필드명을 추출한다', () => {
    const schema = extractDatasetSchema(SINGLE_DATASET);
    const expectedFields = [
      'product_name',
      'brand',
      'price',
      'image_url',
      'switch_type',
      'connection',
      'layout',
      'key_force',
      'weight_g',
      'wireless_type',
      'engraving',
      'backlight',
    ];
    expectedFields.forEach((field) => {
      expect(Object.keys(schema)).toContain(field);
    });
  });

  it('샘플 데이터셋에서 12개의 Keyboard 필드를 추출한다', () => {
    const schema = extractDatasetSchema(SAMPLE_DATASET);
    expect(Object.keys(schema)).toHaveLength(12);
  });

  it('반환된 속성명 집합이 Keyboard 필드와 정확히 일치한다', () => {
    const schema = extractDatasetSchema(SINGLE_DATASET);
    const fields = new Set(Object.keys(schema));
    const keyboardFields = new Set([
      'product_name', 'brand', 'price', 'image_url',
      'switch_type', 'connection', 'layout', 'key_force',
      'weight_g', 'wireless_type', 'engraving', 'backlight',
    ]);
    expect(fields).toEqual(keyboardFields);
  });
});

// ---------------------------------------------------------------------------
// 3. 열거형 문자열 속성 값 추출
// ---------------------------------------------------------------------------

describe('extractDatasetSchema - 문자열 속성 값 추출', () => {
  it('connection 속성에서 유선, 무선이 추출된다', () => {
    const schema = extractDatasetSchema(SAMPLE_DATASET);
    const connections = schema['connection'];
    expect(connections).toContain('유선');
    expect(connections).toContain('무선');
  });

  it('layout 속성에서 텐키리스, 미니, 풀배열이 추출된다', () => {
    const schema = extractDatasetSchema(SAMPLE_DATASET);
    const layouts = schema['layout'];
    expect(layouts).toContain('텐키리스');
    expect(layouts).toContain('미니');
    expect(layouts).toContain('풀배열');
  });

  it('switch_type 속성에서 기계식, 펜타그래프, 멤브레인이 추출된다', () => {
    const schema = extractDatasetSchema(SAMPLE_DATASET);
    const switches = schema['switch_type'];
    expect(switches).toContain('기계식');
    expect(switches).toContain('펜타그래프');
    expect(switches).toContain('멤브레인');
  });

  it('backlight 속성에서 RGB 백라이트, 없음, 레인보우 백라이트가 추출된다', () => {
    const schema = extractDatasetSchema(SAMPLE_DATASET);
    const backlights = schema['backlight'];
    expect(backlights).toContain('RGB 백라이트');
    expect(backlights).toContain('없음');
    expect(backlights).toContain('레인보우 백라이트');
  });

  it('engraving 속성에서 한/영 정각이 추출된다', () => {
    const schema = extractDatasetSchema(SAMPLE_DATASET);
    const engravings = schema['engraving'];
    expect(engravings).toContain('한/영 정각');
  });

  it('wireless_type 속성에서 유선, 블루투스가 추출된다', () => {
    const schema = extractDatasetSchema(SAMPLE_DATASET);
    const wirelessTypes = schema['wireless_type'];
    expect(wirelessTypes).toContain('유선');
    expect(wirelessTypes).toContain('블루투스');
  });
});

// ---------------------------------------------------------------------------
// 4. 숫자 속성 값 추출
// ---------------------------------------------------------------------------

describe('extractDatasetSchema - 숫자 속성 값 추출', () => {
  it('price 속성에서 실제 가격 숫자 값들이 추출된다', () => {
    const schema = extractDatasetSchema(SAMPLE_DATASET);
    const prices = schema['price'];
    expect(prices).toContain(42800);
    expect(prices).toContain(89000);
    expect(prices).toContain(18900);
  });

  it('weight_g 속성에서 실제 무게 숫자 값들이 추출된다', () => {
    const schema = extractDatasetSchema(SAMPLE_DATASET);
    const weights = schema['weight_g'];
    expect(weights).toContain(916);
    expect(weights).toContain(222);
    expect(weights).toContain(711);
  });

  it('price 속성의 값 집합 크기는 레코드의 고유 가격 수와 일치한다', () => {
    const schema = extractDatasetSchema(SAMPLE_DATASET);
    // SAMPLE_DATASET의 price: 42800, 89000, 18900 - 3개 고유값
    expect(schema['price'].size).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// 5. 중복 제거 (deduplication)
// ---------------------------------------------------------------------------

describe('extractDatasetSchema - 중복 값 제거', () => {
  it('같은 connection 값이 여러 레코드에 있어도 집합에 1번만 포함된다', () => {
    const schema = extractDatasetSchema(DUPLICATE_DATASET);
    // connection: '유선' 2개, '무선' 1개 -> Set에는 각 1번
    const connections = schema['connection'];
    expect(connections.size).toBe(2); // 유선, 무선
    expect(connections).toContain('유선');
    expect(connections).toContain('무선');
  });

  it('같은 layout 값이 여러 레코드에 있어도 Set 크기는 고유 값 수와 일치한다', () => {
    const schema = extractDatasetSchema(DUPLICATE_DATASET);
    // layout: 텐키리스 2개, 풀배열 1개 -> 고유 2개
    expect(schema['layout'].size).toBe(2);
  });

  it('brand 집합은 중복 없이 고유 브랜드만 포함한다', () => {
    const schema = extractDatasetSchema(DUPLICATE_DATASET);
    // brand: X 2개, Y 1개 -> 고유 2개
    expect(schema['brand'].size).toBe(2);
    expect(schema['brand']).toContain('X');
    expect(schema['brand']).toContain('Y');
  });

  it('단일 레코드 데이터셋에서 각 속성의 집합 크기는 1이다', () => {
    const schema = extractDatasetSchema(SINGLE_DATASET);
    expect(schema['connection'].size).toBe(1);
    expect(schema['layout'].size).toBe(1);
    expect(schema['switch_type'].size).toBe(1);
    expect(schema['price'].size).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 6. 실제 keyboards.json 샘플 데이터 기반 검증
// ---------------------------------------------------------------------------

describe('extractDatasetSchema - 실제 keyboards.json 속성 값 검증', () => {
  // keyboards.json에서 알려진 실제 값들로 더 큰 데이터셋 구성
  const REAL_SAMPLE: Keyboard[] = [
    makeKeyboard({ switch_type: '기계식', connection: '유선+무선', layout: '풀배열', backlight: 'RGB 백라이트', wireless_type: '전용동글(리시버), 블루투스', engraving: '한/영 정각', price: 99000, weight_g: 1020 }),
    makeKeyboard({ switch_type: '펜타그래프', connection: '무선', layout: '미니', backlight: '없음', wireless_type: '블루투스', engraving: '한/영 정각', price: 89000, weight_g: 222 }),
    makeKeyboard({ switch_type: '무접점 자석축', connection: '유선', layout: '풀배열', backlight: 'RGB 백라이트', wireless_type: '유선', engraving: '한/영 정각', price: 119000, weight_g: 1233 }),
    makeKeyboard({ switch_type: '무접점 광축', connection: '유선', layout: '텐키리스', backlight: 'RGB 백라이트', wireless_type: '유선', engraving: '한/영 정각', price: 328560, weight_g: 932 }),
    makeKeyboard({ switch_type: '멤브레인', connection: '유선+무선', layout: '풀배열', backlight: 'RGB 백라이트', wireless_type: '전용동글(리시버), 블루투스', engraving: '레이저각인 키캡', price: 29800, weight_g: 820 }),
    makeKeyboard({ switch_type: '무접점', connection: '유선+무선', layout: '미니', backlight: '없음', wireless_type: '블루투스, 전용동글(리시버)', engraving: '한/영 정각', price: 149000, weight_g: 791 }),
    makeKeyboard({ switch_type: '기계식', connection: '유선', layout: '텐키리스', backlight: 'RGB 백라이트', wireless_type: '유선', engraving: '영문 정각', price: 48000, weight_g: 916 }),
    makeKeyboard({ switch_type: '펜타그래프', connection: '유선+무선', layout: '풀배열', backlight: '없음', wireless_type: '전용동글(리시버), 블루투스', engraving: '한/영 정각', price: 35910, weight_g: 768 }),
    makeKeyboard({ switch_type: '기계식', connection: '무선', layout: '98키', backlight: '없음', wireless_type: '전용동글(리시버)', engraving: '레이저각인 키캡', price: 9900, weight_g: 500 }),
    makeKeyboard({ switch_type: '기계식', connection: '유선+무선', layout: '99키', backlight: 'RGB 백라이트', wireless_type: '전용동글(리시버), 블루투스', engraving: '한/영 정각', price: 82000, weight_g: 1183 }),
  ];

  it('switch_type에서 6종 스위치 타입이 모두 추출된다', () => {
    const schema = extractDatasetSchema(REAL_SAMPLE);
    const switches = schema['switch_type'];
    expect(switches).toContain('기계식');
    expect(switches).toContain('펜타그래프');
    expect(switches).toContain('무접점 자석축');
    expect(switches).toContain('무접점 광축');
    expect(switches).toContain('멤브레인');
    expect(switches).toContain('무접점');
  });

  it('connection에서 유선, 무선, 유선+무선 3종이 모두 추출된다', () => {
    const schema = extractDatasetSchema(REAL_SAMPLE);
    const connections = schema['connection'];
    expect(connections).toContain('유선');
    expect(connections).toContain('무선');
    expect(connections).toContain('유선+무선');
    expect(connections.size).toBe(3);
  });

  it('layout에서 풀배열, 텐키리스, 미니, 98키, 99키가 추출된다', () => {
    const schema = extractDatasetSchema(REAL_SAMPLE);
    const layouts = schema['layout'];
    expect(layouts).toContain('풀배열');
    expect(layouts).toContain('텐키리스');
    expect(layouts).toContain('미니');
    expect(layouts).toContain('98키');
    expect(layouts).toContain('99키');
  });

  it('engraving에서 한/영 정각, 영문 정각, 레이저각인 키캡이 추출된다', () => {
    const schema = extractDatasetSchema(REAL_SAMPLE);
    const engravings = schema['engraving'];
    expect(engravings).toContain('한/영 정각');
    expect(engravings).toContain('영문 정각');
    expect(engravings).toContain('레이저각인 키캡');
  });

  it('wireless_type에서 유선, 블루투스, 전용동글 포함 값들이 추출된다', () => {
    const schema = extractDatasetSchema(REAL_SAMPLE);
    const wirelessTypes = schema['wireless_type'];
    expect(wirelessTypes).toContain('유선');
    expect(wirelessTypes).toContain('블루투스');
    expect(wirelessTypes).toContain('전용동글(리시버), 블루투스');
    expect(wirelessTypes).toContain('블루투스, 전용동글(리시버)');
    expect(wirelessTypes).toContain('전용동글(리시버)');
  });

  it('backlight에서 RGB 백라이트와 없음이 추출된다', () => {
    const schema = extractDatasetSchema(REAL_SAMPLE);
    const backlights = schema['backlight'];
    expect(backlights).toContain('RGB 백라이트');
    expect(backlights).toContain('없음');
  });

  it('price 범위가 올바르게 추출된다 (최솟값 9900, 최댓값 328560 포함)', () => {
    const schema = extractDatasetSchema(REAL_SAMPLE);
    const prices = schema['price'];
    expect(prices).toContain(9900);
    expect(prices).toContain(328560);
  });

  it('weight_g에서 경량(222g)과 중량(1233g)이 모두 추출된다', () => {
    const schema = extractDatasetSchema(REAL_SAMPLE);
    const weights = schema['weight_g'];
    expect(weights).toContain(222);
    expect(weights).toContain(1233);
  });
});

// ---------------------------------------------------------------------------
// 7. getFieldValues 헬퍼 함수
// ---------------------------------------------------------------------------

describe('getFieldValues - 특정 속성 값 집합 조회', () => {
  it('존재하는 속성의 값 집합을 반환한다', () => {
    const schema = extractDatasetSchema(SAMPLE_DATASET);
    const connections = getFieldValues(schema, 'connection');
    expect(connections).toContain('유선');
    expect(connections).toContain('무선');
  });

  it('존재하지 않는 속성에 대해 빈 Set을 반환한다', () => {
    const schema = extractDatasetSchema(SAMPLE_DATASET);
    const result = getFieldValues(schema, 'nonexistent_field');
    expect(result.size).toBe(0);
  });

  it('빈 스키마에서 조회하면 빈 Set을 반환한다', () => {
    const result = getFieldValues({}, 'connection');
    expect(result.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 8. hasField 헬퍼 함수
// ---------------------------------------------------------------------------

describe('hasField - 속성 존재 여부 확인', () => {
  it('존재하는 속성에 대해 true를 반환한다', () => {
    const schema = extractDatasetSchema(SAMPLE_DATASET);
    expect(hasField(schema, 'connection')).toBe(true);
    expect(hasField(schema, 'layout')).toBe(true);
    expect(hasField(schema, 'price')).toBe(true);
    expect(hasField(schema, 'weight_g')).toBe(true);
  });

  it('존재하지 않는 속성에 대해 false를 반환한다', () => {
    const schema = extractDatasetSchema(SAMPLE_DATASET);
    expect(hasField(schema, 'brand_country')).toBe(false);
    expect(hasField(schema, '')).toBe(false);
  });

  it('빈 스키마에서 모든 속성은 false를 반환한다', () => {
    expect(hasField({}, 'connection')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 9. hasValue 헬퍼 함수
// ---------------------------------------------------------------------------

describe('hasValue - 속성 값 존재 여부 확인', () => {
  it('존재하는 속성-값 조합에 대해 true를 반환한다', () => {
    const schema = extractDatasetSchema(SAMPLE_DATASET);
    expect(hasValue(schema, 'connection', '유선')).toBe(true);
    expect(hasValue(schema, 'connection', '무선')).toBe(true);
    expect(hasValue(schema, 'switch_type', '기계식')).toBe(true);
    expect(hasValue(schema, 'price', 42800)).toBe(true);
    expect(hasValue(schema, 'weight_g', 916)).toBe(true);
  });

  it('존재하지 않는 값에 대해 false를 반환한다', () => {
    const schema = extractDatasetSchema(SAMPLE_DATASET);
    expect(hasValue(schema, 'connection', '위성')).toBe(false);
    expect(hasValue(schema, 'layout', '96키')).toBe(false);
    expect(hasValue(schema, 'price', 1)).toBe(false);
  });

  it('존재하지 않는 속성에 대해 false를 반환한다', () => {
    const schema = extractDatasetSchema(SAMPLE_DATASET);
    expect(hasValue(schema, 'nonexistent', '유선')).toBe(false);
  });

  it('빈 스키마에서 항상 false를 반환한다', () => {
    expect(hasValue({}, 'connection', '유선')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 10. 반환 타입 및 불변성 확인
// ---------------------------------------------------------------------------

describe('extractDatasetSchema - 반환 타입 확인', () => {
  it('반환 값은 객체(Record)이다', () => {
    const schema = extractDatasetSchema(SAMPLE_DATASET);
    expect(typeof schema).toBe('object');
    expect(schema).not.toBeNull();
    expect(Array.isArray(schema)).toBe(false);
  });

  it('각 속성의 값은 Set 인스턴스이다', () => {
    const schema = extractDatasetSchema(SAMPLE_DATASET);
    Object.values(schema).forEach((valueSet) => {
      expect(valueSet).toBeInstanceOf(Set);
    });
  });

  it('여러 번 호출해도 동일한 결과를 반환한다 (결정론적)', () => {
    const schema1 = extractDatasetSchema(SAMPLE_DATASET);
    const schema2 = extractDatasetSchema(SAMPLE_DATASET);
    const fields = Object.keys(schema1);
    fields.forEach((field) => {
      const set1 = schema1[field];
      const set2 = schema2[field];
      expect(set1.size).toBe(set2.size);
      set1.forEach((value) => {
        expect(set2).toContain(value);
      });
    });
  });
});
