import { describe, expect, it } from 'vitest';
import {
  getDisplaySummary,
  getResultHeadline,
  hasOnlyFallbackRecommendations,
  summarySaysNoMatches,
} from '../lib/resultCopy';
import type { Recommendation } from '../types';

function makeRecommendation(overrides: Partial<Recommendation> = {}): Recommendation {
  return {
    product_name: '테스트 키보드',
    brand: '테스트',
    price: 100000,
    image_url: '',
    switch_type: '무접점',
    connection: '유선+무선',
    layout: '풀배열',
    key_force: '60g',
    weight_g: 1000,
    wireless_type: '블루투스',
    engraving: '한/영 정각',
    backlight: '단색 백라이트',
    reason: '조건에 가까운 후보입니다.',
    tags: ['무접점', '풀배열'],
    is_fallback: false,
    source: 'llm',
    ...overrides,
  };
}

describe('resultCopy', () => {
  it('상품이 없다는 summary 문구를 감지한다', () => {
    expect(
      summarySaysNoMatches(
        '입력하신 조건과 catalog를 엄격히 대조한 결과, 동시에 만족하는 제품은 catalog에 없습니다.',
      ),
    ).toBe(true);
  });

  it('recommendations가 있으면 없음 summary를 근접 후보 summary로 보정한다', () => {
    const summary = getDisplaySummary(
      '입력하신 조건을 동시에 만족하는 제품은 catalog에 없습니다.',
      [makeRecommendation()],
    );

    expect(summary).toContain('추천 후보를 찾았어요');
    expect(summary).not.toContain('없습니다');
  });

  it('모든 결과가 fallback이면 완전 일치 대신 가까운 후보라고 표현한다', () => {
    const recommendations = [
      makeRecommendation({ is_fallback: true, source: 'fallback' }),
      makeRecommendation({ is_fallback: true, source: 'fallback' }),
    ];

    expect(hasOnlyFallbackRecommendations(recommendations)).toBe(true);
    expect(getDisplaySummary('조건을 만족하는 상품은 없습니다.', recommendations)).toContain('조건에 가까운 후보');
    expect(getResultHeadline('전체', recommendations.length, recommendations)).toBe('조건에 가까운 2개의 후보를 찾았어요');
  });

  it('정상 summary는 그대로 유지한다', () => {
    const summary = '입력하신 조건에 맞는 조용한 무접점 키보드 위주로 추천했어요.';

    expect(getDisplaySummary(summary, [makeRecommendation()])).toBe(summary);
    expect(getResultHeadline('전체', 1, [makeRecommendation()])).toBe('총 1개의 상품을 찾았어요');
  });
});
