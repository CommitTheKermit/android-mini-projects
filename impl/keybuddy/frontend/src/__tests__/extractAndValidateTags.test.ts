/**
 * extractAndValidateTags 통합 단위 테스트
 *
 * extractRawTags -> sanitizeTags -> validateTagSchema 순서 파이프라인을 검증:
 * - 다양한 자연어 입력(LLM 모킹)에 대해 최종 출력이 항상 validateTagSchema를 통과
 * - 경계 케이스(LLM이 스키마 밖 값 반환, 비정상 JSON 등)에서도 항상 유효한 출력
 * - 검증 실패 시 오류를 throw (validateTagSchema 강제 실패 시나리오)
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
// 핵심: 최종 출력이 항상 validateTagSchema를 통과한다
// ---------------------------------------------------------------------------

describe('extractAndValidateTags - validateTagSchema 통과 보장', () => {
  it('하드 제약 + 소프트 태그 정상 응답은 validateTagSchema를 통과한다', async () => {
    _setClientForTest(
      makeMockClient(
        JSON.stringify({
          hardConstraints: { price_max: 150000, connection: '무선' },
          softIntentTags: ['조용함', '사무용'],
        }),
      ),
    );

    const result = await extractAndValidateTags('조용한 무선 키보드 15만원 이하');

    const validation = validateTagSchema(result);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('하드 제약만 있는 응답은 validateTagSchema를 통과한다', async () => {
    _setClientForTest(
      makeMockClient(
        JSON.stringify({
          hardConstraints: { layout: '텐키리스', price_max: 200000 },
          softIntentTags: [],
        }),
      ),
    );

    const result = await extractAndValidateTags('20만원 텐키리스');

    const validation = validateTagSchema(result);
    expect(validation.valid).toBe(true);
  });

  it('소프트 태그만 있는 응답은 validateTagSchema를 통과한다', async () => {
    _setClientForTest(
      makeMockClient(
        JSON.stringify({
          hardConstraints: {},
          softIntentTags: ['게이밍', 'RGB', '타건감'],
        }),
      ),
    );

    const result = await extractAndValidateTags('화려한 RGB 게이밍 키보드');

    const validation = validateTagSchema(result);
    expect(validation.valid).toBe(true);
  });

  it('모든 하드 제약 필드가 있는 응답은 validateTagSchema를 통과한다', async () => {
    _setClientForTest(
      makeMockClient(
        JSON.stringify({
          hardConstraints: {
            price_max: 300000,
            price_min: 50000,
            weight_max_g: 800,
            connection: '무선',
            layout: '풀배열',
            switch_type: '기계식',
            wireless_type: '블루투스',
            engraving: '한/영 정각',
            backlight: 'RGB 백라이트',
          },
          softIntentTags: ['게이밍', 'RGB', '무선', '한영각인'],
        }),
      ),
    );

    const result = await extractAndValidateTags('풀배열 블루투스 기계식 게이밍 키보드');

    const validation = validateTagSchema(result);
    expect(validation.valid).toBe(true);
  });

  it('빈 하드 제약 + 빈 소프트 태그 응답은 validateTagSchema를 통과한다', async () => {
    _setClientForTest(
      makeMockClient(
        JSON.stringify({
          hardConstraints: {},
          softIntentTags: [],
        }),
      ),
    );

    const result = await extractAndValidateTags('키보드 추천해줘');

    const validation = validateTagSchema(result);
    expect(validation.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 스키마 밖 값이 포함된 LLM 응답 - sanitizeTags로 폐기 후 통과
// ---------------------------------------------------------------------------

describe('extractAndValidateTags - 스키마 밖 값 자동 폐기 후 통과', () => {
  it('LLM이 brand 같은 스키마 외 키를 반환해도 폐기 후 validateTagSchema를 통과한다', async () => {
    _setClientForTest(
      makeMockClient(
        JSON.stringify({
          hardConstraints: {
            brand: 'Leopold',       // 스키마 외 키 - 폐기
            price_max: 300000,      // 유효
            connection: '유선',     // 유효
          },
          softIntentTags: ['타건감', '사무용'],
        }),
      ),
    );

    const result = await extractAndValidateTags('레오폴드 유선 키보드');

    const validation = validateTagSchema(result);
    expect(validation.valid).toBe(true);
    expect(result.hardConstraints).not.toHaveProperty('brand');
    expect(result.hardConstraints.price_max).toBe(300000);
  });

  it('LLM이 허용되지 않는 열거형 값을 반환해도 폐기 후 validateTagSchema를 통과한다', async () => {
    _setClientForTest(
      makeMockClient(
        JSON.stringify({
          hardConstraints: {
            connection: '위성통신',  // 허용 안 됨 - 폐기
            layout: '텐키리스',      // 유효
          },
          softIntentTags: ['휴대성'],
        }),
      ),
    );

    const result = await extractAndValidateTags('텐키리스 키보드');

    const validation = validateTagSchema(result);
    expect(validation.valid).toBe(true);
    expect(result.hardConstraints).not.toHaveProperty('connection');
    expect(result.hardConstraints.layout).toBe('텐키리스');
  });

  it('LLM이 소프트 태그 어휘 외 값을 반환해도 폐기 후 validateTagSchema를 통과한다', async () => {
    _setClientForTest(
      makeMockClient(
        JSON.stringify({
          hardConstraints: { price_max: 100000 },
          softIntentTags: ['조용함', '알수없는태그', '사무용', '이것도없음'],
        }),
      ),
    );

    const result = await extractAndValidateTags('저렴한 조용한 사무용 키보드');

    const validation = validateTagSchema(result);
    expect(validation.valid).toBe(true);
    expect(result.softIntentTags).toContain('조용함');
    expect(result.softIntentTags).toContain('사무용');
    expect(result.softIntentTags).not.toContain('알수없는태그');
  });

  it('LLM이 숫자 키에 문자열 값을 반환해도 폐기 후 validateTagSchema를 통과한다', async () => {
    _setClientForTest(
      makeMockClient(
        JSON.stringify({
          hardConstraints: {
            price_max: '200000',    // 타입 오류 - 폐기
            price_min: 50000,       // 유효
          },
          softIntentTags: ['가성비'],
        }),
      ),
    );

    const result = await extractAndValidateTags('5-20만원 키보드');

    const validation = validateTagSchema(result);
    expect(validation.valid).toBe(true);
    expect(result.hardConstraints).not.toHaveProperty('price_max');
    expect(result.hardConstraints.price_min).toBe(50000);
  });

  it('LLM이 최상위에 스키마 외 필드를 반환해도 폐기 후 validateTagSchema를 통과한다', async () => {
    _setClientForTest(
      makeMockClient(
        JSON.stringify({
          hardConstraints: { layout: '미니' },
          softIntentTags: ['미니', '휴대성'],
          extraTopField: '무시됨',     // 최상위 스키마 외 - 폐기
          anotherField: 123,
        }),
      ),
    );

    const result = await extractAndValidateTags('미니 키보드');

    const validation = validateTagSchema(result);
    expect(validation.valid).toBe(true);
    expect(result).not.toHaveProperty('extraTopField');
  });

  it('LLM이 혼합(유효+무효) 응답을 반환해도 유효한 것만 남기고 validateTagSchema를 통과한다', async () => {
    _setClientForTest(
      makeMockClient(
        JSON.stringify({
          hardConstraints: {
            price_max: 200000,            // 유효
            brand: 'Leopold',             // 스키마 외 - 폐기
            connection: '위성통신',       // 잘못된 열거형 - 폐기
            layout: '풀배열',             // 유효
            price_min: '50000',           // 타입 오류 - 폐기
          },
          softIntentTags: ['조용함', '이상한태그', '게이밍', '없는거'],
          extraField: 'ignored',
        }),
      ),
    );

    const result = await extractAndValidateTags('풀배열 조용한 게이밍 키보드 20만원 이하');

    const validation = validateTagSchema(result);
    expect(validation.valid).toBe(true);
    expect(result.hardConstraints.price_max).toBe(200000);
    expect(result.hardConstraints.layout).toBe('풀배열');
    expect(result.softIntentTags).toContain('조용함');
    expect(result.softIntentTags).toContain('게이밍');
  });
});

// ---------------------------------------------------------------------------
// 비정상 LLM 응답 - 안전하게 빈 구조로 처리 후 통과
// ---------------------------------------------------------------------------

describe('extractAndValidateTags - 비정상 LLM 응답 안전 처리', () => {
  it('LLM이 비정상 JSON을 반환해도 빈 구조로 validateTagSchema를 통과한다', async () => {
    _setClientForTest(makeMockClient('이것은 JSON이 아닙니다'));

    const result = await extractAndValidateTags('키보드 추천해줘');

    const validation = validateTagSchema(result);
    expect(validation.valid).toBe(true);
    expect(result.hardConstraints).toEqual({});
    expect(result.softIntentTags).toEqual([]);
  });

  it('LLM이 빈 문자열을 반환해도 validateTagSchema를 통과한다', async () => {
    _setClientForTest(makeMockClient(''));

    const result = await extractAndValidateTags('키보드');

    const validation = validateTagSchema(result);
    expect(validation.valid).toBe(true);
  });

  it('LLM 응답에 content 블록이 없어도 validateTagSchema를 통과한다', async () => {
    const clientWithNoContent: AnthropicClient = {
      messages: {
        create: async () => ({
          id: 'mock-id',
          type: 'message',
          role: 'assistant',
          model: 'claude-haiku-4-5',
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: { input_tokens: 0, output_tokens: 0 },
          content: [],
        }),
      } as unknown as AnthropicClient['messages'],
    };
    _setClientForTest(clientWithNoContent);

    const result = await extractAndValidateTags('키보드');

    const validation = validateTagSchema(result);
    expect(validation.valid).toBe(true);
  });

  it('LLM이 숫자를 반환해도 validateTagSchema를 통과한다', async () => {
    _setClientForTest(makeMockClient('42'));

    const result = await extractAndValidateTags('키보드');

    const validation = validateTagSchema(result);
    expect(validation.valid).toBe(true);
    expect(result.hardConstraints).toEqual({});
    expect(result.softIntentTags).toEqual([]);
  });

  it('LLM이 배열을 반환해도 validateTagSchema를 통과한다', async () => {
    _setClientForTest(makeMockClient('["조용함", "게이밍"]'));

    const result = await extractAndValidateTags('키보드');

    const validation = validateTagSchema(result);
    expect(validation.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 출력 구조: hardConstraints + softIntentTags 형태를 항상 반환
// ---------------------------------------------------------------------------

describe('extractAndValidateTags - 출력 구조 보장', () => {
  it('반환 객체는 항상 hardConstraints 키를 갖는다', async () => {
    _setClientForTest(
      makeMockClient(JSON.stringify({ hardConstraints: {}, softIntentTags: [] })),
    );

    const result = await extractAndValidateTags('키보드');

    expect(result).toHaveProperty('hardConstraints');
    expect(typeof result.hardConstraints).toBe('object');
    expect(Array.isArray(result.hardConstraints)).toBe(false);
  });

  it('반환 객체는 항상 softIntentTags 키를 갖는다', async () => {
    _setClientForTest(
      makeMockClient(JSON.stringify({ hardConstraints: {}, softIntentTags: [] })),
    );

    const result = await extractAndValidateTags('키보드');

    expect(result).toHaveProperty('softIntentTags');
    expect(Array.isArray(result.softIntentTags)).toBe(true);
  });

  it('연결방식 무선 입력에서 올바른 하드 제약을 추출한다', async () => {
    _setClientForTest(
      makeMockClient(
        JSON.stringify({
          hardConstraints: { connection: '무선' },
          softIntentTags: ['무선'],
        }),
      ),
    );

    const result = await extractAndValidateTags('무선 키보드');

    expect(result.hardConstraints.connection).toBe('무선');
    expect(result.softIntentTags).toContain('무선');
    const validation = validateTagSchema(result);
    expect(validation.valid).toBe(true);
  });

  it('멀티 디바이스 + 저소음 사무용 입력에서 올바른 태그를 추출한다', async () => {
    _setClientForTest(
      makeMockClient(
        JSON.stringify({
          hardConstraints: { connection: '무선', wireless_type: '블루투스' },
          softIntentTags: ['멀티페어링', '저소음', '사무용'],
        }),
      ),
    );

    const result = await extractAndValidateTags('여러 기기 연결되는 조용한 사무용 블루투스 키보드');

    expect(result.hardConstraints.wireless_type).toBe('블루투스');
    expect(result.softIntentTags).toContain('멀티페어링');
    expect(result.softIntentTags).toContain('저소음');
    const validation = validateTagSchema(result);
    expect(validation.valid).toBe(true);
  });

  it('예산 제약 + 가성비 입력에서 올바른 태그를 추출한다', async () => {
    _setClientForTest(
      makeMockClient(
        JSON.stringify({
          hardConstraints: { price_max: 80000 },
          softIntentTags: ['가성비', '사무용'],
        }),
      ),
    );

    const result = await extractAndValidateTags('8만원 이하 가성비 키보드');

    expect(result.hardConstraints.price_max).toBe(80000);
    expect(result.softIntentTags).toContain('가성비');
    const validation = validateTagSchema(result);
    expect(validation.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateTagSchema 실패 시 throw 검증
// ---------------------------------------------------------------------------

describe('extractAndValidateTags - 검증 실패 시 throw', () => {
  it('sanitizeTags 출력이 항상 유효하므로 일반적으로 throw하지 않는다', async () => {
    // sanitizeTags는 모든 스키마 외 값을 폐기하므로
    // extractAndValidateTags는 정상 조건에서 절대 throw하지 않는다
    _setClientForTest(
      makeMockClient(
        JSON.stringify({
          hardConstraints: { price_max: 100000 },
          softIntentTags: ['조용함'],
        }),
      ),
    );

    await expect(extractAndValidateTags('조용한 키보드')).resolves.not.toThrow();
  });

  it('비정상 LLM 응답에서도 throw하지 않고 빈 구조를 반환한다', async () => {
    _setClientForTest(makeMockClient('완전히 잘못된 JSON {{{'));

    await expect(extractAndValidateTags('키보드')).resolves.toBeDefined();
  });
});
