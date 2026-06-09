/**
 * Sub-AC 7.3.1: 하드 제약 필터 모듈 - LLM 호출 횟수 0 검증
 *
 * LLM 클라이언트를 vi.fn() spy로 교체한 뒤
 * 하드 제약 필터 함수(filterByHardConstraints, checkHardConstraintViolation 등)만
 * 단독 실행하고 LLM 호출 횟수가 0임을 단위 테스트로 확인한다.
 *
 * - _setClientForTest: 테스트용 mock 클라이언트 주입
 * - vi.fn(): 호출 횟수 추적 spy
 * - 검색/스코어링 경로에 LLM이 개입하지 않음을 증명
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  filterByHardConstraints,
  checkHardConstraintViolation,
  checkLayoutViolation,
  checkSwitchViolation,
  checkBudgetViolation,
  checkFormFactorViolation,
  detectNoResult,
} from '../lib/hardFilter';
import { _setClientForTest } from '../lib/extractRawTags';
import type { AnthropicClient } from '../lib/extractRawTags';
import type { Keyboard } from '../types';

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

describe('Sub-AC 7.3.1: 하드 제약 필터 LLM 호출 횟수 === 0', () => {
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
  // 1. filterByHardConstraints - LLM 호출 0회
  // -------------------------------------------------------------------------

  describe('filterByHardConstraints 실행 후 LLM 호출 횟수 === 0', () => {
    it('layout 단일 제약 필터링 - LLM 미호출', () => {
      const keyboards = [
        makeKeyboard({ layout: '텐키리스' }),
        makeKeyboard({ layout: '풀배열' }),
        makeKeyboard({ layout: '미니' }),
      ];

      filterByHardConstraints(keyboards, [{ type: 'layout', value: '텐키리스' }]);

      expect(createSpy).toHaveBeenCalledTimes(0);
    });

    it('switch_type 단일 제약 필터링 - LLM 미호출', () => {
      const keyboards = [
        makeKeyboard({ switch_type: '기계식' }),
        makeKeyboard({ switch_type: '무접점' }),
        makeKeyboard({ switch_type: '펜타그래프' }),
      ];

      filterByHardConstraints(keyboards, [{ type: 'switch_type', value: '기계식' }]);

      expect(createSpy).toHaveBeenCalledTimes(0);
    });

    it('price_max 단일 제약 필터링 - LLM 미호출', () => {
      const keyboards = [
        makeKeyboard({ price: 80000 }),
        makeKeyboard({ price: 150000 }),
        makeKeyboard({ price: 200000 }),
      ];

      filterByHardConstraints(keyboards, [{ type: 'price_max', value: 100000 }]);

      expect(createSpy).toHaveBeenCalledTimes(0);
    });

    it('복합 제약(layout + price_max + switch_type) 필터링 - LLM 미호출', () => {
      const keyboards = [
        makeKeyboard({ layout: '텐키리스', price: 80000, switch_type: '기계식' }),
        makeKeyboard({ layout: '풀배열', price: 90000, switch_type: '기계식' }),
        makeKeyboard({ layout: '텐키리스', price: 200000, switch_type: '기계식' }),
        makeKeyboard({ layout: '텐키리스', price: 70000, switch_type: '무접점' }),
        makeKeyboard({ layout: '텐키리스', price: 60000, switch_type: '기계식' }),
      ];

      filterByHardConstraints(keyboards, [
        { type: 'layout', value: '텐키리스' },
        { type: 'price_max', value: 100000 },
        { type: 'switch_type', value: '기계식' },
      ]);

      expect(createSpy).toHaveBeenCalledTimes(0);
    });

    it('빈 hardTags 배열로 필터링 - LLM 미호출', () => {
      const keyboards = [makeKeyboard(), makeKeyboard({ layout: '풀배열' })];

      filterByHardConstraints(keyboards, []);

      expect(createSpy).toHaveBeenCalledTimes(0);
    });

    it('빈 keyboards 배열 필터링 - LLM 미호출', () => {
      filterByHardConstraints([], [{ type: 'layout', value: '텐키리스' }]);

      expect(createSpy).toHaveBeenCalledTimes(0);
    });

    it('전체 위반(0건 결과) 필터링 - LLM 미호출', () => {
      const keyboards = [
        makeKeyboard({ layout: '풀배열' }),
        makeKeyboard({ layout: '미니' }),
      ];

      const result = filterByHardConstraints(keyboards, [{ type: 'layout', value: '텐키리스' }]);

      expect(result).toHaveLength(0);
      expect(createSpy).toHaveBeenCalledTimes(0);
    });
  });

  // -------------------------------------------------------------------------
  // 2. checkHardConstraintViolation 디스패처 - LLM 호출 0회
  // -------------------------------------------------------------------------

  describe('checkHardConstraintViolation 실행 후 LLM 호출 횟수 === 0', () => {
    it('type:layout 라우팅 - LLM 미호출', () => {
      const kb = makeKeyboard({ layout: '텐키리스' });

      checkHardConstraintViolation(kb, { type: 'layout', value: '텐키리스' });
      checkHardConstraintViolation(kb, { type: 'layout', value: '풀배열' });

      expect(createSpy).toHaveBeenCalledTimes(0);
    });

    it('type:switch_type 라우팅 - LLM 미호출', () => {
      const kb = makeKeyboard({ switch_type: '기계식' });

      checkHardConstraintViolation(kb, { type: 'switch_type', value: '기계식' });
      checkHardConstraintViolation(kb, { type: 'switch_type', value: '무접점' });

      expect(createSpy).toHaveBeenCalledTimes(0);
    });

    it('type:price_max 라우팅 - LLM 미호출', () => {
      const kb = makeKeyboard({ price: 100000 });

      checkHardConstraintViolation(kb, { type: 'price_max', value: 150000 });
      checkHardConstraintViolation(kb, { type: 'price_max', value: 50000 });

      expect(createSpy).toHaveBeenCalledTimes(0);
    });

    it('type:form_factor 라우팅 - LLM 미호출', () => {
      const kb = makeKeyboard({ layout: '텐키리스' });

      checkHardConstraintViolation(kb, { type: 'form_factor', value: '텐키리스' });
      checkHardConstraintViolation(kb, { type: 'form_factor', value: '미니' });

      expect(createSpy).toHaveBeenCalledTimes(0);
    });

    it('알 수 없는 type 폴백 - LLM 미호출', () => {
      const kb = makeKeyboard();

      checkHardConstraintViolation(kb, { type: 'unknown_type', value: '임의' });

      expect(createSpy).toHaveBeenCalledTimes(0);
    });
  });

  // -------------------------------------------------------------------------
  // 3. 개별 위반 판정 함수 - LLM 호출 0회
  // -------------------------------------------------------------------------

  describe('개별 위반 판정 함수 실행 후 LLM 호출 횟수 === 0', () => {
    it('checkLayoutViolation - LLM 미호출', () => {
      const kb = makeKeyboard({ layout: '텐키리스' });

      checkLayoutViolation(kb, '텐키리스');
      checkLayoutViolation(kb, '풀배열');
      checkLayoutViolation(kb, '');

      expect(createSpy).toHaveBeenCalledTimes(0);
    });

    it('checkSwitchViolation - LLM 미호출', () => {
      const kb = makeKeyboard({ switch_type: '기계식' });

      checkSwitchViolation(kb, '기계식');
      checkSwitchViolation(kb, '무접점');
      checkSwitchViolation(kb, '');

      expect(createSpy).toHaveBeenCalledTimes(0);
    });

    it('checkBudgetViolation - LLM 미호출', () => {
      const kb = makeKeyboard({ price: 100000 });

      checkBudgetViolation(kb, 150000);
      checkBudgetViolation(kb, 80000);
      checkBudgetViolation(kb, 0);

      expect(createSpy).toHaveBeenCalledTimes(0);
    });

    it('checkFormFactorViolation - LLM 미호출', () => {
      const kb = makeKeyboard({ layout: '텐키리스' });

      checkFormFactorViolation(kb, '텐키리스');
      checkFormFactorViolation(kb, '미니');
      checkFormFactorViolation(kb, '');

      expect(createSpy).toHaveBeenCalledTimes(0);
    });
  });

  // -------------------------------------------------------------------------
  // 4. detectNoResult - LLM 호출 0회
  // -------------------------------------------------------------------------

  describe('detectNoResult 실행 후 LLM 호출 횟수 === 0', () => {
    it('빈 배열 -> NO_MATCH 신호 - LLM 미호출', () => {
      detectNoResult([]);

      expect(createSpy).toHaveBeenCalledTimes(0);
    });

    it('1개 이상 배열 -> OK 신호 - LLM 미호출', () => {
      detectNoResult([makeKeyboard()]);

      expect(createSpy).toHaveBeenCalledTimes(0);
    });

    it('filterByHardConstraints 연결 파이프라인 - LLM 미호출', () => {
      const keyboards = [
        makeKeyboard({ layout: '텐키리스' }),
        makeKeyboard({ layout: '풀배열' }),
      ];

      const filtered = filterByHardConstraints(keyboards, [{ type: 'layout', value: '텐키리스' }]);
      detectNoResult(filtered);

      expect(createSpy).toHaveBeenCalledTimes(0);
    });
  });

  // -------------------------------------------------------------------------
  // 5. 연속 다중 호출에서도 LLM 호출 누적 0회
  // -------------------------------------------------------------------------

  describe('연속 다중 호출에서도 LLM 호출 누적 횟수 === 0', () => {
    it('filterByHardConstraints를 10회 연속 호출해도 LLM 호출 0회', () => {
      const keyboards = [
        makeKeyboard({ layout: '텐키리스', price: 80000 }),
        makeKeyboard({ layout: '풀배열', price: 90000 }),
        makeKeyboard({ layout: '텐키리스', price: 150000 }),
      ];
      const hardTags = [{ type: 'layout', value: '텐키리스' }];

      for (let i = 0; i < 10; i++) {
        filterByHardConstraints(keyboards, hardTags);
      }

      expect(createSpy).toHaveBeenCalledTimes(0);
    });

    it('다양한 하드 필터 함수 혼합 호출 - 총 LLM 호출 0회', () => {
      const kb = makeKeyboard();
      const keyboards = [kb, makeKeyboard({ layout: '풀배열' })];

      checkLayoutViolation(kb, '텐키리스');
      checkSwitchViolation(kb, '기계식');
      checkBudgetViolation(kb, 200000);
      checkFormFactorViolation(kb, '텐키리스');
      checkHardConstraintViolation(kb, { type: 'layout', value: '텐키리스' });
      filterByHardConstraints(keyboards, [{ type: 'layout', value: '텐키리스' }]);
      detectNoResult(keyboards);

      // 모든 하드 필터 함수 실행 후 spy 호출 횟수는 여전히 0
      expect(createSpy).toHaveBeenCalledTimes(0);
    });
  });

  // -------------------------------------------------------------------------
  // 6. spy가 실제로 작동하는지 검증 (spy 자체 sanity check)
  // -------------------------------------------------------------------------

  describe('spy 동작 확인 (sanity check)', () => {
    it('spy가 교체되어 있고 하드 필터는 해당 spy를 호출하지 않는다', () => {
      // spy가 올바르게 주입되었는지 확인: 초기 호출 횟수 === 0
      expect(createSpy).toHaveBeenCalledTimes(0);

      // 하드 필터 실행
      filterByHardConstraints(
        [makeKeyboard(), makeKeyboard({ layout: '풀배열' })],
        [{ type: 'layout', value: '텐키리스' }],
      );

      // 여전히 0 - spy가 교체된 상태에서도 하드 필터가 LLM을 호출하지 않음을 증명
      expect(createSpy).toHaveBeenCalledTimes(0);
      expect(createSpy).not.toHaveBeenCalled();
    });
  });
});
