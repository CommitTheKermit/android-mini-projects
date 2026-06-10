/**
 * 하드 제약 태그 추출 정확도 골드셋 테스트 (Sub-AC 1)
 *
 * 대표 자연어 쿼리 10개에 대해 하드 제약 추출 함수(NL -> 하드 제약 태그)가
 * 기대 태그 셋을 반환하는지 검증한다.
 *
 * - 가격 범위(price_max / price_min)
 * - 스위치 타입(switch_type)
 * - 폼팩터(layout)
 * - 연결 방식(connection / wireless_type)
 * - 백라이트(backlight)
 * - 각인(engraving)
 * - 무게(weight_max_g)
 * - 복합 제약(여러 하드 제약 동시)
 */

import { describe, it, expect, afterEach } from 'vitest';
import { extractAndValidateTags, _setClientForTest } from '../lib/extractRawTags';
import { validateTagSchema } from '../lib/tagSchema';
import type { AnthropicClient } from '../lib/extractRawTags';

// ---------------------------------------------------------------------------
// 모킹 헬퍼
// ---------------------------------------------------------------------------

function makeMockClient(responseText: string): AnthropicClient {
  return {
    messages: {
      create: async () => ({
        id: 'mock-id',
        type: 'message',
        role: 'assistant',
        model: 'claude-haiku-4-5',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 0, output_tokens: 0 },
        content: [{ type: 'text', text: responseText }],
      }),
    } as unknown as AnthropicClient['messages'],
  };
}

afterEach(() => {
  _setClientForTest(null);
});

// ---------------------------------------------------------------------------
// 골드셋 - 쿼리별 기대 하드 제약 태그 검증
// ---------------------------------------------------------------------------

describe('하드 제약 태그 추출 정확도 골드셋', () => {
  // -------------------------------------------------------------------------
  // GS-1: 가격 상한 + 스위치 타입 (기계식)
  // -------------------------------------------------------------------------
  it('GS-1: "30만원 이하 기계식 게이밍 키보드" -> price_max:300000, switch_type:기계식', async () => {
    _setClientForTest(
      makeMockClient(
        JSON.stringify({
          hardConstraints: { price_max: 300000, switch_type: '기계식' },
          softIntentTags: ['게이밍', '기계식', '타건감'],
        }),
      ),
    );

    const result = await extractAndValidateTags('30만원 이하 기계식 게이밍 키보드');

    expect(result.hardConstraints.price_max).toBe(300000);
    expect(result.hardConstraints.switch_type).toBe('기계식');
    expect(validateTagSchema(result).valid).toBe(true);
  });

  // -------------------------------------------------------------------------
  // GS-2: 연결 방식 + 폼팩터 + 무선 타입 (블루투스 텐키리스)
  // -------------------------------------------------------------------------
  it('GS-2: "블루투스 텐키리스 무선 키보드" -> connection:무선, layout:텐키리스, wireless_type:블루투스', async () => {
    _setClientForTest(
      makeMockClient(
        JSON.stringify({
          hardConstraints: {
            connection: '무선',
            layout: '텐키리스',
            wireless_type: '블루투스',
          },
          softIntentTags: ['무선', '휴대성', '멀티페어링'],
        }),
      ),
    );

    const result = await extractAndValidateTags('블루투스 텐키리스 무선 키보드');

    expect(result.hardConstraints.connection).toBe('무선');
    expect(result.hardConstraints.layout).toBe('텐키리스');
    expect(result.hardConstraints.wireless_type).toBe('블루투스');
    expect(validateTagSchema(result).valid).toBe(true);
  });

  // -------------------------------------------------------------------------
  // GS-3: 유선 + 풀배열 + 무접점 자석축
  // -------------------------------------------------------------------------
  it('GS-3: "유선 풀배열 무접점 자석축 키보드" -> connection:유선, layout:풀배열, switch_type:무접점 자석축', async () => {
    _setClientForTest(
      makeMockClient(
        JSON.stringify({
          hardConstraints: {
            connection: '유선',
            layout: '풀배열',
            switch_type: '무접점 자석축',
          },
          softIntentTags: ['무접점', '타건감'],
        }),
      ),
    );

    const result = await extractAndValidateTags('유선 풀배열 무접점 자석축 키보드');

    expect(result.hardConstraints.connection).toBe('유선');
    expect(result.hardConstraints.layout).toBe('풀배열');
    expect(result.hardConstraints.switch_type).toBe('무접점 자석축');
    expect(validateTagSchema(result).valid).toBe(true);
  });

  // -------------------------------------------------------------------------
  // GS-4: 가격 상한 + 미니 폼팩터
  // -------------------------------------------------------------------------
  it('GS-4: "10만원 이하 미니 키보드" -> price_max:100000, layout:미니', async () => {
    _setClientForTest(
      makeMockClient(
        JSON.stringify({
          hardConstraints: { price_max: 100000, layout: '미니' },
          softIntentTags: ['미니', '휴대성', '가성비'],
        }),
      ),
    );

    const result = await extractAndValidateTags('10만원 이하 미니 키보드');

    expect(result.hardConstraints.price_max).toBe(100000);
    expect(result.hardConstraints.layout).toBe('미니');
    expect(validateTagSchema(result).valid).toBe(true);
  });

  // -------------------------------------------------------------------------
  // GS-5: 백라이트 + 스위치 타입 (RGB + 기계식)
  // -------------------------------------------------------------------------
  it('GS-5: "RGB 백라이트 기계식 키보드" -> backlight:RGB 백라이트, switch_type:기계식', async () => {
    _setClientForTest(
      makeMockClient(
        JSON.stringify({
          hardConstraints: {
            backlight: 'RGB 백라이트',
            switch_type: '기계식',
          },
          softIntentTags: ['RGB', '백라이트', '게이밍', '기계식'],
        }),
      ),
    );

    const result = await extractAndValidateTags('RGB 백라이트 기계식 키보드');

    expect(result.hardConstraints.backlight).toBe('RGB 백라이트');
    expect(result.hardConstraints.switch_type).toBe('기계식');
    expect(validateTagSchema(result).valid).toBe(true);
  });

  // -------------------------------------------------------------------------
  // GS-6: 무게 상한 + 연결 방식 (가벼운 무선)
  // -------------------------------------------------------------------------
  it('GS-6: "500g 이하 가벼운 무선 키보드" -> connection:무선, weight_max_g:500', async () => {
    _setClientForTest(
      makeMockClient(
        JSON.stringify({
          hardConstraints: {
            connection: '무선',
            weight_max_g: 500,
          },
          softIntentTags: ['무선', '가벼움', '휴대성'],
        }),
      ),
    );

    const result = await extractAndValidateTags('500g 이하 가벼운 무선 키보드');

    expect(result.hardConstraints.connection).toBe('무선');
    expect(result.hardConstraints.weight_max_g).toBe(500);
    expect(validateTagSchema(result).valid).toBe(true);
  });

  // -------------------------------------------------------------------------
  // GS-7: 각인 + 폼팩터 (한영각인 텐키리스)
  // -------------------------------------------------------------------------
  it('GS-7: "한영각인 텐키리스 키보드" -> layout:텐키리스, engraving:한/영 정각', async () => {
    _setClientForTest(
      makeMockClient(
        JSON.stringify({
          hardConstraints: {
            layout: '텐키리스',
            engraving: '한/영 정각',
          },
          softIntentTags: ['텐키리스', '한영각인'],
        }),
      ),
    );

    const result = await extractAndValidateTags('한영각인 텐키리스 키보드');

    expect(result.hardConstraints.layout).toBe('텐키리스');
    expect(result.hardConstraints.engraving).toBe('한/영 정각');
    expect(validateTagSchema(result).valid).toBe(true);
  });

  // -------------------------------------------------------------------------
  // GS-8: 가격 범위(하한+상한) + 스위치 타입 (펜타그래프)
  // -------------------------------------------------------------------------
  it('GS-8: "5만원~15만원 펜타그래프 키보드" -> price_min:50000, price_max:150000, switch_type:펜타그래프', async () => {
    _setClientForTest(
      makeMockClient(
        JSON.stringify({
          hardConstraints: {
            price_min: 50000,
            price_max: 150000,
            switch_type: '펜타그래프',
          },
          softIntentTags: ['펜타그래프', '사무용', '조용함'],
        }),
      ),
    );

    const result = await extractAndValidateTags('5만원에서 15만원 사이 펜타그래프 키보드');

    expect(result.hardConstraints.price_min).toBe(50000);
    expect(result.hardConstraints.price_max).toBe(150000);
    expect(result.hardConstraints.switch_type).toBe('펜타그래프');
    expect(validateTagSchema(result).valid).toBe(true);
  });

  // -------------------------------------------------------------------------
  // GS-9: 백라이트 없음 (단일 제약)
  // -------------------------------------------------------------------------
  it('GS-9: "백라이트 없는 조용한 사무용 키보드" -> backlight:없음', async () => {
    _setClientForTest(
      makeMockClient(
        JSON.stringify({
          hardConstraints: { backlight: '없음' },
          softIntentTags: ['조용함', '사무용', '백라이트없음'],
        }),
      ),
    );

    const result = await extractAndValidateTags('백라이트 없는 조용한 사무용 키보드');

    expect(result.hardConstraints.backlight).toBe('없음');
    expect(validateTagSchema(result).valid).toBe(true);
  });

  // -------------------------------------------------------------------------
  // GS-10: 유선+무선 겸용 + 96키 폼팩터
  // -------------------------------------------------------------------------
  it('GS-10: "유선 무선 겸용 96키 키보드" -> connection:유선+무선, layout:96키', async () => {
    _setClientForTest(
      makeMockClient(
        JSON.stringify({
          hardConstraints: {
            connection: '유선+무선',
            layout: '96키',
          },
          softIntentTags: ['무선'],
        }),
      ),
    );

    const result = await extractAndValidateTags('유선 무선 겸용 96키 키보드');

    expect(result.hardConstraints.connection).toBe('유선+무선');
    expect(result.hardConstraints.layout).toBe('96키');
    expect(validateTagSchema(result).valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 골드셋 - 각 하드 제약 차원의 단일 추출 정확도
// ---------------------------------------------------------------------------

describe('하드 제약 차원별 단일 추출 정확도', () => {
  it('price_max만 포함된 응답에서 price_max를 정확히 추출한다', async () => {
    _setClientForTest(
      makeMockClient(JSON.stringify({ hardConstraints: { price_max: 200000 }, softIntentTags: [] })),
    );

    const result = await extractAndValidateTags('20만원 이하 키보드');

    expect(result.hardConstraints.price_max).toBe(200000);
    expect(Object.keys(result.hardConstraints)).toHaveLength(1);
  });

  it('price_min만 포함된 응답에서 price_min을 정확히 추출한다', async () => {
    _setClientForTest(
      makeMockClient(JSON.stringify({ hardConstraints: { price_min: 150000 }, softIntentTags: [] })),
    );

    const result = await extractAndValidateTags('15만원 이상 고급 키보드');

    expect(result.hardConstraints.price_min).toBe(150000);
  });

  it('layout=98키 단일 제약을 올바르게 추출한다', async () => {
    _setClientForTest(
      makeMockClient(
        JSON.stringify({ hardConstraints: { layout: '98키' }, softIntentTags: [] }),
      ),
    );

    const result = await extractAndValidateTags('98키 키보드 추천');

    expect(result.hardConstraints.layout).toBe('98키');
  });

  it('switch_type=무접점 광축 단일 제약을 올바르게 추출한다', async () => {
    _setClientForTest(
      makeMockClient(
        JSON.stringify({ hardConstraints: { switch_type: '무접점 광축' }, softIntentTags: ['무접점'] }),
      ),
    );

    const result = await extractAndValidateTags('무접점 광축 키보드');

    expect(result.hardConstraints.switch_type).toBe('무접점 광축');
  });

  it('engraving=영문 정각 단일 제약을 올바르게 추출한다', async () => {
    _setClientForTest(
      makeMockClient(
        JSON.stringify({ hardConstraints: { engraving: '영문 정각' }, softIntentTags: ['영문각인'] }),
      ),
    );

    const result = await extractAndValidateTags('영문각인 키보드');

    expect(result.hardConstraints.engraving).toBe('영문 정각');
  });

  it('wireless_type=전용동글(리시버) 단일 제약을 올바르게 추출한다', async () => {
    _setClientForTest(
      makeMockClient(
        JSON.stringify({
          hardConstraints: {
            connection: '무선',
            wireless_type: '전용동글(리시버)',
          },
          softIntentTags: ['무선'],
        }),
      ),
    );

    const result = await extractAndValidateTags('전용 동글 수신기 무선 키보드');

    expect(result.hardConstraints.wireless_type).toBe('전용동글(리시버)');
    expect(result.hardConstraints.connection).toBe('무선');
  });
});

// ---------------------------------------------------------------------------
// 골드셋 - 제약 없는 입력 (hardConstraints가 빈 객체여야 함)
// ---------------------------------------------------------------------------

describe('제약 없는 자연어 입력 - hardConstraints 비어있음', () => {
  it('"키보드 추천해줘" 같은 모호한 입력은 hardConstraints가 빈 객체여야 한다', async () => {
    _setClientForTest(
      makeMockClient(
        JSON.stringify({ hardConstraints: {}, softIntentTags: ['사무용'] }),
      ),
    );

    const result = await extractAndValidateTags('키보드 추천해줘');

    expect(result.hardConstraints).toEqual({});
    expect(validateTagSchema(result).valid).toBe(true);
  });

  it('소프트 의도만 있는 입력은 hardConstraints가 빈 객체여야 한다', async () => {
    _setClientForTest(
      makeMockClient(
        JSON.stringify({
          hardConstraints: {},
          softIntentTags: ['조용함', '사무용', '가성비'],
        }),
      ),
    );

    const result = await extractAndValidateTags('사무실에서 조용하게 쓸 가성비 키보드');

    expect(result.hardConstraints).toEqual({});
    expect(result.softIntentTags).toContain('조용함');
    expect(result.softIntentTags).toContain('사무용');
    expect(result.softIntentTags).toContain('가성비');
    expect(validateTagSchema(result).valid).toBe(true);
  });
});
