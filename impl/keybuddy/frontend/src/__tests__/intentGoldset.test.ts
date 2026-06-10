/**
 * AC8 - 의도 골드셋 (intent goldset)
 *
 * "대표 자연어 쿼리 5-10개에서 각 쿼리의 기대 태그가 추출되고,
 *  기대 속성을 가진 키보드가 상위 N(=5)에 포함된다"를 검증한다.
 *
 * 두 단계로 나눠 결정론적으로 검증한다:
 *   A. 태그 추출 골드셋 (LLM 모킹): 각 자연어 쿼리 -> 기대 ExtractedTags
 *   B. 검색 결과 골드셋 (실제 카탈로그): 기대 태그 -> 상위 5 결과가
 *      - 하드 제약을 모두 충족하고
 *      - 쿼리 소프트 의도와 최소 1개 일치하며 (1위 결과 기준)
 *      - 무결과 케이스는 완화(fallback) 경로로 결과를 제시한다
 *
 * 검색 경로는 LLM 호출 없이 결정론적으로 동작하므로 실제 카탈로그로 안정적으로 검증된다.
 */

import { describe, it, expect, afterEach } from 'vitest';
import rawCatalog from '../data/keyboards.json';
import type { Keyboard } from '../types';
import { searchKeyboards } from '../lib/searchEngine';
import {
  extractAndValidateTags,
  _setClientForTest,
  type ExtractedTags,
  type AnthropicClient,
} from '../lib/extractRawTags';
import type { SoftIntentTag } from '../lib/tagSchema';

const catalog = rawCatalog as Keyboard[];
const TOP_N = 5;

/** 응답 텍스트를 그대로 돌려주는 모킹 Anthropic 클라이언트 */
function mockClient(jsonText: string): AnthropicClient {
  return {
    messages: {
      create: async () => ({ content: [{ type: 'text', text: jsonText }] }),
    },
  } as unknown as AnthropicClient;
}

interface GoldsetCase {
  name: string;
  /** 대표 자연어 쿼리 (문서용 - 모킹 추출의 입력) */
  query: string;
  /** 이 쿼리에서 기대하는 추출 태그 */
  expectedTags: ExtractedTags;
  /** 상위 N개 결과가 모두 만족해야 하는 하드 제약 술어 */
  hardChecks: Array<(kb: Keyboard) => boolean>;
  /** 1위 결과가 일치해야 하는 소프트 의도 (이 중 최소 1개) */
  expectSoftOneOf: SoftIntentTag[];
  /** 무결과 -> 완화 경로를 기대하는 케이스인지 */
  expectFallback?: { relaxedKey: string };
}

const GOLDSET: GoldsetCase[] = [
  {
    name: '조용한 사무용 (예산 15만원)',
    query: '조용한 사무실에서 쓸 무접점 키보드 추천해줘, 15만원 이하로',
    expectedTags: {
      hardConstraints: { price_max: 150000 },
      softIntentTags: ['조용함', '저소음', '사무용'],
    },
    hardChecks: [(kb) => kb.price <= 150000],
    expectSoftOneOf: ['조용함', '저소음', '사무용'],
  },
  {
    name: '게이밍 텐키리스 RGB',
    query: '게임용으로 반응 빠르고 RGB 화려한 텐키리스 키보드',
    expectedTags: {
      hardConstraints: { layout: '텐키리스' },
      softIntentTags: ['게이밍', 'RGB', '텐키리스'],
    },
    hardChecks: [(kb) => kb.layout === '텐키리스'],
    expectSoftOneOf: ['게이밍', 'RGB', '텐키리스'],
  },
  {
    name: '무선 휴대용 가벼움',
    query: '들고 다닐 가벼운 무선 키보드 필요해',
    expectedTags: {
      hardConstraints: { connection: '무선' },
      softIntentTags: ['무선', '휴대성', '가벼움'],
    },
    // 연결 호환 매칭: '무선' 요구는 '무선'/'유선+무선'이 충족
    hardChecks: [(kb) => kb.connection === '무선' || kb.connection === '유선+무선'],
    expectSoftOneOf: ['무선', '휴대성'],
  },
  {
    name: '가성비 (5만원 이하)',
    query: '5만원 이하 가성비 좋은 키보드',
    expectedTags: {
      hardConstraints: { price_max: 50000 },
      softIntentTags: ['가성비'],
    },
    hardChecks: [(kb) => kb.price <= 50000],
    expectSoftOneOf: ['가성비'],
  },
  {
    name: '풀배열 유선 사무용 (8만원 이하)',
    query: '사무용 풀배열 유선 키보드 8만원 이하',
    expectedTags: {
      hardConstraints: { layout: '풀배열', connection: '유선', price_max: 80000 },
      softIntentTags: ['사무용', '풀배열'],
    },
    hardChecks: [
      (kb) => kb.layout === '풀배열',
      // 연결 호환 매칭: '유선' 요구는 '유선'/'유선+무선'이 충족
      (kb) => kb.connection === '유선' || kb.connection === '유선+무선',
      (kb) => kb.price <= 80000,
    ],
    expectSoftOneOf: ['사무용', '풀배열'],
  },
  {
    name: '비현실적 예산 -> 완화 폴백',
    query: '5천원 이하 키보드 추천해줘',
    expectedTags: {
      hardConstraints: { price_max: 5000 },
      softIntentTags: ['가성비'],
    },
    hardChecks: [],
    expectSoftOneOf: [],
    expectFallback: { relaxedKey: 'price_max' },
  },
];

describe('AC8 의도 골드셋 - A. 태그 추출 (LLM 모킹)', () => {
  afterEach(() => {
    _setClientForTest(null);
  });

  for (const c of GOLDSET) {
    it(`"${c.name}" 쿼리에서 기대 태그가 추출된다`, async () => {
      _setClientForTest(mockClient(JSON.stringify(c.expectedTags)));
      const extracted = await extractAndValidateTags(c.query);
      expect(extracted).toEqual(c.expectedTags);
    });
  }
});

describe('AC8 의도 골드셋 - B. 검색 결과 (실제 카탈로그)', () => {
  for (const c of GOLDSET) {
    it(`"${c.name}" 결과가 의도/제약에 맞는다`, () => {
      const output = searchKeyboards(c.expectedTags, catalog);

      // 어떤 경우든 결과는 비어 있지 않다 (완화 폴백 포함)
      expect(output.results.length).toBeGreaterThan(0);

      if (c.expectFallback) {
        // 무결과 -> 완화 경로로 결과를 제시한다
        expect(output.isFallback).toBe(true);
        expect(output.relaxationStepCount).toBeGreaterThan(0);
        expect(output.relaxedConstraints).toContain(c.expectFallback.relaxedKey);
        return;
      }

      // 정상 경로: 완화 없이 결과를 낸다
      expect(output.isFallback).toBe(false);

      const topN = output.results.slice(0, TOP_N);

      // 상위 N개는 모든 하드 제약을 충족한다 (하드 제약 위반 0건)
      for (const item of topN) {
        for (const check of c.hardChecks) {
          expect(check(item.keyboard)).toBe(true);
        }
      }

      // 1위 결과는 쿼리 소프트 의도와 최소 1개 일치한다 (의도 정렬)
      if (c.expectSoftOneOf.length > 0) {
        const top = output.results[0];
        const overlap = top.matchedTags.filter((t) =>
          (c.expectSoftOneOf as string[]).includes(t),
        );
        expect(overlap.length).toBeGreaterThan(0);
      }

      // 점수 내림차순 정렬 (상위가 하위보다 점수가 높거나 같다)
      for (let i = 1; i < output.results.length; i++) {
        expect(output.results[i - 1].score).toBeGreaterThanOrEqual(output.results[i].score);
      }
    });
  }
});
