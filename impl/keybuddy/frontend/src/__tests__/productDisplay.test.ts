import { describe, expect, it } from 'vitest';
import { getProductTags } from '../lib/productDisplay';
import type { Recommendation } from '../types';

function makeRecommendation(overrides: Partial<Recommendation> = {}): Recommendation {
  return {
    product_name: '테스트 키보드',
    brand: 'TEST',
    price: 10000,
    image_url: 'https://example.com/keyboard.jpg',
    switch_type: '기계식',
    connection: '유선',
    layout: '풀배열',
    key_force: '45g',
    weight_g: 1000,
    wireless_type: '유선',
    engraving: '한/영 정각',
    backlight: '없음',
    raw_switch_name: '적축',
    reason: '테스트 추천 사유',
    tags: [],
    ...overrides,
  };
}

describe('getProductTags', () => {
  it.each(['', '   ', '0g'])('키압이 %j이면 정보 확인 중 태그를 반환한다', (keyForce) => {
    const tags = getProductTags(makeRecommendation({ key_force: keyForce }));

    expect(tags).toContain('키압 정보 확인 중');
    expect(tags).not.toContain('키압 ');
  });

  it('키압 값의 앞뒤 공백을 제거해 표시한다', () => {
    expect(getProductTags(makeRecommendation({ key_force: ' 43g ' }))).toContain('키압 43g');
  });
});
