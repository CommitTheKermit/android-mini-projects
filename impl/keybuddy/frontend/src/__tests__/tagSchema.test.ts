import { describe, it, expect } from 'vitest';
import {
  HARD_NUMERIC_KEYS,
  HARD_ENUM_KEYS,
  HARD_CONSTRAINT_KEYS,
  HARD_CONSTRAINT_ENUMS,
  SOFT_INTENT_VOCAB,
  isSoftIntentTag,
  isHardConstraintKey,
  isValidHardEnumValue,
  validateTagSchema,
} from '../lib/tagSchema';

describe('HARD_NUMERIC_KEYS', () => {
  it('should be a non-empty readonly array of strings', () => {
    expect(Array.isArray(HARD_NUMERIC_KEYS)).toBe(true);
    expect(HARD_NUMERIC_KEYS.length).toBeGreaterThan(0);
    HARD_NUMERIC_KEYS.forEach((k) => expect(typeof k).toBe('string'));
  });

  it('should contain price_max, price_min, weight_max_g', () => {
    expect(HARD_NUMERIC_KEYS).toContain('price_max');
    expect(HARD_NUMERIC_KEYS).toContain('price_min');
    expect(HARD_NUMERIC_KEYS).toContain('weight_max_g');
  });

  it('should have no duplicates', () => {
    expect(new Set(HARD_NUMERIC_KEYS).size).toBe(HARD_NUMERIC_KEYS.length);
  });
});

describe('HARD_ENUM_KEYS', () => {
  it('should be a non-empty readonly array of strings', () => {
    expect(Array.isArray(HARD_ENUM_KEYS)).toBe(true);
    expect(HARD_ENUM_KEYS.length).toBeGreaterThan(0);
    HARD_ENUM_KEYS.forEach((k) => expect(typeof k).toBe('string'));
  });

  it('should contain all required enum field names', () => {
    const required = ['connection', 'layout', 'switch_type', 'wireless_type', 'engraving', 'backlight'];
    required.forEach((key) => expect(HARD_ENUM_KEYS).toContain(key));
  });

  it('should have no duplicates', () => {
    expect(new Set(HARD_ENUM_KEYS).size).toBe(HARD_ENUM_KEYS.length);
  });
});

describe('HARD_CONSTRAINT_KEYS', () => {
  it('should include all numeric and enum keys', () => {
    HARD_NUMERIC_KEYS.forEach((k) => expect(HARD_CONSTRAINT_KEYS).toContain(k));
    HARD_ENUM_KEYS.forEach((k) => expect(HARD_CONSTRAINT_KEYS).toContain(k));
  });

  it('should have no duplicates', () => {
    expect(new Set(HARD_CONSTRAINT_KEYS).size).toBe(HARD_CONSTRAINT_KEYS.length);
  });

  it('total length equals numeric + enum keys', () => {
    expect(HARD_CONSTRAINT_KEYS.length).toBe(HARD_NUMERIC_KEYS.length + HARD_ENUM_KEYS.length);
  });
});

describe('HARD_CONSTRAINT_ENUMS', () => {
  it('should have exactly the same keys as HARD_ENUM_KEYS', () => {
    const enumKeys = Object.keys(HARD_CONSTRAINT_ENUMS).sort();
    const schemaKeys = [...HARD_ENUM_KEYS].sort();
    expect(enumKeys).toEqual(schemaKeys);
  });

  it('connection - should contain 유선, 무선, 유선+무선', () => {
    expect(HARD_CONSTRAINT_ENUMS.connection).toContain('유선');
    expect(HARD_CONSTRAINT_ENUMS.connection).toContain('무선');
    expect(HARD_CONSTRAINT_ENUMS.connection).toContain('유선+무선');
  });

  it('layout - should contain standard layout values', () => {
    const expected = ['풀배열', '텐키리스', '미니'];
    expected.forEach((v) => expect(HARD_CONSTRAINT_ENUMS.layout).toContain(v));
  });

  it('switch_type - should contain known switch types', () => {
    const expected = ['기계식', '펜타그래프', '무접점 자석축', '무접점 광축', '멤브레인', '무접점'];
    expected.forEach((v) => expect(HARD_CONSTRAINT_ENUMS.switch_type).toContain(v));
  });

  it('wireless_type - should contain known wireless types', () => {
    const expected = ['전용동글(리시버)', '블루투스', '유선'];
    expected.forEach((v) => expect(HARD_CONSTRAINT_ENUMS.wireless_type).toContain(v));
  });

  it('engraving - should contain known engraving types', () => {
    const expected = ['한/영 정각', '영문 정각', '레이저각인 키캡', '정보없음'];
    expected.forEach((v) => expect(HARD_CONSTRAINT_ENUMS.engraving).toContain(v));
  });

  it('backlight - should contain known backlight types', () => {
    const expected = ['RGB 백라이트', '레인보우 백라이트', '단색 백라이트', '없음'];
    expected.forEach((v) => expect(HARD_CONSTRAINT_ENUMS.backlight).toContain(v));
  });

  it('each enum array should have no duplicates', () => {
    (Object.entries(HARD_CONSTRAINT_ENUMS) as [string, readonly string[]][]).forEach(
      ([key, values]) => {
        expect(new Set(values).size, `${key} has duplicate values`).toBe(values.length);
      },
    );
  });

  it('each enum array should be non-empty', () => {
    (Object.values(HARD_CONSTRAINT_ENUMS) as readonly (readonly string[])[]).forEach((values) => {
      expect(values.length).toBeGreaterThan(0);
    });
  });
});

describe('SOFT_INTENT_VOCAB', () => {
  it('should be a non-empty readonly array of strings', () => {
    expect(Array.isArray(SOFT_INTENT_VOCAB)).toBe(true);
    expect(SOFT_INTENT_VOCAB.length).toBeGreaterThan(0);
    SOFT_INTENT_VOCAB.forEach((t) => expect(typeof t).toBe('string'));
  });

  it('should contain core intent tags', () => {
    const core = ['조용함', '사무용', '게이밍', '휴대성', 'RGB', '무선', '가성비', '타건감'];
    core.forEach((tag) => expect(SOFT_INTENT_VOCAB).toContain(tag));
  });

  it('should have no duplicates', () => {
    expect(new Set(SOFT_INTENT_VOCAB).size).toBe(SOFT_INTENT_VOCAB.length);
  });

  it('should have at least 10 tags to cover diverse intents', () => {
    expect(SOFT_INTENT_VOCAB.length).toBeGreaterThanOrEqual(10);
  });
});

describe('isSoftIntentTag()', () => {
  it('returns true for valid tags', () => {
    expect(isSoftIntentTag('조용함')).toBe(true);
    expect(isSoftIntentTag('게이밍')).toBe(true);
    expect(isSoftIntentTag('RGB')).toBe(true);
  });

  it('returns false for unknown strings', () => {
    expect(isSoftIntentTag('알수없는태그')).toBe(false);
    expect(isSoftIntentTag('')).toBe(false);
  });
});

describe('isHardConstraintKey()', () => {
  it('returns true for valid keys', () => {
    expect(isHardConstraintKey('price_max')).toBe(true);
    expect(isHardConstraintKey('connection')).toBe(true);
    expect(isHardConstraintKey('layout')).toBe(true);
  });

  it('returns false for unknown strings', () => {
    expect(isHardConstraintKey('brand')).toBe(false);
    expect(isHardConstraintKey('')).toBe(false);
    expect(isHardConstraintKey('product_name')).toBe(false);
  });
});

describe('isValidHardEnumValue()', () => {
  it('returns true for valid key-value pairs', () => {
    expect(isValidHardEnumValue('connection', '유선')).toBe(true);
    expect(isValidHardEnumValue('layout', '텐키리스')).toBe(true);
    expect(isValidHardEnumValue('backlight', 'RGB 백라이트')).toBe(true);
  });

  it('returns false for invalid values', () => {
    expect(isValidHardEnumValue('connection', '위성')).toBe(false);
    expect(isValidHardEnumValue('layout', '알수없음')).toBe(false);
    expect(isValidHardEnumValue('backlight', '레이저')).toBe(false);
  });
});

describe('validateTagSchema()', () => {
  it('유효한 전체 객체는 통과한다', () => {
    const result = validateTagSchema({
      hardConstraints: { price_max: 200000, connection: '무선' },
      softIntentTags: ['조용함', '사무용'],
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('빈 객체는 통과한다', () => {
    const result = validateTagSchema({});
    expect(result.valid).toBe(true);
  });

  it('hardConstraints만 있는 객체는 통과한다', () => {
    const result = validateTagSchema({
      hardConstraints: { layout: '텐키리스', price_max: 150000 },
    });
    expect(result.valid).toBe(true);
  });

  it('softIntentTags만 있는 객체는 통과한다', () => {
    const result = validateTagSchema({ softIntentTags: ['게이밍', 'RGB'] });
    expect(result.valid).toBe(true);
  });

  it('null 입력은 오류를 반환한다', () => {
    const result = validateTagSchema(null);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('배열 입력은 오류를 반환한다', () => {
    const result = validateTagSchema([]);
    expect(result.valid).toBe(false);
  });

  it('문자열 입력은 오류를 반환한다', () => {
    const result = validateTagSchema('invalid');
    expect(result.valid).toBe(false);
  });

  it('최상위에 알 수 없는 키가 있으면 오류를 반환한다', () => {
    const result = validateTagSchema({ unknownKey: 'value' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('unknownKey'))).toBe(true);
  });

  it('hardConstraints에 알 수 없는 키가 있으면 오류를 반환한다', () => {
    const result = validateTagSchema({
      hardConstraints: { brand: 'Leopold' },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('brand'))).toBe(true);
  });

  it('열거형 키에 허용되지 않는 값이 있으면 오류를 반환한다', () => {
    const result = validateTagSchema({
      hardConstraints: { connection: '위성통신' },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('위성통신'))).toBe(true);
  });

  it('숫자 키에 문자열 값이 있으면 오류를 반환한다', () => {
    const result = validateTagSchema({
      hardConstraints: { price_max: '200000' },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('price_max'))).toBe(true);
  });

  it('softIntentTags에 스키마 밖 태그가 있으면 오류를 반환한다', () => {
    const result = validateTagSchema({ softIntentTags: ['알수없는태그'] });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('알수없는태그'))).toBe(true);
  });

  it('softIntentTags가 배열이 아니면 오류를 반환한다', () => {
    const result = validateTagSchema({ softIntentTags: '조용함' });
    expect(result.valid).toBe(false);
  });

  it('여러 오류가 한 번에 수집된다', () => {
    const result = validateTagSchema({
      hardConstraints: { brand: 'Leopold', connection: '위성통신' },
      softIntentTags: ['알수없는태그'],
      unknownTopKey: 1,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });

  it('layout 유효 열거형 값은 통과한다', () => {
    const result = validateTagSchema({
      hardConstraints: { layout: '풀배열' },
    });
    expect(result.valid).toBe(true);
  });

  it('switch_type 허용 값은 통과한다', () => {
    const result = validateTagSchema({
      hardConstraints: { switch_type: '기계식' },
    });
    expect(result.valid).toBe(true);
  });

  it('backlight 허용 값은 통과한다', () => {
    const result = validateTagSchema({
      hardConstraints: { backlight: 'RGB 백라이트' },
    });
    expect(result.valid).toBe(true);
  });

  it('engraving 허용 값은 통과한다', () => {
    const result = validateTagSchema({
      hardConstraints: { engraving: '한/영 정각' },
    });
    expect(result.valid).toBe(true);
  });

  it('weight_max_g 숫자 값은 통과한다', () => {
    const result = validateTagSchema({
      hardConstraints: { weight_max_g: 800 },
    });
    expect(result.valid).toBe(true);
  });

  // --- 하드 제약 필드 누락/타입 오류 ---
  it('hardConstraints가 null이면 오류를 반환한다', () => {
    const result = validateTagSchema({ hardConstraints: null });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('hardConstraints'))).toBe(true);
  });

  it('hardConstraints가 배열이면 오류를 반환한다', () => {
    const result = validateTagSchema({ hardConstraints: [] });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('hardConstraints'))).toBe(true);
  });

  it('hardConstraints가 문자열이면 오류를 반환한다', () => {
    const result = validateTagSchema({ hardConstraints: 'connection=무선' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('hardConstraints'))).toBe(true);
  });

  it('price_min 숫자 값은 통과한다', () => {
    const result = validateTagSchema({ hardConstraints: { price_min: 50000 } });
    expect(result.valid).toBe(true);
  });

  it('price_min에 문자열이 오면 오류를 반환한다', () => {
    const result = validateTagSchema({ hardConstraints: { price_min: '50000' } });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('price_min'))).toBe(true);
  });

  // --- 소프트 의도 필드 누락/타입 오류 ---
  it('softIntentTags가 null이면 오류를 반환한다', () => {
    const result = validateTagSchema({ softIntentTags: null });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('softIntentTags'))).toBe(true);
  });

  it('softIntentTags 요소에 숫자가 있으면 오류를 반환한다', () => {
    const result = validateTagSchema({ softIntentTags: ['조용함', 42] });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('42'))).toBe(true);
  });

  it('softIntentTags 요소에 null이 있으면 오류를 반환한다', () => {
    const result = validateTagSchema({ softIntentTags: [null] });
    expect(result.valid).toBe(false);
  });

  it('softIntentTags가 없는 객체(hardConstraints만)는 softIntentTags 오류 없이 통과한다', () => {
    const result = validateTagSchema({ hardConstraints: {} });
    expect(result.errors.some((e) => e.includes('softIntentTags'))).toBe(false);
  });

  it('hardConstraints가 없는 객체(softIntentTags만)는 hardConstraints 오류 없이 통과한다', () => {
    const result = validateTagSchema({ softIntentTags: ['게이밍'] });
    expect(result.errors.some((e) => e.includes('hardConstraints'))).toBe(false);
  });
});
