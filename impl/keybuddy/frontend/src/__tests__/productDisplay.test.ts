import { describe, expect, it } from 'vitest';
import {
  getBeginnerGuide,
  getBeginnerLabels,
  getCautionNotes,
  getProductTags,
} from '../lib/productDisplay';
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
    is_fallback: false,
    source: 'local',
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

describe('getBeginnerLabels', () => {
  it('어려운 스펙 용어를 초보자용 라벨로 바꿔 표시한다', () => {
    const labels = getBeginnerLabels(
      makeRecommendation({
        switch_type: '무접점 자석축',
        layout: '텐키리스',
        connection: '유선+무선',
        backlight: 'RGB 백라이트',
        engraving: '영문 정각',
        key_force: '60g',
        weight_g: 1200,
      }),
    );

    expect(labels).toContain('빠른 반응형 키감');
    expect(labels).toContain('숫자키 없음');
    expect(labels).toContain('유선/무선 모두 가능');
    expect(labels).toContain('화려한 조명');
    expect(labels).toContain('한글 각인 없음');
    expect(labels).toContain('누르는 힘이 무거운 편');
    expect(labels).toContain('본체 무게가 묵직함');
  });

  it('풀배열과 펜타그래프를 쉬운 표현으로 안내한다', () => {
    const labels = getBeginnerLabels(
      makeRecommendation({
        switch_type: '펜타그래프',
        layout: '풀배열',
        connection: '무선',
        backlight: '없음',
        key_force: '35g',
        weight_g: 620,
      }),
    );

    expect(labels).toContain('노트북처럼 낮은 키');
    expect(labels).toContain('숫자키 있음');
    expect(labels).toContain('무선 연결');
    expect(labels).toContain('조명 없음');
    expect(labels).toContain('가볍게 눌리는 편');
    expect(labels).toContain('본체 무게가 가벼운 편');
  });
});

describe('getBeginnerGuide', () => {
  it('쉬운 라벨과 주의 문구를 한 번에 반환한다', () => {
    const guide = getBeginnerGuide(
      makeRecommendation({
        switch_type: '기계식',
        raw_switch_name: '청축',
        layout: '텐키리스',
      }),
    );

    expect(guide.labels).toContain('축에 따라 키감 차이 큼');
    expect(guide.labels).toContain('숫자키 없음');
    expect(guide.notes).toContain(
      '클릭감 있는 축은 소리가 크게 느껴질 수 있어 조용한 공간에서는 확인이 필요해요.',
    );
  });
});

describe('getCautionNotes', () => {
  it('초보자가 놓치기 쉬운 불편 가능성을 속성 기반으로 안내한다', () => {
    const notes = getCautionNotes(
      makeRecommendation({
        switch_type: '기계식',
        raw_switch_name: '청축',
        layout: '텐키리스',
        connection: '유선',
        backlight: 'RGB 백라이트',
      }),
    );

    expect(notes).toContain(
      '클릭감 있는 축은 소리가 크게 느껴질 수 있어 조용한 공간에서는 확인이 필요해요.',
    );
    expect(notes).toContain(
      '숫자키가 없는 배열이라 엑셀이나 숫자 입력이 많다면 불편할 수 있어요.',
    );
  });

  it('주의 문장은 최대 2개까지만 반환한다', () => {
    const notes = getCautionNotes(
      makeRecommendation({
        switch_type: '무접점 자석축',
        layout: '미니',
        connection: '유선',
        backlight: '레인보우 백라이트',
        engraving: '영문 정각',
        key_force: '60g',
        weight_g: 1300,
      }),
    );

    expect(notes).toHaveLength(2);
  });

  it('블루투스 없는 무선 제품은 연결 방식 확인을 안내한다', () => {
    const notes = getCautionNotes(
      makeRecommendation({
        connection: '무선',
        wireless_type: '전용동글(리시버)',
      }),
    );

    expect(notes).toContain(
      '블루투스가 필요한 노트북·태블릿 환경에서는 연결 방식을 확인해야 해요.',
    );
  });

  it('유선+무선 제품은 전용 동글만 있어도 블루투스 부재 경고를 표시하지 않는다', () => {
    const notes = getCautionNotes(
      makeRecommendation({
        connection: '유선+무선',
        wireless_type: '전용동글(리시버)',
        switch_type: '펜타그래프',
        layout: '풀배열',
        backlight: '없음',
        weight_g: null,
      }),
    );

    expect(notes).not.toContain(
      '블루투스가 필요한 노트북·태블릿 환경에서는 연결 방식을 확인해야 해요.',
    );
  });

  it('raw_switch_name이 빈 문자열이면 switch_name으로 클릭 소음 주의 문구를 판단한다', () => {
    const notes = getCautionNotes(
      makeRecommendation({
        switch_type: '기계식',
        raw_switch_name: '',
        switch_name: '청축',
      }),
    );

    expect(notes).toContain(
      '클릭감 있는 축은 소리가 크게 느껴질 수 있어 조용한 공간에서는 확인이 필요해요.',
    );
  });
});
