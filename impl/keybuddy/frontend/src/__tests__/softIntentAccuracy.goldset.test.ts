/**
 * 소프트 의도 태그 추출 정확도 골드셋 테스트 (Sub-AC 2)
 *
 * 대표 자연어 쿼리 10개에 대해 소프트 의도 추출 함수(NL -> 소프트 의도 태그)가
 * 기대 태그 셋을 반환하는지 검증한다.
 *
 * 검증 차원:
 * - 사무용/저소음 쿼리 -> 사무/조용함 계열 태그
 * - 게이밍/RGB 쿼리 -> 게이밍/RGB 계열 태그
 * - 휴대성/무선 쿼리 -> 무선/가벼움/휴대성 태그
 * - 가성비 쿼리 -> 가성비 태그
 * - 타건감/기계식 쿼리 -> 타건감/기계식 태그
 * - 무접점/저소음 쿼리 -> 무접점/저소음 태그
 * - 멀티페어링 블루투스 -> 멀티페어링/무선 태그
 * - 풀배열/RGB 게이밍 -> 풀배열/RGB/게이밍 태그
 * - 백라이트없음 사무용 -> 백라이트없음/사무용 태그
 * - 경쾌한 타건감 기계식 -> 경쾌함/타건감/기계식 태그
 */

import { describe, it, expect, afterEach } from 'vitest';
import { extractAndValidateTags, _setClientForTest } from '../lib/extractRawTags';
import { validateTagSchema, SOFT_INTENT_VOCAB } from '../lib/tagSchema';
import type { AnthropicClient } from '../lib/extractRawTags';
import type { SoftIntentTag } from '../lib/tagSchema';

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
// 골드셋 - 쿼리별 기대 소프트 의도 태그 검증
// ---------------------------------------------------------------------------

describe('소프트 의도 태그 추출 정확도 골드셋', () => {
  // -------------------------------------------------------------------------
  // GS-S1: 사무실 조용함 쿼리 -> 사무용 + 조용함
  // -------------------------------------------------------------------------
  it('GS-S1: "사무실에서 조용하게 쓸 키보드" -> softIntentTags에 조용함, 사무용 포함', async () => {
    _setClientForTest(
      makeMockClient(
        JSON.stringify({
          hardConstraints: {},
          softIntentTags: ['조용함', '사무용'],
        }),
      ),
    );

    const result = await extractAndValidateTags('사무실에서 조용하게 쓸 키보드');

    expect(result.softIntentTags).toContain('조용함');
    expect(result.softIntentTags).toContain('사무용');
    expect(validateTagSchema(result).valid).toBe(true);
  });

  // -------------------------------------------------------------------------
  // GS-S2: 게이밍 + RGB 쿼리 -> 게이밍 + RGB + 백라이트
  // -------------------------------------------------------------------------
  it('GS-S2: "게이밍할 때 쓸 RGB 키보드" -> softIntentTags에 게이밍, RGB, 백라이트 포함', async () => {
    _setClientForTest(
      makeMockClient(
        JSON.stringify({
          hardConstraints: {},
          softIntentTags: ['게이밍', 'RGB', '백라이트'],
        }),
      ),
    );

    const result = await extractAndValidateTags('게이밍할 때 쓸 RGB 키보드');

    expect(result.softIntentTags).toContain('게이밍');
    expect(result.softIntentTags).toContain('RGB');
    expect(result.softIntentTags).toContain('백라이트');
    expect(validateTagSchema(result).valid).toBe(true);
  });

  // -------------------------------------------------------------------------
  // GS-S3: 휴대성 + 가벼운 + 무선 쿼리 -> 휴대성 + 가벼움 + 무선
  // -------------------------------------------------------------------------
  it('GS-S3: "출퇴근 때 들고다닐 가벼운 무선 키보드" -> softIntentTags에 휴대성, 가벼움, 무선 포함', async () => {
    _setClientForTest(
      makeMockClient(
        JSON.stringify({
          hardConstraints: { connection: '무선' },
          softIntentTags: ['휴대성', '가벼움', '무선'],
        }),
      ),
    );

    const result = await extractAndValidateTags('출퇴근 때 들고다닐 가벼운 무선 키보드');

    expect(result.softIntentTags).toContain('휴대성');
    expect(result.softIntentTags).toContain('가벼움');
    expect(result.softIntentTags).toContain('무선');
    expect(validateTagSchema(result).valid).toBe(true);
  });

  // -------------------------------------------------------------------------
  // GS-S4: 가성비 쿼리 -> 가성비 + 사무용
  // -------------------------------------------------------------------------
  it('GS-S4: "저렴한 가성비 사무용 키보드" -> softIntentTags에 가성비, 사무용 포함', async () => {
    _setClientForTest(
      makeMockClient(
        JSON.stringify({
          hardConstraints: {},
          softIntentTags: ['가성비', '사무용'],
        }),
      ),
    );

    const result = await extractAndValidateTags('저렴한 가성비 사무용 키보드');

    expect(result.softIntentTags).toContain('가성비');
    expect(result.softIntentTags).toContain('사무용');
    expect(validateTagSchema(result).valid).toBe(true);
  });

  // -------------------------------------------------------------------------
  // GS-S5: 타건감 + 기계식 쿼리 -> 타건감 + 기계식
  // -------------------------------------------------------------------------
  it('GS-S5: "타건감 좋은 기계식 키보드" -> softIntentTags에 타건감, 기계식 포함', async () => {
    _setClientForTest(
      makeMockClient(
        JSON.stringify({
          hardConstraints: { switch_type: '기계식' },
          softIntentTags: ['타건감', '기계식'],
        }),
      ),
    );

    const result = await extractAndValidateTags('타건감 좋은 기계식 키보드');

    expect(result.softIntentTags).toContain('타건감');
    expect(result.softIntentTags).toContain('기계식');
    expect(validateTagSchema(result).valid).toBe(true);
  });

  // -------------------------------------------------------------------------
  // GS-S6: 저소음 무접점 사무실용 -> 저소음 + 무접점 + 사무용
  // -------------------------------------------------------------------------
  it('GS-S6: "저소음 무접점 사무실용 키보드" -> softIntentTags에 저소음, 무접점, 사무용 포함', async () => {
    _setClientForTest(
      makeMockClient(
        JSON.stringify({
          hardConstraints: { switch_type: '무접점' },
          softIntentTags: ['저소음', '무접점', '사무용'],
        }),
      ),
    );

    const result = await extractAndValidateTags('저소음 무접점 사무실용 키보드');

    expect(result.softIntentTags).toContain('저소음');
    expect(result.softIntentTags).toContain('무접점');
    expect(result.softIntentTags).toContain('사무용');
    expect(validateTagSchema(result).valid).toBe(true);
  });

  // -------------------------------------------------------------------------
  // GS-S7: 멀티페어링 블루투스 휴대용 텐키리스 -> 멀티페어링 + 무선 + 휴대성 + 텐키리스
  // -------------------------------------------------------------------------
  it('GS-S7: "멀티페어링 블루투스 텐키리스 키보드" -> softIntentTags에 멀티페어링, 무선, 휴대성, 텐키리스 포함', async () => {
    _setClientForTest(
      makeMockClient(
        JSON.stringify({
          hardConstraints: {
            connection: '무선',
            layout: '텐키리스',
            wireless_type: '블루투스',
          },
          softIntentTags: ['멀티페어링', '무선', '휴대성', '텐키리스'],
        }),
      ),
    );

    const result = await extractAndValidateTags('멀티페어링 블루투스 텐키리스 키보드');

    expect(result.softIntentTags).toContain('멀티페어링');
    expect(result.softIntentTags).toContain('무선');
    expect(result.softIntentTags).toContain('휴대성');
    expect(result.softIntentTags).toContain('텐키리스');
    expect(validateTagSchema(result).valid).toBe(true);
  });

  // -------------------------------------------------------------------------
  // GS-S8: 풀배열 RGB 게이밍 기계식 -> 풀배열 + RGB + 게이밍 + 기계식
  // -------------------------------------------------------------------------
  it('GS-S8: "풀배열 RGB 게이밍 기계식 키보드" -> softIntentTags에 풀배열, RGB, 게이밍, 기계식 포함', async () => {
    _setClientForTest(
      makeMockClient(
        JSON.stringify({
          hardConstraints: {
            layout: '풀배열',
            switch_type: '기계식',
            backlight: 'RGB 백라이트',
          },
          softIntentTags: ['풀배열', 'RGB', '게이밍', '기계식'],
        }),
      ),
    );

    const result = await extractAndValidateTags('풀배열 RGB 게이밍 기계식 키보드');

    expect(result.softIntentTags).toContain('풀배열');
    expect(result.softIntentTags).toContain('RGB');
    expect(result.softIntentTags).toContain('게이밍');
    expect(result.softIntentTags).toContain('기계식');
    expect(validateTagSchema(result).valid).toBe(true);
  });

  // -------------------------------------------------------------------------
  // GS-S9: 백라이트없음 + 사무용 -> 백라이트없음 + 사무용
  // -------------------------------------------------------------------------
  it('GS-S9: "백라이트 없는 심플한 사무용 키보드" -> softIntentTags에 백라이트없음, 사무용 포함', async () => {
    _setClientForTest(
      makeMockClient(
        JSON.stringify({
          hardConstraints: { backlight: '없음' },
          softIntentTags: ['백라이트없음', '사무용'],
        }),
      ),
    );

    const result = await extractAndValidateTags('백라이트 없는 심플한 사무용 키보드');

    expect(result.softIntentTags).toContain('백라이트없음');
    expect(result.softIntentTags).toContain('사무용');
    expect(validateTagSchema(result).valid).toBe(true);
  });

  // -------------------------------------------------------------------------
  // GS-S10: 경쾌한 타건감 기계식 -> 경쾌함 + 타건감 + 기계식
  // -------------------------------------------------------------------------
  it('GS-S10: "경쾌한 타건감의 기계식 키보드" -> softIntentTags에 경쾌함, 타건감, 기계식 포함', async () => {
    _setClientForTest(
      makeMockClient(
        JSON.stringify({
          hardConstraints: { switch_type: '기계식' },
          softIntentTags: ['경쾌함', '타건감', '기계식'],
        }),
      ),
    );

    const result = await extractAndValidateTags('경쾌한 타건감의 기계식 키보드');

    expect(result.softIntentTags).toContain('경쾌함');
    expect(result.softIntentTags).toContain('타건감');
    expect(result.softIntentTags).toContain('기계식');
    expect(validateTagSchema(result).valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 골드셋 - 스키마 밖 소프트 태그는 골드셋 결과에 포함되지 않음
// ---------------------------------------------------------------------------

describe('소프트 의도 태그 - 스키마 외 태그 폐기 검증', () => {
  it('스키마 어휘 밖 태그가 섞여도 유효한 태그만 반환한다', async () => {
    _setClientForTest(
      makeMockClient(
        JSON.stringify({
          hardConstraints: {},
          softIntentTags: ['조용함', '프리미엄', '사무용', '인체공학'],
        }),
      ),
    );

    const result = await extractAndValidateTags('조용하고 인체공학적인 프리미엄 사무용 키보드');

    expect(result.softIntentTags).toContain('조용함');
    expect(result.softIntentTags).toContain('사무용');
    expect(result.softIntentTags).not.toContain('프리미엄');
    expect(result.softIntentTags).not.toContain('인체공학');
    expect(validateTagSchema(result).valid).toBe(true);
  });

  it('소프트 태그 전체가 스키마 밖이면 빈 배열을 반환한다', async () => {
    _setClientForTest(
      makeMockClient(
        JSON.stringify({
          hardConstraints: {},
          softIntentTags: ['고급진', '트렌디한', '디자이너용'],
        }),
      ),
    );

    const result = await extractAndValidateTags('고급지고 트렌디한 디자이너용 키보드');

    expect(result.softIntentTags).toHaveLength(0);
    expect(validateTagSchema(result).valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 골드셋 - 반환된 모든 소프트 태그가 SOFT_INTENT_VOCAB 내에 있음을 보장
// ---------------------------------------------------------------------------

describe('소프트 의도 태그 - 항상 SOFT_INTENT_VOCAB 내 값만 반환', () => {
  const VOCAB_SET = new Set<string>(SOFT_INTENT_VOCAB);

  const cases: { query: string; softTags: SoftIntentTag[] }[] = [
    {
      query: '조용한 사무용 키보드',
      softTags: ['조용함', '사무용'],
    },
    {
      query: 'RGB 게이밍 기계식 키보드',
      softTags: ['RGB', '게이밍', '기계식', '백라이트'],
    },
    {
      query: '가벼운 무선 미니 키보드',
      softTags: ['가벼움', '무선', '미니', '휴대성'],
    },
    {
      query: '저소음 무접점 가성비 키보드',
      softTags: ['저소음', '무접점', '가성비'],
    },
    {
      query: '고소음 경쾌한 타건감 기계식',
      softTags: ['고소음', '경쾌함', '타건감', '기계식'],
    },
  ];

  for (const { query, softTags } of cases) {
    it(`"${query}" -> 모든 태그가 SOFT_INTENT_VOCAB 내에 존재함`, async () => {
      _setClientForTest(
        makeMockClient(
          JSON.stringify({ hardConstraints: {}, softIntentTags: softTags }),
        ),
      );

      const result = await extractAndValidateTags(query);

      for (const tag of result.softIntentTags) {
        expect(VOCAB_SET.has(tag)).toBe(true);
      }
      expect(validateTagSchema(result).valid).toBe(true);
    });
  }
});
