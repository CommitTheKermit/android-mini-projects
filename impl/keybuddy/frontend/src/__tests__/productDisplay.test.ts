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
  it('기계식 키보드는 원본 스위치 이름을 표시한다', () => {
    expect(getProductTags(makeRecommendation({ raw_switch_name: '  적축  ' }))).toContain(
      '스위치 적축',
    );
  });

  it('비기계식 키보드도 원본 스위치 이름이 있으면 구체적인 이름을 표시한다', () => {
    const tags = getProductTags(
      makeRecommendation({ switch_type: '무접점 광축', raw_switch_name: 'TTC 광축 Silver' }),
    );

    expect(tags).toContain('스위치 TTC 광축 Silver');
    expect(tags).not.toContain('무접점 광축');
  });

  it.each([null, undefined, '', '   '])(
    '원본 스위치 이름이 %j이면 키보드의 스위치 타입을 표시한다',
    (rawSwitchName) => {
      expect(
        getProductTags(
          makeRecommendation({ switch_type: '무접점', raw_switch_name: rawSwitchName }),
        ),
      ).toContain('무접점');
    },
  );

  it('스위치 이름과 타입이 모두 없으면 정보 확인 중을 표시한다', () => {
    expect(
      getProductTags(makeRecommendation({ switch_type: '   ', raw_switch_name: null })),
    ).toContain('스위치 정보 확인 중');
  });

  it('무선 방식이 순수 유선이면 연결 태그를 한 번만 표시한다', () => {
    const tags = getProductTags(
      makeRecommendation({ connection: '유선', wireless_type: '유선' }),
    );

    expect(tags.filter((tag) => tag === '유선')).toHaveLength(1);
  });

  it.each(['', '   ', '정보없음'])(
    '무선 방식이 %j이면 해당 값을 태그로 표시하지 않는다',
    (wirelessType) => {
      const tags = getProductTags(
        makeRecommendation({ connection: '유선', wireless_type: wirelessType }),
      );

      expect(tags).toContain('유선');
      expect(tags).not.toContain(wirelessType.trim());
    },
  );

  it('무선 방식이 연결 방식과 같으면 중복 태그를 표시하지 않는다', () => {
    const tags = getProductTags(
      makeRecommendation({ connection: '유선+무선', wireless_type: '유선+무선' }),
    );

    expect(tags.filter((tag) => tag === '유선+무선')).toHaveLength(1);
  });

  it('실제 무선 방식은 접두사를 제거해 별도 태그로 표시한다', () => {
    const tags = getProductTags(
      makeRecommendation({
        connection: '무선',
        wireless_type: '[키보드] 전용동글(리시버), 블루투스',
      }),
    );

    expect(tags).toContain('무선');
    expect(tags).toContain('전용동글(리시버), 블루투스');
  });

  it.each([
    ['RGB 백라이트', '백라이트: RGB'],
    ['단색 백라이트', '백라이트: 단색'],
    ['없음', '백라이트: 없음'],
    ['레인보우 백라이트', '백라이트: 레인보우'],
    ['[키보드] 레인보우 백라이트', '백라이트: 레인보우'],
    ['사이드 RGB LED', '백라이트: RGB'],
    ['LED라이트', '백라이트: LED'],
  ])('%s를 %s 태그로 표시한다', (backlight, expectedTag) => {
    const tags = getProductTags(makeRecommendation({ backlight }));

    expect(tags).toContain(expectedTag);
    expect(tags).not.toContain(backlight);
  });

  it.each(['', '   ', '정보없음'])(
    '백라이트 값이 %j이면 정보 확인 중으로 표시한다',
    (backlight) => {
      expect(getProductTags(makeRecommendation({ backlight }))).toContain(
        '백라이트: 정보 확인 중',
      );
    },
  );

  it.each(['', '   ', '0g'])('키압이 %j이면 정보 확인 중 태그를 반환한다', (keyForce) => {
    const tags = getProductTags(makeRecommendation({ key_force: keyForce }));

    expect(tags).toContain('키압 정보 확인 중');
    expect(tags).not.toContain('키압 ');
  });

  it('키압 값의 앞뒤 공백을 제거해 표시한다', () => {
    expect(getProductTags(makeRecommendation({ key_force: ' 43g ' }))).toContain('키압 43g');
  });
});
