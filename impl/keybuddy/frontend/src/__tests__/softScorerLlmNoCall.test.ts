/**
 * Sub-AC 7.3.2: 소프트 태그 스코어링 모듈 - LLM 호출 횟수 0 검증
 *
 * LLM 클라이언트를 vi.fn() spy로 교체한 뒤
 * 소프트 태그 점수 계산 함수(scoreBySoftTags, deriveRankOrder, getMatchedSoftTags)만
 * 단독 실행하고 LLM 호출 횟수가 0임을 단위 테스트로 확인한다.
 *
 * - _setClientForTest: 테스트용 mock 클라이언트 주입
 * - vi.fn(): 호출 횟수 추적 spy
 * - 검색/스코어링 경로에 LLM이 개입하지 않음을 증명
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { scoreBySoftTags, deriveRankOrder, getMatchedSoftTags } from '../lib/softScorer';
import { _setClientForTest } from '../lib/extractRawTags';
import type { AnthropicClient } from '../lib/extractRawTags';
import type { Keyboard } from '../types';
import type { SoftIntentTag } from '../lib/tagSchema';

// ---------------------------------------------------------------------------
// LLM spy 헬퍼
// ---------------------------------------------------------------------------

/**
 * vi.fn() spy를 사용하는 mock AnthropicClient를 생성한다.
 * create spy를 외부에서 참조할 수 있도록 반환한다.
 */
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
// 키보드 픽스처 헬퍼
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

// ---------------------------------------------------------------------------
// 테스트 스위트
// ---------------------------------------------------------------------------

describe('Sub-AC 7.3.2: 소프트 태그 스코어링 LLM 호출 횟수 === 0', () => {
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
  // 1. scoreBySoftTags - LLM 호출 0회
  // -------------------------------------------------------------------------

  describe('scoreBySoftTags 실행 후 LLM 호출 횟수 === 0', () => {
    it('단일 소프트 태그로 스코어링 - LLM 미호출', () => {
      const keyboards = [
        makeKeyboard({ switch_type: '기계식' }),
        makeKeyboard({ switch_type: '무접점' }),
        makeKeyboard({ switch_type: '펜타그래프' }),
      ];
      const softTags: SoftIntentTag[] = ['기계식'];

      scoreBySoftTags(keyboards, softTags);

      expect(createSpy).toHaveBeenCalledTimes(0);
    });

    it('다중 소프트 태그로 스코어링 - LLM 미호출', () => {
      const keyboards = [
        makeKeyboard({ switch_type: '기계식', backlight: 'RGB 백라이트' }),
        makeKeyboard({ switch_type: '무접점', backlight: '없음' }),
        makeKeyboard({ connection: '무선', weight_g: 500 }),
      ];
      const softTags: SoftIntentTag[] = ['기계식', 'RGB', '무선', '가벼움'];

      scoreBySoftTags(keyboards, softTags);

      expect(createSpy).toHaveBeenCalledTimes(0);
    });

    it('빈 softTags 배열로 스코어링 - LLM 미호출', () => {
      const keyboards = [makeKeyboard(), makeKeyboard({ layout: '풀배열' })];

      scoreBySoftTags(keyboards, []);

      expect(createSpy).toHaveBeenCalledTimes(0);
    });

    it('빈 keyboards 배열 스코어링 - LLM 미호출', () => {
      scoreBySoftTags([], ['기계식', 'RGB']);

      expect(createSpy).toHaveBeenCalledTimes(0);
    });

    it('게이밍 의도 스코어링(기계식+RGB) - LLM 미호출', () => {
      const keyboards = [
        makeKeyboard({ switch_type: '기계식', backlight: 'RGB 백라이트' }),
        makeKeyboard({ switch_type: '무접점', backlight: '없음' }),
        makeKeyboard({ switch_type: '기계식', backlight: '없음' }),
      ];
      const softTags: SoftIntentTag[] = ['게이밍', 'RGB', '기계식'];

      scoreBySoftTags(keyboards, softTags);

      expect(createSpy).toHaveBeenCalledTimes(0);
    });

    it('사무용 의도 스코어링(무접점+조용함) - LLM 미호출', () => {
      const keyboards = [
        makeKeyboard({ switch_type: '무접점', weight_g: 600 }),
        makeKeyboard({ switch_type: '기계식', weight_g: 900 }),
      ];
      const softTags: SoftIntentTag[] = ['사무용', '무접점', '조용함'];

      scoreBySoftTags(keyboards, softTags);

      expect(createSpy).toHaveBeenCalledTimes(0);
    });

    it('전체 SOFT_INTENT_VOCAB 태그로 스코어링 - LLM 미호출', () => {
      const keyboards = [makeKeyboard(), makeKeyboard({ connection: '무선' })];
      const softTags: SoftIntentTag[] = [
        '조용함', '저소음', '고소음', '경쾌함',
        '사무용', '게이밍', '휴대성', '가벼움', '무거움',
        '타건감', 'RGB', '백라이트', '백라이트없음',
        '무선', '멀티페어링', '가성비', '기계식', '무접점',
        '펜타그래프', '한영각인', '영문각인', '풀배열', '텐키리스', '미니',
      ];

      scoreBySoftTags(keyboards, softTags);

      expect(createSpy).toHaveBeenCalledTimes(0);
    });
  });

  // -------------------------------------------------------------------------
  // 2. deriveRankOrder - LLM 호출 0회
  // -------------------------------------------------------------------------

  describe('deriveRankOrder 실행 후 LLM 호출 횟수 === 0', () => {
    it('단일 점수 벡터 순위 도출 - LLM 미호출', () => {
      const scoreVector = [
        { keyboardIndex: 0, score: 2, matchedTags: ['기계식', 'RGB'] as SoftIntentTag[] },
        { keyboardIndex: 1, score: 1, matchedTags: ['무접점'] as SoftIntentTag[] },
        { keyboardIndex: 2, score: 0, matchedTags: [] },
      ];

      deriveRankOrder(scoreVector);

      expect(createSpy).toHaveBeenCalledTimes(0);
    });

    it('동점 처리 순위 도출 - LLM 미호출', () => {
      const scoreVector = [
        { keyboardIndex: 0, score: 1, matchedTags: ['기계식'] as SoftIntentTag[] },
        { keyboardIndex: 1, score: 1, matchedTags: ['RGB'] as SoftIntentTag[] },
        { keyboardIndex: 2, score: 1, matchedTags: ['무선'] as SoftIntentTag[] },
      ];

      deriveRankOrder(scoreVector);

      expect(createSpy).toHaveBeenCalledTimes(0);
    });

    it('빈 점수 벡터 순위 도출 - LLM 미호출', () => {
      deriveRankOrder([]);

      expect(createSpy).toHaveBeenCalledTimes(0);
    });

    it('단일 원소 점수 벡터 순위 도출 - LLM 미호출', () => {
      const scoreVector = [
        { keyboardIndex: 0, score: 3, matchedTags: ['기계식', 'RGB', '게이밍'] as SoftIntentTag[] },
      ];

      deriveRankOrder(scoreVector);

      expect(createSpy).toHaveBeenCalledTimes(0);
    });
  });

  // -------------------------------------------------------------------------
  // 3. getMatchedSoftTags - LLM 호출 0회
  // -------------------------------------------------------------------------

  describe('getMatchedSoftTags 실행 후 LLM 호출 횟수 === 0', () => {
    it('단일 키보드 매칭 태그 조회 - LLM 미호출', () => {
      const keyboard = makeKeyboard({ switch_type: '기계식', backlight: 'RGB 백라이트' });
      const softTags: SoftIntentTag[] = ['기계식', 'RGB', '무접점'];

      getMatchedSoftTags(keyboard, softTags);

      expect(createSpy).toHaveBeenCalledTimes(0);
    });

    it('빈 softTags 조회 - LLM 미호출', () => {
      const keyboard = makeKeyboard();

      getMatchedSoftTags(keyboard, []);

      expect(createSpy).toHaveBeenCalledTimes(0);
    });

    it('매칭 없는 태그 조회 - LLM 미호출', () => {
      const keyboard = makeKeyboard({ switch_type: '기계식' });
      const softTags: SoftIntentTag[] = ['무접점', '펜타그래프'];

      getMatchedSoftTags(keyboard, softTags);

      expect(createSpy).toHaveBeenCalledTimes(0);
    });

    it('무선 키보드 태그 조회 - LLM 미호출', () => {
      const keyboard = makeKeyboard({ connection: '무선', wireless_type: '블루투스', weight_g: 400 });
      const softTags: SoftIntentTag[] = ['무선', '멀티페어링', '휴대성', '가벼움'];

      getMatchedSoftTags(keyboard, softTags);

      expect(createSpy).toHaveBeenCalledTimes(0);
    });
  });

  // -------------------------------------------------------------------------
  // 4. scoreBySoftTags + deriveRankOrder 파이프라인 - LLM 호출 0회
  // -------------------------------------------------------------------------

  describe('scoreBySoftTags -> deriveRankOrder 파이프라인 실행 후 LLM 호출 횟수 === 0', () => {
    it('게이밍 파이프라인(스코어링 후 순위) - LLM 미호출', () => {
      const keyboards = [
        makeKeyboard({ switch_type: '기계식', backlight: 'RGB 백라이트' }),
        makeKeyboard({ switch_type: '무접점', backlight: '없음' }),
        makeKeyboard({ switch_type: '기계식', backlight: '없음' }),
      ];
      const softTags: SoftIntentTag[] = ['게이밍', 'RGB', '기계식'];

      const scoreVector = scoreBySoftTags(keyboards, softTags);
      deriveRankOrder(scoreVector);

      expect(createSpy).toHaveBeenCalledTimes(0);
    });

    it('사무용 파이프라인(스코어링 후 순위) - LLM 미호출', () => {
      const keyboards = [
        makeKeyboard({ switch_type: '무접점', weight_g: 600 }),
        makeKeyboard({ switch_type: '기계식', weight_g: 1000 }),
        makeKeyboard({ switch_type: '무접점', weight_g: 450 }),
      ];
      const softTags: SoftIntentTag[] = ['사무용', '무접점', '조용함', '가벼움'];

      const scoreVector = scoreBySoftTags(keyboards, softTags);
      deriveRankOrder(scoreVector);

      expect(createSpy).toHaveBeenCalledTimes(0);
    });
  });

  // -------------------------------------------------------------------------
  // 5. 연속 다중 호출에서도 LLM 호출 누적 0회
  // -------------------------------------------------------------------------

  describe('연속 다중 호출에서도 LLM 호출 누적 횟수 === 0', () => {
    it('scoreBySoftTags를 10회 연속 호출해도 LLM 호출 0회', () => {
      const keyboards = [
        makeKeyboard({ switch_type: '기계식' }),
        makeKeyboard({ switch_type: '무접점' }),
      ];
      const softTags: SoftIntentTag[] = ['기계식', 'RGB', '게이밍'];

      for (let i = 0; i < 10; i++) {
        scoreBySoftTags(keyboards, softTags);
      }

      expect(createSpy).toHaveBeenCalledTimes(0);
    });

    it('다양한 소프트 스코어 함수 혼합 호출 - 총 LLM 호출 0회', () => {
      const keyboard = makeKeyboard({ switch_type: '기계식', backlight: 'RGB 백라이트' });
      const keyboards = [keyboard, makeKeyboard({ switch_type: '무접점' })];
      const softTags: SoftIntentTag[] = ['기계식', 'RGB', '게이밍'];

      // 세 함수 모두 호출
      const matched = getMatchedSoftTags(keyboard, softTags);
      const scoreVector = scoreBySoftTags(keyboards, softTags);
      deriveRankOrder(scoreVector);

      // 모든 소프트 스코어 함수 실행 후 spy 호출 횟수는 여전히 0
      expect(createSpy).toHaveBeenCalledTimes(0);
      expect(matched.length).toBeGreaterThanOrEqual(0); // 결과는 정상 반환
    });
  });

  // -------------------------------------------------------------------------
  // 6. spy가 실제로 작동하는지 검증 (spy 자체 sanity check)
  // -------------------------------------------------------------------------

  describe('spy 동작 확인 (sanity check)', () => {
    it('spy가 교체되어 있고 소프트 스코어러는 해당 spy를 호출하지 않는다', () => {
      // spy가 올바르게 주입되었는지 확인: 초기 호출 횟수 === 0
      expect(createSpy).toHaveBeenCalledTimes(0);

      // 소프트 스코어링 실행
      const keyboards = [
        makeKeyboard({ switch_type: '기계식' }),
        makeKeyboard({ switch_type: '무접점' }),
      ];
      const scoreVector = scoreBySoftTags(keyboards, ['기계식', '무접점', 'RGB']);
      deriveRankOrder(scoreVector);

      // 여전히 0 - spy가 교체된 상태에서도 소프트 스코어러가 LLM을 호출하지 않음을 증명
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

      // 소프트 스코어러 실행
      scoreBySoftTags([makeKeyboard()], ['기계식']);

      // spy 횟수는 소프트 스코어러 호출로 증가하지 않음 (여전히 2)
      expect(createSpy).toHaveBeenCalledTimes(2);
    });
  });
});
