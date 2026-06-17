/**
 * Sub-AC 7.3.3: 결과 조합 모듈 - LLM 호출 횟수 0 검증
 *
 * LLM 클라이언트를 vi.fn() spy로 교체한 뒤
 * 결과 조합 및 매칭 근거 생성 함수(buildReason, toRecommendations, buildSummary)만
 * 단독 실행하고 LLM 호출 횟수가 0임을 단위 테스트로 확인한다.
 *
 * - _setClientForTest: 테스트용 mock 클라이언트 주입
 * - vi.fn(): 호출 횟수 추적 spy
 * - 결과 조합/매칭 근거 생성 경로에 LLM이 개입하지 않음을 증명
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildReason, toRecommendations, buildSummary } from '../lib/searchResultComposition';
import { _setClientForTest } from '../lib/extractRawTags';
import type { AnthropicClient } from '../lib/extractRawTags';
import type { Keyboard } from '../types';
import type { SearchResultItem, SearchOutput } from '../lib/searchEngine';
import type { SoftIntentTag } from '../lib/tagSchema';

// ---------------------------------------------------------------------------
// LLM spy 헬퍼
// ---------------------------------------------------------------------------

function makeSpyClient(): { client: AnthropicClient; createSpy: ReturnType<typeof vi.fn> } {
  const createSpy = vi.fn();
  const client: AnthropicClient = {
    messages: {
      create: createSpy,
    } as unknown as AnthropicClient['messages'],
  };
  return { client, createSpy };
}

// ---------------------------------------------------------------------------
// 키보드/결과 픽스처 헬퍼
// ---------------------------------------------------------------------------

function makeKeyboard(overrides: Partial<Keyboard> = {}): Keyboard {
  return {
    product_name: '테스트 키보드',
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
    ...overrides,
  };
}

function makeSearchResultItem(overrides: Partial<SearchResultItem> = {}): SearchResultItem {
  return {
    keyboard: makeKeyboard(),
    keyboardIndex: 0,
    score: 0,
    matchedTags: [] as SoftIntentTag[],
    satisfiesHardConstraints: true,
    isFallback: false,
    relaxedConstraints: [],
    relaxationStepCount: 0,
    ...overrides,
  };
}

function makeSearchOutput(overrides: Partial<SearchOutput> = {}): SearchOutput {
  return {
    results: [makeSearchResultItem()],
    isFallback: false,
    relaxedConstraints: [],
    relaxationStepCount: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 테스트 스위트
// ---------------------------------------------------------------------------

describe('Sub-AC 7.3.3: 결과 조합 모듈 LLM 호출 횟수 === 0', () => {
  let createSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    const { client, createSpy: spy } = makeSpyClient();
    createSpy = spy;
    // LLM 클라이언트를 spy로 교체
    _setClientForTest(client);
  });

  afterEach(() => {
    // 테스트 격리: 다음 테스트에 영향 없도록 override 해제
    _setClientForTest(null);
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // 1. buildReason - LLM 호출 0회
  // -------------------------------------------------------------------------

  describe('buildReason 실행 후 LLM 호출 횟수 === 0', () => {
    it('매칭 태그 있는 일반 결과 근거 생성 - LLM 미호출', () => {
      const item = makeSearchResultItem({
        matchedTags: ['기계식', 'RGB'] as SoftIntentTag[],
        score: 2,
      });

      buildReason(item, false);

      expect(createSpy).toHaveBeenCalledTimes(0);
    });

    it('매칭 태그 없는 일반 결과 근거 생성 - LLM 미호출', () => {
      const item = makeSearchResultItem({
        matchedTags: [] as SoftIntentTag[],
        score: 0,
      });

      buildReason(item, false);

      expect(createSpy).toHaveBeenCalledTimes(0);
    });

    it('폴백 경로 + 매칭 태그 있는 근거 생성 - LLM 미호출', () => {
      const item = makeSearchResultItem({
        matchedTags: ['무선', '가벼움'] as SoftIntentTag[],
        score: 2,
        isFallback: true,
      });

      buildReason(item, true);

      expect(createSpy).toHaveBeenCalledTimes(0);
    });

    it('폴백 경로 + 매칭 태그 없는 근거 생성 - LLM 미호출', () => {
      const item = makeSearchResultItem({
        matchedTags: [] as SoftIntentTag[],
        score: 0,
        isFallback: true,
      });

      buildReason(item, true);

      expect(createSpy).toHaveBeenCalledTimes(0);
    });

    it('다수 매칭 태그(5개) 근거 생성 - LLM 미호출', () => {
      const item = makeSearchResultItem({
        matchedTags: ['게이밍', '기계식', 'RGB', '타건감', '경쾌함'] as SoftIntentTag[],
        score: 5,
      });

      buildReason(item, false);

      expect(createSpy).toHaveBeenCalledTimes(0);
    });

    it('buildReason 반환값이 string 타입임을 확인 - LLM 미호출', () => {
      const item = makeSearchResultItem({
        matchedTags: ['사무용', '무접점'] as SoftIntentTag[],
        score: 2,
      });

      const result = buildReason(item, false);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      expect(createSpy).toHaveBeenCalledTimes(0);
    });

    it('폴백 buildReason 반환값이 string 타입임을 확인 - LLM 미호출', () => {
      const item = makeSearchResultItem({
        matchedTags: ['무선'] as SoftIntentTag[],
        score: 1,
        isFallback: true,
      });

      const result = buildReason(item, true);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      expect(createSpy).toHaveBeenCalledTimes(0);
    });
  });

  // -------------------------------------------------------------------------
  // 2. buildSummary - LLM 호출 0회
  // -------------------------------------------------------------------------

  describe('buildSummary 실행 후 LLM 호출 횟수 === 0', () => {
    it('결과 있는 일반 요약 생성 - LLM 미호출', () => {
      const output = makeSearchOutput({
        results: [
          makeSearchResultItem({ score: 2, matchedTags: ['기계식', 'RGB'] as SoftIntentTag[] }),
          makeSearchResultItem({ keyboardIndex: 1, score: 1, matchedTags: ['게이밍'] as SoftIntentTag[] }),
        ],
        isFallback: false,
        relaxedConstraints: [],
      });

      buildSummary(output);

      expect(createSpy).toHaveBeenCalledTimes(0);
    });

    it('빈 결과 요약 생성 - LLM 미호출', () => {
      const output = makeSearchOutput({
        results: [],
        isFallback: true,
        relaxedConstraints: ['layout', 'price_max'],
        relaxationStepCount: 2,
      });

      buildSummary(output);

      expect(createSpy).toHaveBeenCalledTimes(0);
    });

    it('폴백 경로 요약 생성 - LLM 미호출', () => {
      const output = makeSearchOutput({
        results: [
          makeSearchResultItem({ score: 1, matchedTags: ['무선'] as SoftIntentTag[], isFallback: true }),
        ],
        isFallback: true,
        relaxedConstraints: ['price_max'],
        relaxationStepCount: 1,
      });

      buildSummary(output);

      expect(createSpy).toHaveBeenCalledTimes(0);
    });

    it('다중 완화 제약 폴백 요약 생성 - LLM 미호출', () => {
      const output = makeSearchOutput({
        results: [makeSearchResultItem({ isFallback: true })],
        isFallback: true,
        relaxedConstraints: ['switch_type', 'layout', 'price_max'],
        relaxationStepCount: 3,
      });

      buildSummary(output);

      expect(createSpy).toHaveBeenCalledTimes(0);
    });

    it('buildSummary 반환값이 string 타입임을 확인 - LLM 미호출', () => {
      const output = makeSearchOutput();

      const result = buildSummary(output);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      expect(createSpy).toHaveBeenCalledTimes(0);
    });

    it('MAX_RESULTS 초과 결과의 요약 생성(경계) - LLM 미호출', () => {
      const items = Array.from({ length: 35 }, (_, i) =>
        makeSearchResultItem({
          keyboard: makeKeyboard({ product_name: `요약 테스트 키보드 ${i}` }),
          keyboardIndex: i,
          score: 35 - i,
        }),
      );
      const output = makeSearchOutput({ results: items });

      buildSummary(output);

      expect(createSpy).toHaveBeenCalledTimes(0);
    });

    it('같은 상품명이 반복되면 요약 개수도 제품 단위로 계산한다 - LLM 미호출', () => {
      const output = makeSearchOutput({
        results: [
          makeSearchResultItem({
            keyboard: makeKeyboard({ product_name: '중복 상품', brand: 'A' }),
            keyboardIndex: 0,
          }),
          makeSearchResultItem({
            keyboard: makeKeyboard({ product_name: '중복 상품', brand: 'A', product_code: 'variant-2' }),
            keyboardIndex: 1,
          }),
        ],
      });

      const summary = buildSummary(output, 3);

      expect(summary).toContain('1개');
      expect(createSpy).toHaveBeenCalledTimes(0);
    });
  });

  // -------------------------------------------------------------------------
  // 3. toRecommendations - LLM 호출 0회
  // -------------------------------------------------------------------------

  describe('toRecommendations 실행 후 LLM 호출 횟수 === 0', () => {
    it('단일 결과 Recommendation 변환 - LLM 미호출', () => {
      const output = makeSearchOutput({
        results: [
          makeSearchResultItem({
            keyboard: makeKeyboard({ product_name: 'A키보드', switch_type: '기계식' }),
            score: 2,
            matchedTags: ['기계식', 'RGB'] as SoftIntentTag[],
          }),
        ],
      });

      const recs = toRecommendations(output);

      expect(recs[0].source).toBe('local');
      expect(recs[0].is_fallback).toBe(false);
      expect(createSpy).toHaveBeenCalledTimes(0);
    });

    it('다중 결과 Recommendation 변환 - LLM 미호출', () => {
      const output = makeSearchOutput({
        results: [
          makeSearchResultItem({
            keyboard: makeKeyboard({ product_name: 'A키보드' }),
            keyboardIndex: 0,
            score: 3,
            matchedTags: ['게이밍', '기계식', 'RGB'] as SoftIntentTag[],
          }),
          makeSearchResultItem({
            keyboard: makeKeyboard({ product_name: 'B키보드', switch_type: '무접점' }),
            keyboardIndex: 1,
            score: 1,
            matchedTags: ['사무용'] as SoftIntentTag[],
          }),
        ],
      });

      const recs = toRecommendations(output);

      expect(recs[0].source).toBe('local');
      expect(recs[0].is_fallback).toBe(false);
      expect(createSpy).toHaveBeenCalledTimes(0);
    });

    it('빈 results 변환 - LLM 미호출', () => {
      const output = makeSearchOutput({ results: [] });

      const recs = toRecommendations(output);

      expect(recs).toHaveLength(0);
      expect(createSpy).toHaveBeenCalledTimes(0);
    });

    it('폴백 결과 Recommendation 변환 - LLM 미호출', () => {
      const output = makeSearchOutput({
        results: [
          makeSearchResultItem({
            keyboard: makeKeyboard({ product_name: '폴백 키보드' }),
            score: 1,
            matchedTags: ['무선'] as SoftIntentTag[],
            isFallback: true,
            relaxedConstraints: ['price_max'],
            relaxationStepCount: 1,
          }),
        ],
        isFallback: true,
        relaxedConstraints: ['price_max'],
        relaxationStepCount: 1,
      });

      const recs = toRecommendations(output);

      expect(recs[0].source).toBe('fallback');
      expect(recs[0].is_fallback).toBe(true);
      expect(createSpy).toHaveBeenCalledTimes(0);
    });

    it('toRecommendations 반환 Recommendation에 reason 문자열 포함 - LLM 미호출', () => {
      const output = makeSearchOutput({
        results: [
          makeSearchResultItem({
            matchedTags: ['기계식'] as SoftIntentTag[],
            score: 1,
          }),
        ],
      });

      const recs = toRecommendations(output);

      expect(recs).toHaveLength(1);
      expect(typeof recs[0].reason).toBe('string');
      expect(recs[0].reason.length).toBeGreaterThan(0);
      expect(Array.isArray(recs[0].tags)).toBe(true);
      expect(createSpy).toHaveBeenCalledTimes(0);
    });

    it('MAX_RESULTS(30개) 초과 결과 슬라이스 변환 - LLM 미호출', () => {
      const items = Array.from({ length: 40 }, (_, i) =>
        makeSearchResultItem({
          keyboard: makeKeyboard({ product_name: `테스트 키보드 ${i}` }),
          keyboardIndex: i,
          score: 40 - i,
        }),
      );
      const output = makeSearchOutput({ results: items });

      const recs = toRecommendations(output);

      expect(recs).toHaveLength(30);
      expect(createSpy).toHaveBeenCalledTimes(0);
    });

    it('같은 상품명이 스위치 옵션별로 반복되어도 제품 단위로 1개만 반환한다 - LLM 미호출', () => {
      const output = makeSearchOutput({
        results: [
          makeSearchResultItem({
            keyboard: makeKeyboard({
              product_name: 'AULA F108 PRO 유무선 기계식 치즈 화이트 한글',
              brand: 'AULA',
              switch_name: 'Blue Whale 경해축',
              product_code: '94026473',
            }),
            keyboardIndex: 0,
            score: 10,
          }),
          makeSearchResultItem({
            keyboard: makeKeyboard({
              product_name: 'AULA F108 PRO 유무선 기계식 치즈 화이트 한글',
              brand: 'AULA',
              switch_name: '저소음 바다축',
              product_code: '94026476',
            }),
            keyboardIndex: 1,
            score: 9,
          }),
          makeSearchResultItem({
            keyboard: makeKeyboard({
              product_name: 'FL-ESPORTS NX108 유무선 기계식 크림 말차',
              brand: 'FL-ESPORTS',
            }),
            keyboardIndex: 2,
            score: 8,
          }),
        ],
      });

      const recs = toRecommendations(output, 3);

      expect(recs).toHaveLength(2);
      expect(recs.map((item) => item.product_name)).toEqual([
        'AULA F108 PRO 유무선 기계식 치즈 화이트 한글',
        'FL-ESPORTS NX108 유무선 기계식 크림 말차',
      ]);
      expect(createSpy).toHaveBeenCalledTimes(0);
    });
  });

  // -------------------------------------------------------------------------
  // 4. buildReason + buildSummary + toRecommendations 파이프라인 - LLM 호출 0회
  // -------------------------------------------------------------------------

  describe('결과 조합 전체 파이프라인 실행 후 LLM 호출 횟수 === 0', () => {
    it('게이밍 시나리오 전체 결과 조합 - LLM 미호출', () => {
      const output: SearchOutput = {
        results: [
          {
            keyboard: makeKeyboard({
              product_name: '게이밍 RGB 키보드',
              switch_type: '기계식',
              backlight: 'RGB 백라이트',
            }),
            keyboardIndex: 0,
            score: 3,
            matchedTags: ['게이밍', '기계식', 'RGB'] as SoftIntentTag[],
            satisfiesHardConstraints: true,
            isFallback: false,
            relaxedConstraints: [],
            relaxationStepCount: 0,
          },
          {
            keyboard: makeKeyboard({ product_name: '무접점 비교 키보드', switch_type: '무접점', backlight: '없음' }),
            keyboardIndex: 1,
            score: 0,
            matchedTags: [] as SoftIntentTag[],
            satisfiesHardConstraints: true,
            isFallback: false,
            relaxedConstraints: [],
            relaxationStepCount: 0,
          },
        ],
        isFallback: false,
        relaxedConstraints: [],
        relaxationStepCount: 0,
      };

      const summary = buildSummary(output);
      const recs = toRecommendations(output);
      const reason0 = buildReason(output.results[0], output.isFallback);
      const reason1 = buildReason(output.results[1], output.isFallback);

      // 결과 값 검증 (LLM 없이 생성됨)
      expect(typeof summary).toBe('string');
      expect(recs).toHaveLength(2);
      expect(typeof reason0).toBe('string');
      expect(typeof reason1).toBe('string');

      // LLM 호출 0회 핵심 검증
      expect(createSpy).toHaveBeenCalledTimes(0);
    });

    it('사무용 시나리오 폴백 결과 조합 - LLM 미호출', () => {
      const output: SearchOutput = {
        results: [
          {
            keyboard: makeKeyboard({ switch_type: '무접점', weight_g: 600 }),
            keyboardIndex: 0,
            score: 2,
            matchedTags: ['사무용', '무접점'] as SoftIntentTag[],
            satisfiesHardConstraints: false,
            isFallback: true,
            relaxedConstraints: ['price_max'],
            relaxationStepCount: 1,
          },
        ],
        isFallback: true,
        relaxedConstraints: ['price_max'],
        relaxationStepCount: 1,
      };

      const summary = buildSummary(output);
      const recs = toRecommendations(output);
      const reason = buildReason(output.results[0], output.isFallback);

      expect(typeof summary).toBe('string');
      expect(recs).toHaveLength(1);
      expect(typeof reason).toBe('string');
      // 폴백 근거에 완화 관련 문구 포함 여부 확인
      expect(reason).toContain('완화');

      expect(createSpy).toHaveBeenCalledTimes(0);
    });

    it('무선 휴대성 시나리오 결과 조합 - LLM 미호출', () => {
      const output: SearchOutput = {
        results: [
          {
            keyboard: makeKeyboard({ connection: '무선', weight_g: 450, wireless_type: '블루투스' }),
            keyboardIndex: 0,
            score: 3,
            matchedTags: ['무선', '휴대성', '가벼움'] as SoftIntentTag[],
            satisfiesHardConstraints: true,
            isFallback: false,
            relaxedConstraints: [],
            relaxationStepCount: 0,
          },
        ],
        isFallback: false,
        relaxedConstraints: [],
        relaxationStepCount: 0,
      };

      buildSummary(output);
      toRecommendations(output);
      buildReason(output.results[0], false);

      expect(createSpy).toHaveBeenCalledTimes(0);
    });
  });

  // -------------------------------------------------------------------------
  // 5. 연속 다중 호출에서도 LLM 호출 누적 0회
  // -------------------------------------------------------------------------

  describe('연속 다중 호출에서도 LLM 호출 누적 횟수 === 0', () => {
    it('buildReason을 10회 연속 호출해도 LLM 호출 0회', () => {
      const item = makeSearchResultItem({
        matchedTags: ['기계식', 'RGB'] as SoftIntentTag[],
        score: 2,
      });

      for (let i = 0; i < 10; i++) {
        buildReason(item, false);
      }

      expect(createSpy).toHaveBeenCalledTimes(0);
    });

    it('buildSummary를 10회 연속 호출해도 LLM 호출 0회', () => {
      const output = makeSearchOutput();

      for (let i = 0; i < 10; i++) {
        buildSummary(output);
      }

      expect(createSpy).toHaveBeenCalledTimes(0);
    });

    it('toRecommendations를 10회 연속 호출해도 LLM 호출 0회', () => {
      const output = makeSearchOutput({
        results: [
          makeSearchResultItem({ score: 1, matchedTags: ['기계식'] as SoftIntentTag[] }),
        ],
      });

      for (let i = 0; i < 10; i++) {
        toRecommendations(output);
      }

      expect(createSpy).toHaveBeenCalledTimes(0);
    });

    it('결과 조합 함수 3종 혼합 호출 - 총 LLM 호출 0회', () => {
      const output: SearchOutput = {
        results: [
          {
            keyboard: makeKeyboard({ switch_type: '기계식' }),
            keyboardIndex: 0,
            score: 2,
            matchedTags: ['기계식', 'RGB'] as SoftIntentTag[],
            satisfiesHardConstraints: true,
            isFallback: false,
            relaxedConstraints: [],
            relaxationStepCount: 0,
          },
          {
            keyboard: makeKeyboard({ switch_type: '무접점' }),
            keyboardIndex: 1,
            score: 0,
            matchedTags: [] as SoftIntentTag[],
            satisfiesHardConstraints: true,
            isFallback: false,
            relaxedConstraints: [],
            relaxationStepCount: 0,
          },
        ],
        isFallback: false,
        relaxedConstraints: [],
        relaxationStepCount: 0,
      };

      buildSummary(output);
      toRecommendations(output);
      buildReason(output.results[0], false);
      buildReason(output.results[1], false);
      buildSummary(output);
      toRecommendations(output);

      // 모든 결과 조합 함수 실행 후 spy 호출 횟수는 여전히 0
      expect(createSpy).toHaveBeenCalledTimes(0);
    });
  });

  // -------------------------------------------------------------------------
  // 6. spy가 실제로 작동하는지 검증 (spy 자체 sanity check)
  // -------------------------------------------------------------------------

  describe('spy 동작 확인 (sanity check)', () => {
    it('spy가 교체되어 있고 결과 조합 함수는 해당 spy를 호출하지 않는다', () => {
      // spy가 올바르게 주입되었는지 확인: 초기 호출 횟수 === 0
      expect(createSpy).toHaveBeenCalledTimes(0);

      // 결과 조합 함수 실행
      const output = makeSearchOutput({
        results: [
          makeSearchResultItem({
            matchedTags: ['기계식'] as SoftIntentTag[],
            score: 1,
          }),
        ],
      });
      buildSummary(output);
      toRecommendations(output);
      buildReason(output.results[0], false);

      // 여전히 0 - spy가 교체된 상태에서도 결과 조합 함수가 LLM을 호출하지 않음을 증명
      expect(createSpy).toHaveBeenCalledTimes(0);
      expect(createSpy).not.toHaveBeenCalled();
    });

    it('spy를 통해 수동으로 호출하면 횟수가 증가한다 (spy 자체 작동 확인)', () => {
      // spy 자체가 올바르게 동작하는지 확인
      expect(createSpy).toHaveBeenCalledTimes(0);

      // 직접 spy 호출 (LLM을 직접 호출하는 것처럼)
      createSpy();
      expect(createSpy).toHaveBeenCalledTimes(1);

      createSpy();
      expect(createSpy).toHaveBeenCalledTimes(2);

      // 결과 조합 함수 실행
      const output = makeSearchOutput();
      buildSummary(output);
      toRecommendations(output);

      // spy 횟수는 결과 조합 함수 호출로 증가하지 않음 (여전히 2)
      expect(createSpy).toHaveBeenCalledTimes(2);
    });
  });
});
