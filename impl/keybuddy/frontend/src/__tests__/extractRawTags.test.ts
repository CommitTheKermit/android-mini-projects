/**
 * extractRawTags 단위 테스트
 *
 * LLM 호출을 모킹하여:
 * 1. 반환 객체가 hardConstraints 키를 포함하는지 확인
 * 2. 반환 객체가 softIntentTags 키를 포함하는지 확인
 * 3. 스키마 외 값은 폐기되는지 확인
 * 4. 비정상 LLM 응답도 안전하게 처리되는지 확인
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { extractRawTags, _setClientForTest, parseAndSanitize } from '../lib/extractRawTags';
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

// ---------------------------------------------------------------------------
// 테스트 스위트
// ---------------------------------------------------------------------------

describe('extractRawTags()', () => {
  afterEach(() => {
    _setClientForTest(null);
  });

  // -------------------------------------------------------------------
  // 1. 반환 객체에 hardConstraints 키가 존재한다
  // -------------------------------------------------------------------
  it('반환 객체에 hardConstraints 키가 존재해야 한다', async () => {
    const mockResponse = JSON.stringify({
      hardConstraints: { price_max: 150000, connection: '무선' },
      softIntentTags: ['조용함', '사무용'],
    });
    _setClientForTest(makeMockClient(mockResponse));

    const result = await extractRawTags('조용한 무선 키보드 15만원 이하');

    expect(result).toHaveProperty('hardConstraints');
    expect(typeof result.hardConstraints).toBe('object');
    expect(Array.isArray(result.hardConstraints)).toBe(false);
  });

  // -------------------------------------------------------------------
  // 2. 반환 객체에 softIntentTags 키가 존재한다
  // -------------------------------------------------------------------
  it('반환 객체에 softIntentTags 키가 존재해야 한다', async () => {
    const mockResponse = JSON.stringify({
      hardConstraints: {},
      softIntentTags: ['게이밍', 'RGB'],
    });
    _setClientForTest(makeMockClient(mockResponse));

    const result = await extractRawTags('화려한 RGB 게이밍 키보드');

    expect(result).toHaveProperty('softIntentTags');
    expect(Array.isArray(result.softIntentTags)).toBe(true);
  });

  // -------------------------------------------------------------------
  // 3. hardConstraints 값이 올바르게 파싱된다
  // -------------------------------------------------------------------
  it('hardConstraints - 숫자 제약(price_max)을 올바르게 파싱해야 한다', async () => {
    const mockResponse = JSON.stringify({
      hardConstraints: { price_max: 200000 },
      softIntentTags: [],
    });
    _setClientForTest(makeMockClient(mockResponse));

    const result = await extractRawTags('20만원 이하 키보드');

    expect(result.hardConstraints.price_max).toBe(200000);
  });

  it('hardConstraints - 열거형 제약(connection)을 올바르게 파싱해야 한다', async () => {
    const mockResponse = JSON.stringify({
      hardConstraints: { connection: '무선' },
      softIntentTags: ['무선'],
    });
    _setClientForTest(makeMockClient(mockResponse));

    const result = await extractRawTags('무선 키보드');

    expect(result.hardConstraints.connection).toBe('무선');
  });

  it('hardConstraints - layout 열거형 제약을 올바르게 파싱해야 한다', async () => {
    const mockResponse = JSON.stringify({
      hardConstraints: { layout: '텐키리스' },
      softIntentTags: ['휴대성'],
    });
    _setClientForTest(makeMockClient(mockResponse));

    const result = await extractRawTags('텐키리스 키보드');

    expect(result.hardConstraints.layout).toBe('텐키리스');
  });

  // -------------------------------------------------------------------
  // 4. softIntentTags 값이 올바르게 파싱된다
  // -------------------------------------------------------------------
  it('softIntentTags - 유효한 태그 목록을 올바르게 반환해야 한다', async () => {
    const mockResponse = JSON.stringify({
      hardConstraints: {},
      softIntentTags: ['조용함', '사무용', '가성비'],
    });
    _setClientForTest(makeMockClient(mockResponse));

    const result = await extractRawTags('사무실에서 쓸 조용하고 가성비 좋은 키보드');

    expect(result.softIntentTags).toContain('조용함');
    expect(result.softIntentTags).toContain('사무용');
    expect(result.softIntentTags).toContain('가성비');
  });

  // -------------------------------------------------------------------
  // 5. 스키마 밖 hardConstraints 키는 폐기된다
  // -------------------------------------------------------------------
  it('hardConstraints - 스키마 외 키(brand 등)는 폐기되어야 한다', async () => {
    const mockResponse = JSON.stringify({
      hardConstraints: {
        brand: 'Leopold',       // 스키마 외 키
        price_max: 300000,      // 유효
        connection: '유선',     // 유효
      },
      softIntentTags: ['타건감'],
    });
    _setClientForTest(makeMockClient(mockResponse));

    const result = await extractRawTags('레오폴드 유선 키보드');

    expect(result.hardConstraints).not.toHaveProperty('brand');
    expect(result.hardConstraints.price_max).toBe(300000);
    expect(result.hardConstraints.connection).toBe('유선');
  });

  // -------------------------------------------------------------------
  // 6. 스키마 밖 softIntentTags 값은 폐기된다
  // -------------------------------------------------------------------
  it('softIntentTags - 스키마 어휘 외 태그는 폐기되어야 한다', async () => {
    const mockResponse = JSON.stringify({
      hardConstraints: {},
      softIntentTags: ['조용함', '알수없는태그', '사무용', '완전히없는것'],
    });
    _setClientForTest(makeMockClient(mockResponse));

    const result = await extractRawTags('조용한 사무용 키보드');

    expect(result.softIntentTags).toContain('조용함');
    expect(result.softIntentTags).toContain('사무용');
    expect(result.softIntentTags).not.toContain('알수없는태그');
    expect(result.softIntentTags).not.toContain('완전히없는것');
  });

  // -------------------------------------------------------------------
  // 7. 허용되지 않는 열거형 값은 폐기된다
  // -------------------------------------------------------------------
  it('hardConstraints - 허용되지 않는 열거형 값은 폐기되어야 한다', async () => {
    const mockResponse = JSON.stringify({
      hardConstraints: {
        connection: '위성통신',   // 허용되지 않는 값
        layout: '텐키리스',        // 유효
      },
      softIntentTags: [],
    });
    _setClientForTest(makeMockClient(mockResponse));

    const result = await extractRawTags('텐키리스 키보드');

    expect(result.hardConstraints).not.toHaveProperty('connection');
    expect(result.hardConstraints.layout).toBe('텐키리스');
  });

  // -------------------------------------------------------------------
  // 8. 숫자 키에 문자열 값이 오면 폐기된다
  // -------------------------------------------------------------------
  it('hardConstraints - 숫자 키에 문자열 값이 오면 폐기되어야 한다', async () => {
    const mockResponse = JSON.stringify({
      hardConstraints: {
        price_max: '200000',   // 타입 오류: 문자열
        price_min: 50000,      // 유효
      },
      softIntentTags: [],
    });
    _setClientForTest(makeMockClient(mockResponse));

    const result = await extractRawTags('5-20만원 키보드');

    expect(result.hardConstraints).not.toHaveProperty('price_max');
    expect(result.hardConstraints.price_min).toBe(50000);
  });

  // -------------------------------------------------------------------
  // 9. 비정상 JSON 응답도 안전하게 처리된다
  // -------------------------------------------------------------------
  it('LLM이 비정상 JSON을 반환하면 빈 태그 구조를 반환해야 한다', async () => {
    _setClientForTest(makeMockClient('이것은 JSON이 아닙니다'));

    const result = await extractRawTags('키보드 추천해줘');

    expect(result).toHaveProperty('hardConstraints');
    expect(result).toHaveProperty('softIntentTags');
    expect(result.hardConstraints).toEqual({});
    expect(result.softIntentTags).toEqual([]);
  });

  // -------------------------------------------------------------------
  // 10. 빈 hardConstraints/softIntentTags도 올바르게 처리된다
  // -------------------------------------------------------------------
  it('LLM이 빈 제약/태그를 반환하면 빈 구조를 올바르게 반환해야 한다', async () => {
    const mockResponse = JSON.stringify({
      hardConstraints: {},
      softIntentTags: [],
    });
    _setClientForTest(makeMockClient(mockResponse));

    const result = await extractRawTags('키보드 추천해줘');

    expect(result.hardConstraints).toEqual({});
    expect(result.softIntentTags).toEqual([]);
  });

  // -------------------------------------------------------------------
  // 11. content 배열에 text 블록이 없으면 빈 태그 구조 반환
  // -------------------------------------------------------------------
  it('LLM 응답에 text 블록이 없으면 빈 태그 구조를 반환해야 한다', async () => {
    const clientWithNoText: AnthropicClient = {
      messages: {
        create: async () => ({
          id: 'mock-id',
          type: 'message',
          role: 'assistant',
          model: 'claude-haiku-4-5',
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: { input_tokens: 0, output_tokens: 0 },
          content: [],   // 빈 content
        }),
      } as unknown as AnthropicClient['messages'],
    };
    _setClientForTest(clientWithNoText);

    const result = await extractRawTags('키보드');

    expect(result).toHaveProperty('hardConstraints');
    expect(result).toHaveProperty('softIntentTags');
  });
});

// ---------------------------------------------------------------------------
// parseAndSanitize 단위 테스트 (내부 유틸)
// ---------------------------------------------------------------------------

describe('parseAndSanitize()', () => {
  it('유효한 JSON을 올바르게 파싱한다', () => {
    const text = JSON.stringify({
      hardConstraints: { price_max: 100000, layout: '풀배열' },
      softIntentTags: ['게이밍', 'RGB'],
    });
    const result = parseAndSanitize(text);
    expect(result.hardConstraints.price_max).toBe(100000);
    expect(result.hardConstraints.layout).toBe('풀배열');
    expect(result.softIntentTags).toContain('게이밍');
    expect(result.softIntentTags).toContain('RGB');
  });

  it('JSON 파싱 실패 시 빈 구조를 반환한다', () => {
    const result = parseAndSanitize('{ 잘못된 JSON }');
    expect(result.hardConstraints).toEqual({});
    expect(result.softIntentTags).toEqual([]);
  });

  it('hardConstraints가 없으면 빈 객체를 반환한다', () => {
    const text = JSON.stringify({ softIntentTags: ['조용함'] });
    const result = parseAndSanitize(text);
    expect(result.hardConstraints).toEqual({});
    expect(result.softIntentTags).toContain('조용함');
  });

  it('softIntentTags가 없으면 빈 배열을 반환한다', () => {
    const text = JSON.stringify({ hardConstraints: { connection: '유선' } });
    const result = parseAndSanitize(text);
    expect(result.softIntentTags).toEqual([]);
    expect(result.hardConstraints.connection).toBe('유선');
  });

  it('weight_max_g 숫자 제약을 올바르게 파싱한다', () => {
    const text = JSON.stringify({
      hardConstraints: { weight_max_g: 800 },
      softIntentTags: ['가벼움'],
    });
    const result = parseAndSanitize(text);
    expect(result.hardConstraints.weight_max_g).toBe(800);
    expect(result.softIntentTags).toContain('가벼움');
  });

  it('switch_type 열거형을 올바르게 파싱한다', () => {
    const text = JSON.stringify({
      hardConstraints: { switch_type: '무접점 자석축' },
      softIntentTags: ['무접점'],
    });
    const result = parseAndSanitize(text);
    expect(result.hardConstraints.switch_type).toBe('무접점 자석축');
  });
});
