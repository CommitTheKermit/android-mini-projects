/**
 * sanitizeTags(raw: unknown) 단위 테스트
 *
 * 검증 시나리오:
 * 1. 알 수 없는 키 제거 (unknown key removal)
 * 2. 잘못된 열거형 폐기 (invalid enum discard)
 * 3. 유효한 값 보존 (valid value preservation)
 */

import { describe, it, expect } from 'vitest';
import { sanitizeTags } from '../lib/extractRawTags';

// ---------------------------------------------------------------------------
// 1. 알 수 없는 키 제거
// ---------------------------------------------------------------------------

describe('sanitizeTags - 알 수 없는 키 제거', () => {
  it('최상위에 hardConstraints/softIntentTags 외 키가 있으면 무시한다', () => {
    const raw = {
      hardConstraints: { price_max: 150000 },
      softIntentTags: ['조용함'],
      unknownTopKey: '폐기되어야 함',
      extraField: 123,
    };
    const result = sanitizeTags(raw);

    expect(result).not.toHaveProperty('unknownTopKey');
    expect(result).not.toHaveProperty('extraField');
    expect(result).toHaveProperty('hardConstraints');
    expect(result).toHaveProperty('softIntentTags');
  });

  it('hardConstraints에 스키마 밖 키(brand 등)가 있으면 제거한다', () => {
    const raw = {
      hardConstraints: {
        brand: 'Leopold',       // 스키마 외 키 - 제거
        model: 'FC900R',        // 스키마 외 키 - 제거
        price_max: 300000,      // 유효 - 보존
        connection: '유선',     // 유효 - 보존
      },
      softIntentTags: [],
    };
    const result = sanitizeTags(raw);

    expect(result.hardConstraints).not.toHaveProperty('brand');
    expect(result.hardConstraints).not.toHaveProperty('model');
    expect(result.hardConstraints.price_max).toBe(300000);
    expect(result.hardConstraints.connection).toBe('유선');
  });

  it('hardConstraints에 허용되지 않는 숫자 키는 제거한다', () => {
    const raw = {
      hardConstraints: {
        unknown_numeric: 9999,  // 스키마 외 키 - 제거
        price_min: 50000,       // 유효 - 보존
      },
      softIntentTags: [],
    };
    const result = sanitizeTags(raw);

    expect(result.hardConstraints).not.toHaveProperty('unknown_numeric');
    expect(result.hardConstraints.price_min).toBe(50000);
  });

  it('non-object hardConstraints는 빈 객체로 대체한다', () => {
    const raw = {
      hardConstraints: '문자열은 안됨',
      softIntentTags: ['게이밍'],
    };
    const result = sanitizeTags(raw);

    expect(result.hardConstraints).toEqual({});
    expect(result.softIntentTags).toContain('게이밍');
  });

  it('배열 hardConstraints는 빈 객체로 대체한다', () => {
    const raw = {
      hardConstraints: [{ price_max: 100000 }],
      softIntentTags: [],
    };
    const result = sanitizeTags(raw);

    expect(result.hardConstraints).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// 2. 잘못된 열거형 폐기
// ---------------------------------------------------------------------------

describe('sanitizeTags - 잘못된 열거형 폐기', () => {
  it('connection에 허용되지 않는 값이 오면 해당 키를 제거한다', () => {
    const raw = {
      hardConstraints: {
        connection: '위성통신',  // 허용 안 됨 - 제거
        layout: '텐키리스',      // 유효 - 보존
      },
      softIntentTags: [],
    };
    const result = sanitizeTags(raw);

    expect(result.hardConstraints).not.toHaveProperty('connection');
    expect(result.hardConstraints.layout).toBe('텐키리스');
  });

  it('layout에 허용되지 않는 값이 오면 해당 키를 제거한다', () => {
    const raw = {
      hardConstraints: {
        layout: '40%',          // 허용 안 됨 - 제거
        connection: '무선',     // 유효 - 보존
      },
      softIntentTags: [],
    };
    const result = sanitizeTags(raw);

    expect(result.hardConstraints).not.toHaveProperty('layout');
    expect(result.hardConstraints.connection).toBe('무선');
  });

  it('switch_type에 허용되지 않는 값이 오면 해당 키를 제거한다', () => {
    const raw = {
      hardConstraints: {
        switch_type: '광축',    // 허용 안 됨 - 제거 (정확한 값은 '무접점 광축')
        price_max: 200000,      // 유효 - 보존
      },
      softIntentTags: [],
    };
    const result = sanitizeTags(raw);

    expect(result.hardConstraints).not.toHaveProperty('switch_type');
    expect(result.hardConstraints.price_max).toBe(200000);
  });

  it('backlight에 허용되지 않는 값이 오면 해당 키를 제거한다', () => {
    const raw = {
      hardConstraints: {
        backlight: '레이저',    // 허용 안 됨 - 제거
      },
      softIntentTags: [],
    };
    const result = sanitizeTags(raw);

    expect(result.hardConstraints).not.toHaveProperty('backlight');
  });

  it('engraving에 허용되지 않는 값이 오면 해당 키를 제거한다', () => {
    const raw = {
      hardConstraints: {
        engraving: '이중샷',    // 허용 안 됨 - 제거
      },
      softIntentTags: [],
    };
    const result = sanitizeTags(raw);

    expect(result.hardConstraints).not.toHaveProperty('engraving');
  });

  it('숫자 키(price_max 등)에 문자열 값이 오면 해당 키를 제거한다', () => {
    const raw = {
      hardConstraints: {
        price_max: '200000',    // 타입 오류 - 제거
        price_min: 50000,       // 유효 - 보존
        weight_max_g: '800',    // 타입 오류 - 제거
      },
      softIntentTags: [],
    };
    const result = sanitizeTags(raw);

    expect(result.hardConstraints).not.toHaveProperty('price_max');
    expect(result.hardConstraints).not.toHaveProperty('weight_max_g');
    expect(result.hardConstraints.price_min).toBe(50000);
  });

  it('softIntentTags에 어휘 외 태그는 제거된다', () => {
    const raw = {
      hardConstraints: {},
      softIntentTags: ['조용함', '알수없는태그', '사무용', '없는태그123'],
    };
    const result = sanitizeTags(raw);

    expect(result.softIntentTags).toContain('조용함');
    expect(result.softIntentTags).toContain('사무용');
    expect(result.softIntentTags).not.toContain('알수없는태그');
    expect(result.softIntentTags).not.toContain('없는태그123');
  });

  it('softIntentTags에 숫자/객체/null 항목은 제거된다', () => {
    const raw = {
      hardConstraints: {},
      softIntentTags: ['게이밍', 42, null, { tag: '타건감' }, 'RGB'],
    };
    const result = sanitizeTags(raw);

    expect(result.softIntentTags).toContain('게이밍');
    expect(result.softIntentTags).toContain('RGB');
    expect(result.softIntentTags).toHaveLength(2);
  });

  it('non-array softIntentTags는 빈 배열로 대체한다', () => {
    const raw = {
      hardConstraints: {},
      softIntentTags: '조용함',  // 배열이어야 함
    };
    const result = sanitizeTags(raw);

    expect(result.softIntentTags).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 3. 유효한 값 보존
// ---------------------------------------------------------------------------

describe('sanitizeTags - 유효한 값 보존', () => {
  it('모든 유효한 hardConstraints 필드를 보존한다', () => {
    const raw = {
      hardConstraints: {
        price_max: 300000,
        price_min: 50000,
        weight_max_g: 1000,
        connection: '무선',
        layout: '텐키리스',
        switch_type: '무접점 자석축',
        wireless_type: '블루투스',
        engraving: '한/영 정각',
        backlight: 'RGB 백라이트',
      },
      softIntentTags: [],
    };
    const result = sanitizeTags(raw);

    expect(result.hardConstraints.price_max).toBe(300000);
    expect(result.hardConstraints.price_min).toBe(50000);
    expect(result.hardConstraints.weight_max_g).toBe(1000);
    expect(result.hardConstraints.connection).toBe('무선');
    expect(result.hardConstraints.layout).toBe('텐키리스');
    expect(result.hardConstraints.switch_type).toBe('무접점 자석축');
    expect(result.hardConstraints.wireless_type).toBe('블루투스');
    expect(result.hardConstraints.engraving).toBe('한/영 정각');
    expect(result.hardConstraints.backlight).toBe('RGB 백라이트');
  });

  it('모든 유효한 softIntentTags를 보존한다', () => {
    const validTags = ['조용함', '사무용', '게이밍', '휴대성', 'RGB', '무선', '가성비', '타건감'];
    const raw = {
      hardConstraints: {},
      softIntentTags: validTags,
    };
    const result = sanitizeTags(raw);

    validTags.forEach((tag) => expect(result.softIntentTags).toContain(tag));
    expect(result.softIntentTags).toHaveLength(validTags.length);
  });

  it('빈 hardConstraints와 빈 softIntentTags는 그대로 반환한다', () => {
    const raw = {
      hardConstraints: {},
      softIntentTags: [],
    };
    const result = sanitizeTags(raw);

    expect(result.hardConstraints).toEqual({});
    expect(result.softIntentTags).toEqual([]);
  });

  it('layout 유효 열거형(풀배열, 텐키리스, 미니, 98키, 99키, 96키)를 모두 보존한다', () => {
    const validLayouts = ['풀배열', '텐키리스', '미니', '98키', '99키', '96키'];
    validLayouts.forEach((layout) => {
      const result = sanitizeTags({ hardConstraints: { layout }, softIntentTags: [] });
      expect(result.hardConstraints.layout).toBe(layout);
    });
  });

  it('connection 유효 열거형(유선, 무선, 유선+무선)을 모두 보존한다', () => {
    const validConnections = ['유선', '무선', '유선+무선'];
    validConnections.forEach((connection) => {
      const result = sanitizeTags({ hardConstraints: { connection }, softIntentTags: [] });
      expect(result.hardConstraints.connection).toBe(connection);
    });
  });

  it('switch_type 유효 열거형을 모두 보존한다', () => {
    const validSwitchTypes = ['기계식', '펜타그래프', '무접점 자석축', '무접점 광축', '멤브레인', '무접점'];
    validSwitchTypes.forEach((switch_type) => {
      const result = sanitizeTags({ hardConstraints: { switch_type }, softIntentTags: [] });
      expect(result.hardConstraints.switch_type).toBe(switch_type);
    });
  });

  it('extractRawTags 결과(ExtractedTags 형태)를 그대로 받으면 변경 없이 반환한다', () => {
    const extractedTagsShape = {
      hardConstraints: {
        price_max: 150000,
        connection: '무선',
        layout: '텐키리스',
      },
      softIntentTags: ['조용함', '사무용', '무선'],
    };
    const result = sanitizeTags(extractedTagsShape);

    expect(result).toEqual(extractedTagsShape);
  });
});

// ---------------------------------------------------------------------------
// 4. 경계/비정상 입력 처리
// ---------------------------------------------------------------------------

describe('sanitizeTags - 비정상 입력 처리', () => {
  it('null 입력은 빈 구조를 반환한다', () => {
    const result = sanitizeTags(null);
    expect(result).toEqual({ hardConstraints: {}, softIntentTags: [] });
  });

  it('배열 입력은 빈 구조를 반환한다', () => {
    const result = sanitizeTags([]);
    expect(result).toEqual({ hardConstraints: {}, softIntentTags: [] });
  });

  it('문자열 입력은 빈 구조를 반환한다', () => {
    const result = sanitizeTags('{"hardConstraints":{}}');
    expect(result).toEqual({ hardConstraints: {}, softIntentTags: [] });
  });

  it('숫자 입력은 빈 구조를 반환한다', () => {
    const result = sanitizeTags(42);
    expect(result).toEqual({ hardConstraints: {}, softIntentTags: [] });
  });

  it('hardConstraints와 softIntentTags 모두 없는 빈 객체도 유효하다', () => {
    const result = sanitizeTags({});
    expect(result.hardConstraints).toEqual({});
    expect(result.softIntentTags).toEqual([]);
  });

  it('유효+무효 혼합 입력에서 유효한 것만 살아남는다', () => {
    const raw = {
      hardConstraints: {
        price_max: 200000,          // 유효
        brand: 'Leopold',           // 스키마 외 - 제거
        connection: '위성통신',     // 잘못된 열거형 - 제거
        layout: '풀배열',           // 유효
        price_min: '50000',         // 타입 오류 - 제거
      },
      softIntentTags: ['조용함', '이상한태그', '게이밍', 999],
      extraField: 'ignored',        // 최상위 스키마 외 - 무시
    };
    const result = sanitizeTags(raw);

    expect(result.hardConstraints.price_max).toBe(200000);
    expect(result.hardConstraints.layout).toBe('풀배열');
    expect(result.hardConstraints).not.toHaveProperty('brand');
    expect(result.hardConstraints).not.toHaveProperty('connection');
    expect(result.hardConstraints).not.toHaveProperty('price_min');
    expect(result.softIntentTags).toContain('조용함');
    expect(result.softIntentTags).toContain('게이밍');
    expect(result.softIntentTags).not.toContain('이상한태그');
    expect(result).not.toHaveProperty('extraField');
  });
});
