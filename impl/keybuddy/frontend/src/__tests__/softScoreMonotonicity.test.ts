/**
 * AC 5: 소프트 의도 태그 점수 단조성 단위테스트
 *
 * 검증 대상:
 * - 소프트 의도 태그가 더 많이 겹치는 키보드가 더 높은 점수를 받는다
 * - 더 높은 점수를 받은 키보드가 더 상위 랭크를 받는다
 * - 단조성 불변식: score(A) > score(B) -> rank(A) < rank(B)
 *
 * 전략:
 * - 0, 1, 2, 3, 4, 5개의 소프트 태그에 정확히 매칭되도록 설계된 키보드 픽스처를 사용
 * - 각 픽스처에서 score == matchedTagCount 임을 검증
 * - deriveRankOrder 결과가 score 내림차순임을 검증
 * - 연속한 두 점수 단계 사이에서 높은 점수 키보드가 항상 앞에 위치함을 검증
 *
 * LLM 호출 없이 순수 함수만 사용한다.
 */

import { describe, it, expect } from 'vitest';
import { scoreBySoftTags, deriveRankOrder } from '../lib/softScorer';
import type { SoftIntentTag } from '../lib/tagSchema';
import type { Keyboard } from '../types';

// ---------------------------------------------------------------------------
// 픽스처 헬퍼
// ---------------------------------------------------------------------------

function makeKeyboard(overrides: Partial<Keyboard>): Keyboard {
  return {
    product_name: '기본 키보드',
    brand: '테스트브랜드',
    price: 200000,
    image_url: '',
    switch_type: '멤브레인',
    connection: '유선',
    layout: '풀배열',
    key_force: '45g',
    weight_g: 1000,
    wireless_type: '유선',
    engraving: '한/영 정각',
    backlight: '없음',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 테스트 태그 집합: ['텐키리스', '가성비', '무선', '멀티페어링', '가벼움']
//
// 이 5개 태그는 서로 독립적인 필드에 매핑되므로 각 태그를 독립적으로 ON/OFF 할 수 있다.
//   텐키리스  : layout === '텐키리스'
//   가성비    : price <= 100000
//   무선      : connection === '무선'
//   멀티페어링: wireless_type includes '블루투스'
//   가벼움    : weight_g <= 800
// ---------------------------------------------------------------------------

const TEST_TAGS: SoftIntentTag[] = ['텐키리스', '가성비', '무선', '멀티페어링', '가벼움'];

/**
 * 0~5개의 태그에 정확히 매칭되는 키보드 목록.
 * idx 0 -> 0개 매칭, idx 1 -> 1개, ..., idx 5 -> 5개
 */
const MONOTONE_CATALOG: Keyboard[] = [
  // idx 0: 0개 매칭 - 모든 테스트 태그 불만족
  makeKeyboard({
    product_name: '0태그-풀배열-비싸고-유선-동글-무거움',
    layout: '풀배열',       // 텐키리스 NO
    price: 200000,           // 가성비(lte 100000) NO
    connection: '유선',      // 무선 NO
    wireless_type: '유선',   // 멀티페어링 NO
    weight_g: 1000,          // 가벼움(lte 800) NO
  }),
  // idx 1: 1개 매칭 - 텐키리스만
  makeKeyboard({
    product_name: '1태그-텐키리스-비싸고-유선-동글-무거움',
    layout: '텐키리스',      // 텐키리스 YES
    price: 200000,           // 가성비 NO
    connection: '유선',      // 무선 NO
    wireless_type: '유선',   // 멀티페어링 NO
    weight_g: 1000,          // 가벼움 NO
  }),
  // idx 2: 2개 매칭 - 텐키리스, 가성비
  makeKeyboard({
    product_name: '2태그-텐키리스-저렴-유선-동글-무거움',
    layout: '텐키리스',      // 텐키리스 YES
    price: 50000,            // 가성비 YES
    connection: '유선',      // 무선 NO
    wireless_type: '유선',   // 멀티페어링 NO
    weight_g: 1000,          // 가벼움 NO
  }),
  // idx 3: 3개 매칭 - 텐키리스, 가성비, 무선
  makeKeyboard({
    product_name: '3태그-텐키리스-저렴-무선-동글-무거움',
    layout: '텐키리스',              // 텐키리스 YES
    price: 50000,                    // 가성비 YES
    connection: '무선',              // 무선 YES
    wireless_type: '전용동글(리시버)', // 멀티페어링 NO
    weight_g: 1000,                  // 가벼움 NO
  }),
  // idx 4: 4개 매칭 - 텐키리스, 가성비, 무선, 멀티페어링
  makeKeyboard({
    product_name: '4태그-텐키리스-저렴-무선-블루투스-무거움',
    layout: '텐키리스',      // 텐키리스 YES
    price: 50000,            // 가성비 YES
    connection: '무선',      // 무선 YES
    wireless_type: '블루투스', // 멀티페어링 YES
    weight_g: 1000,          // 가벼움 NO
  }),
  // idx 5: 5개 매칭 - 텐키리스, 가성비, 무선, 멀티페어링, 가벼움
  makeKeyboard({
    product_name: '5태그-텐키리스-저렴-무선-블루투스-가벼움',
    layout: '텐키리스',      // 텐키리스 YES
    price: 50000,            // 가성비 YES
    connection: '무선',      // 무선 YES
    wireless_type: '블루투스', // 멀티페어링 YES
    weight_g: 600,           // 가벼움 YES
  }),
];

// ===========================================================================
// 1. 기본 점수 단조성: 매칭 태그 수 == score
// ===========================================================================

describe('softScoreMonotonicity - 기본 점수 단조성', () => {
  it('0개 매칭 키보드는 score === 0 이다', () => {
    const scores = scoreBySoftTags(MONOTONE_CATALOG, TEST_TAGS);
    expect(scores[0].score).toBe(0);
    expect(scores[0].matchedTags).toHaveLength(0);
  });

  it('1개 매칭 키보드는 score === 1 이다', () => {
    const scores = scoreBySoftTags(MONOTONE_CATALOG, TEST_TAGS);
    expect(scores[1].score).toBe(1);
    expect(scores[1].matchedTags).toHaveLength(1);
    expect(scores[1].matchedTags).toContain('텐키리스');
  });

  it('2개 매칭 키보드는 score === 2 이다', () => {
    const scores = scoreBySoftTags(MONOTONE_CATALOG, TEST_TAGS);
    expect(scores[2].score).toBe(2);
    expect(scores[2].matchedTags).toHaveLength(2);
    expect(new Set(scores[2].matchedTags)).toEqual(new Set(['텐키리스', '가성비']));
  });

  it('3개 매칭 키보드는 score === 3 이다', () => {
    const scores = scoreBySoftTags(MONOTONE_CATALOG, TEST_TAGS);
    expect(scores[3].score).toBe(3);
    expect(scores[3].matchedTags).toHaveLength(3);
    expect(new Set(scores[3].matchedTags)).toEqual(new Set(['텐키리스', '가성비', '무선']));
  });

  it('4개 매칭 키보드는 score === 4 이다', () => {
    const scores = scoreBySoftTags(MONOTONE_CATALOG, TEST_TAGS);
    expect(scores[4].score).toBe(4);
    expect(scores[4].matchedTags).toHaveLength(4);
    expect(new Set(scores[4].matchedTags)).toEqual(
      new Set(['텐키리스', '가성비', '무선', '멀티페어링']),
    );
  });

  it('5개 매칭 키보드는 score === 5 이다', () => {
    const scores = scoreBySoftTags(MONOTONE_CATALOG, TEST_TAGS);
    expect(scores[5].score).toBe(5);
    expect(scores[5].matchedTags).toHaveLength(5);
    expect(new Set(scores[5].matchedTags)).toEqual(
      new Set(['텐키리스', '가성비', '무선', '멀티페어링', '가벼움']),
    );
  });

  it('score === matchedTags.length 불변식이 모든 키보드에서 성립한다', () => {
    const scores = scoreBySoftTags(MONOTONE_CATALOG, TEST_TAGS);
    scores.forEach((s, i) => {
      expect(s.score, `idx ${i}: score !== matchedTags.length`).toBe(s.matchedTags.length);
    });
  });

  it('점수 벡터가 0, 1, 2, 3, 4, 5 순으로 엄격 증가한다', () => {
    const scores = scoreBySoftTags(MONOTONE_CATALOG, TEST_TAGS);
    for (let i = 0; i < scores.length - 1; i++) {
      expect(
        scores[i].score,
        `idx ${i}(score=${scores[i].score}) >= idx ${i + 1}(score=${scores[i + 1].score}) 단조성 위반`,
      ).toBeLessThan(scores[i + 1].score);
    }
  });
});

// ===========================================================================
// 2. 랭크 단조성: score 내림차순 = 랭크 순서
// ===========================================================================

describe('softScoreMonotonicity - 랭크 단조성', () => {
  it('5개 매칭 키보드(idx5)가 1위이다', () => {
    const scores = scoreBySoftTags(MONOTONE_CATALOG, TEST_TAGS);
    const ranked = deriveRankOrder(scores);
    expect(ranked[0]).toBe(5);
  });

  it('4개 매칭 키보드(idx4)가 2위이다', () => {
    const scores = scoreBySoftTags(MONOTONE_CATALOG, TEST_TAGS);
    const ranked = deriveRankOrder(scores);
    expect(ranked[1]).toBe(4);
  });

  it('3개 매칭 키보드(idx3)가 3위이다', () => {
    const scores = scoreBySoftTags(MONOTONE_CATALOG, TEST_TAGS);
    const ranked = deriveRankOrder(scores);
    expect(ranked[2]).toBe(3);
  });

  it('2개 매칭 키보드(idx2)가 4위이다', () => {
    const scores = scoreBySoftTags(MONOTONE_CATALOG, TEST_TAGS);
    const ranked = deriveRankOrder(scores);
    expect(ranked[3]).toBe(2);
  });

  it('1개 매칭 키보드(idx1)가 5위이다', () => {
    const scores = scoreBySoftTags(MONOTONE_CATALOG, TEST_TAGS);
    const ranked = deriveRankOrder(scores);
    expect(ranked[4]).toBe(1);
  });

  it('0개 매칭 키보드(idx0)가 최하위이다', () => {
    const scores = scoreBySoftTags(MONOTONE_CATALOG, TEST_TAGS);
    const ranked = deriveRankOrder(scores);
    expect(ranked[ranked.length - 1]).toBe(0);
  });

  it('랭크 배열이 score 내림차순과 일치한다', () => {
    const scores = scoreBySoftTags(MONOTONE_CATALOG, TEST_TAGS);
    const ranked = deriveRankOrder(scores);

    // 순위 배열은 [5, 4, 3, 2, 1, 0]이어야 한다
    expect(ranked).toEqual([5, 4, 3, 2, 1, 0]);
  });

  it('연속한 두 순위에서 상위 랭크 키보드가 항상 더 높은 점수를 갖는다', () => {
    const scores = scoreBySoftTags(MONOTONE_CATALOG, TEST_TAGS);
    const ranked = deriveRankOrder(scores);

    for (let i = 0; i < ranked.length - 1; i++) {
      const higherRank = ranked[i];
      const lowerRank = ranked[i + 1];
      expect(
        scores[higherRank].score,
        `rank ${i}(score=${scores[higherRank].score}) should >= rank ${i + 1}(score=${scores[lowerRank].score})`,
      ).toBeGreaterThanOrEqual(scores[lowerRank].score);
    }
  });
});

// ===========================================================================
// 3. 엄격 단조성 불변식: score(A) > score(B) -> rank(A) < rank(B)
// ===========================================================================

describe('softScoreMonotonicity - 엄격 단조성 불변식', () => {
  it('점수가 다른 두 키보드는 점수가 높은 쪽이 더 앞 순위이다', () => {
    const scores = scoreBySoftTags(MONOTONE_CATALOG, TEST_TAGS);
    const ranked = deriveRankOrder(scores);

    // 모든 쌍 검증
    for (let a = 0; a < scores.length; a++) {
      for (let b = 0; b < scores.length; b++) {
        if (scores[a].score > scores[b].score) {
          const rankA = ranked.indexOf(a);
          const rankB = ranked.indexOf(b);
          expect(rankA, `score(${a})=${scores[a].score} > score(${b})=${scores[b].score} 이지만 rank(${a})=${rankA} >= rank(${b})=${rankB}`).toBeLessThan(rankB);
        }
      }
    }
  });

  it('태그 1개 추가 시 score가 정확히 1 증가한다 (가성비 추가)', () => {
    // idx1(1개 매칭)과 idx2(2개 매칭) 비교
    // idx2 = idx1 + 가성비 태그 만족
    const scores = scoreBySoftTags(MONOTONE_CATALOG, TEST_TAGS);
    expect(scores[2].score - scores[1].score).toBe(1);
  });

  it('태그 1개 추가 시 score가 정확히 1 증가한다 (무선 추가)', () => {
    // idx2(2개) vs idx3(3개): 무선 태그 추가
    const scores = scoreBySoftTags(MONOTONE_CATALOG, TEST_TAGS);
    expect(scores[3].score - scores[2].score).toBe(1);
  });

  it('태그 1개 추가 시 score가 정확히 1 증가한다 (멀티페어링 추가)', () => {
    // idx3(3개) vs idx4(4개): 멀티페어링 태그 추가
    const scores = scoreBySoftTags(MONOTONE_CATALOG, TEST_TAGS);
    expect(scores[4].score - scores[3].score).toBe(1);
  });

  it('태그 1개 추가 시 score가 정확히 1 증가한다 (가벼움 추가)', () => {
    // idx4(4개) vs idx5(5개): 가벼움 태그 추가
    const scores = scoreBySoftTags(MONOTONE_CATALOG, TEST_TAGS);
    expect(scores[5].score - scores[4].score).toBe(1);
  });
});

// ===========================================================================
// 4. 부분 태그 집합에서의 단조성
// ===========================================================================

describe('softScoreMonotonicity - 부분 태그 집합', () => {
  it('태그 2개(텐키리스, 가성비)만 사용해도 단조성이 유지된다', () => {
    const partialTags: SoftIntentTag[] = ['텐키리스', '가성비'];
    const scores = scoreBySoftTags(MONOTONE_CATALOG, partialTags);

    // idx0: 풀배열 + 비쌈 = 0점
    // idx1: 텐키리스 + 비쌈 = 1점
    // idx2: 텐키리스 + 저렴 = 2점
    // idx3: 텐키리스 + 저렴 = 2점
    // idx4: 텐키리스 + 저렴 = 2점
    // idx5: 텐키리스 + 저렴 = 2점
    expect(scores[0].score).toBe(0);
    expect(scores[1].score).toBe(1);
    expect(scores[2].score).toBe(2);
    expect(scores[3].score).toBe(2);
    expect(scores[4].score).toBe(2);
    expect(scores[5].score).toBe(2);

    // 점수 오름차순으로 단조성 확인
    expect(scores[0].score).toBeLessThan(scores[1].score);
    expect(scores[1].score).toBeLessThan(scores[2].score);
  });

  it('태그 1개만 사용 시 매칭/비매칭이 0/1 점으로 정확히 구분된다', () => {
    const singleTag: SoftIntentTag[] = ['무선'];
    const scores = scoreBySoftTags(MONOTONE_CATALOG, singleTag);

    // 무선인 키보드: idx3, idx4, idx5
    expect(scores[0].score).toBe(0); // 유선
    expect(scores[1].score).toBe(0); // 유선
    expect(scores[2].score).toBe(0); // 유선
    expect(scores[3].score).toBe(1); // 무선
    expect(scores[4].score).toBe(1); // 무선
    expect(scores[5].score).toBe(1); // 무선
  });

  it('태그 집합 크기와 무관하게 더 많이 겹치면 항상 높은 점수', () => {
    // 3개 태그로 테스트: ['텐키리스', '무선', '가벼움']
    const tags3: SoftIntentTag[] = ['텐키리스', '무선', '가벼움'];
    const scores = scoreBySoftTags(MONOTONE_CATALOG, tags3);

    // idx5(5개 매칭 키보드): 텐키리스 YES, 무선 YES, 가벼움 YES = 3점
    // idx4(4개 매칭 키보드): 텐키리스 YES, 무선 YES, 가벼움 NO = 2점
    // idx3(3개 매칭 키보드): 텐키리스 YES, 무선 YES, 가벼움 NO = 2점
    // idx2(2개 매칭 키보드): 텐키리스 YES, 무선 NO, 가벼움 NO = 1점
    // idx1(1개 매칭 키보드): 텐키리스 YES, 무선 NO, 가벼움 NO = 1점
    // idx0(0개 매칭 키보드): 텐키리스 NO, 무선 NO, 가벼움 NO = 0점
    expect(scores[5].score).toBe(3);
    expect(scores[4].score).toBe(2);
    expect(scores[3].score).toBe(2);
    expect(scores[2].score).toBe(1);
    expect(scores[1].score).toBe(1);
    expect(scores[0].score).toBe(0);

    // idx5가 1위이어야 한다
    const ranked = deriveRankOrder(scores);
    expect(ranked[0]).toBe(5);
  });
});

// ===========================================================================
// 5. 다른 태그 조합에서의 단조성 (게이밍 시나리오)
// ===========================================================================

describe('softScoreMonotonicity - 게이밍 시나리오 단조성', () => {
  // 게이밍 태그: ['기계식', '게이밍', 'RGB', '백라이트', '풀배열']
  // - 기계식: switch_type eq '기계식'
  // - 게이밍: switch_type eq '기계식' OR backlight contains 'RGB'
  // - RGB: backlight contains 'RGB'
  // - 백라이트: backlight contains '백라이트'
  // - 풀배열: layout eq '풀배열'
  //
  // 주의: '기계식'과 '게이밍'은 switch_type='기계식'에서 동시에 만족한다.

  const GAMING_TAGS: SoftIntentTag[] = ['기계식', '게이밍', 'RGB', '백라이트', '풀배열'];

  const GAMING_CATALOG: Keyboard[] = [
    // 0점: 멤브레인 텐키리스 유선 없음
    makeKeyboard({
      product_name: '0점-멤브레인-텐키리스',
      switch_type: '멤브레인',
      layout: '텐키리스',
      backlight: '없음',
    }),
    // 2점: 기계식(기계식+게이밍), 텐키리스
    makeKeyboard({
      product_name: '2점-기계식-텐키리스',
      switch_type: '기계식',   // 기계식 YES, 게이밍 YES
      layout: '텐키리스',       // 풀배열 NO
      backlight: '없음',        // RGB NO, 백라이트 NO
    }),
    // 3점: 기계식(기계식+게이밍) + 풀배열
    makeKeyboard({
      product_name: '3점-기계식-풀배열',
      switch_type: '기계식',   // 기계식 YES, 게이밍 YES
      layout: '풀배열',         // 풀배열 YES
      backlight: '없음',        // RGB NO, 백라이트 NO
    }),
    // 4점: 기계식(기계식+게이밍) + RGB(RGB+백라이트)
    makeKeyboard({
      product_name: '4점-기계식-텐키리스-RGB',
      switch_type: '기계식',      // 기계식 YES, 게이밍 YES
      layout: '텐키리스',          // 풀배열 NO
      backlight: 'RGB 백라이트',   // RGB YES, 백라이트 YES
    }),
    // 5점: 기계식(기계식+게이밍) + 풀배열 + RGB(RGB+백라이트)
    makeKeyboard({
      product_name: '5점-기계식-풀배열-RGB',
      switch_type: '기계식',      // 기계식 YES, 게이밍 YES
      layout: '풀배열',            // 풀배열 YES
      backlight: 'RGB 백라이트',   // RGB YES, 백라이트 YES
    }),
  ];

  it('각 키보드의 score가 설계대로 0, 2, 3, 4, 5 이다', () => {
    const scores = scoreBySoftTags(GAMING_CATALOG, GAMING_TAGS);
    expect(scores[0].score).toBe(0);
    expect(scores[1].score).toBe(2);
    expect(scores[2].score).toBe(3);
    expect(scores[3].score).toBe(4);
    expect(scores[4].score).toBe(5);
  });

  it('더 많이 겹치는 키보드가 더 높은 점수를 받는다 (엄격 증가)', () => {
    const scores = scoreBySoftTags(GAMING_CATALOG, GAMING_TAGS);
    // 0 < 2 < 3 < 4 < 5
    expect(scores[0].score).toBeLessThan(scores[1].score);
    expect(scores[1].score).toBeLessThan(scores[2].score);
    expect(scores[2].score).toBeLessThan(scores[3].score);
    expect(scores[3].score).toBeLessThan(scores[4].score);
  });

  it('5점 키보드(idx4)가 1위이다', () => {
    const scores = scoreBySoftTags(GAMING_CATALOG, GAMING_TAGS);
    const ranked = deriveRankOrder(scores);
    expect(ranked[0]).toBe(4);
  });

  it('0점 키보드(idx0)가 최하위이다', () => {
    const scores = scoreBySoftTags(GAMING_CATALOG, GAMING_TAGS);
    const ranked = deriveRankOrder(scores);
    expect(ranked[ranked.length - 1]).toBe(0);
  });

  it('점수 순서와 랭크 순서가 일치한다', () => {
    const scores = scoreBySoftTags(GAMING_CATALOG, GAMING_TAGS);
    const ranked = deriveRankOrder(scores);

    // ranked 배열이 [4, 3, 2, 1, 0] 이어야 한다 (score 내림차순)
    expect(ranked).toEqual([4, 3, 2, 1, 0]);
  });
});

// ===========================================================================
// 6. 사무용 시나리오 단조성
// ===========================================================================

describe('softScoreMonotonicity - 사무용 시나리오 단조성', () => {
  // 사무용 태그: ['사무용', '조용함', '저소음', '무접점', '텐키리스']
  // - 사무용: switch_type contains '무접점' OR eq '펜타그래프' OR eq '멤브레인' OR connection eq '유선'
  // - 조용함: switch_type contains '무접점' OR eq '펜타그래프' OR eq '멤브레인'
  // - 저소음: switch_type contains '무접점' OR eq '펜타그래프' OR eq '멤브레인'
  // - 무접점: switch_type contains '무접점'
  // - 텐키리스: layout eq '텐키리스'

  const OFFICE_TAGS: SoftIntentTag[] = ['사무용', '조용함', '저소음', '무접점', '텐키리스'];

  const OFFICE_CATALOG: Keyboard[] = [
    // 0점: 기계식 풀배열 무선 -> 사무용(무선, 기계식 아님)...
    // 사무용은 connection='유선'에서도 만족. 기계식 무선은 사무용 NO (기계식, 무선)
    makeKeyboard({
      product_name: '0점-기계식-풀배열-무선',
      switch_type: '기계식',
      layout: '풀배열',
      connection: '무선',
    }),
    // 1점: 기계식 텐키리스 무선 -> 텐키리스만 만족
    makeKeyboard({
      product_name: '1점-기계식-텐키리스-무선',
      switch_type: '기계식',
      layout: '텐키리스',   // 텐키리스 YES
      connection: '무선',   // 사무용(유선): NO
    }),
    // 2점: 기계식 텐키리스 유선 -> 텐키리스 + 사무용(유선)
    makeKeyboard({
      product_name: '2점-기계식-텐키리스-유선',
      switch_type: '기계식',
      layout: '텐키리스',   // 텐키리스 YES
      connection: '유선',   // 사무용 YES
    }),
    // 4점: 무접점 텐키리스 유선 -> 무접점+사무용+조용함+저소음 + 텐키리스
    // 사무용: 무접점 YES, 유선 YES -> 만족 (predicates OR)
    makeKeyboard({
      product_name: '4점-무접점-텐키리스-유선',
      switch_type: '무접점',
      layout: '텐키리스',   // 텐키리스 YES
      connection: '유선',   // 사무용 also YES (but already YES from 무접점)
    }),
  ];

  it('각 키보드의 score가 올바른 값이다', () => {
    const scores = scoreBySoftTags(OFFICE_CATALOG, OFFICE_TAGS);
    // idx0: 기계식 풀배열 무선 -> 사무용(기계식:NO, 펜타:NO, 멤브레인:NO, 유선:NO) = NO
    //         조용함: NO, 저소음: NO, 무접점: NO, 텐키리스: NO -> 0점
    expect(scores[0].score).toBe(0);

    // idx1: 기계식 텐키리스 무선 -> 사무용(유선:NO, 기계식:NO) = NO
    //         조용함: NO, 저소음: NO, 무접점: NO, 텐키리스: YES -> 1점
    expect(scores[1].score).toBe(1);

    // idx2: 기계식 텐키리스 유선 -> 사무용(유선: YES) = YES
    //         조용함: NO, 저소음: NO, 무접점: NO, 텐키리스: YES -> 2점
    expect(scores[2].score).toBe(2);

    // idx3: 무접점 텐키리스 유선 -> 사무용(무접점: YES) = YES
    //         조용함(무접점: YES) = YES, 저소음(무접점: YES) = YES
    //         무접점(무접점 contains '무접점': YES) = YES
    //         텐키리스: YES -> 5점
    expect(scores[3].score).toBe(5);
  });

  it('더 많이 겹치는 키보드가 더 높은 점수를 받는다', () => {
    const scores = scoreBySoftTags(OFFICE_CATALOG, OFFICE_TAGS);
    expect(scores[0].score).toBeLessThan(scores[1].score);
    expect(scores[1].score).toBeLessThan(scores[2].score);
    expect(scores[2].score).toBeLessThan(scores[3].score);
  });

  it('무접점 텐키리스 유선 키보드가 1위이다', () => {
    const scores = scoreBySoftTags(OFFICE_CATALOG, OFFICE_TAGS);
    const ranked = deriveRankOrder(scores);
    expect(ranked[0]).toBe(3);
  });

  it('기계식 풀배열 무선 키보드가 최하위이다', () => {
    const scores = scoreBySoftTags(OFFICE_CATALOG, OFFICE_TAGS);
    const ranked = deriveRankOrder(scores);
    expect(ranked[ranked.length - 1]).toBe(0);
  });
});

// ===========================================================================
// 7. 동점 처리 - 동점 시 keyboardIndex 오름차순
// ===========================================================================

describe('softScoreMonotonicity - 동점 처리', () => {
  it('점수가 같으면 keyboardIndex 오름차순으로 정렬된다', () => {
    // 모든 키보드가 동일한 점수를 받도록 설계
    const tiedCatalog: Keyboard[] = [
      makeKeyboard({ product_name: 'A', layout: '텐키리스' }), // idx 0: 텐키리스 1점
      makeKeyboard({ product_name: 'B', layout: '텐키리스' }), // idx 1: 텐키리스 1점
      makeKeyboard({ product_name: 'C', layout: '텐키리스' }), // idx 2: 텐키리스 1점
    ];

    const scores = scoreBySoftTags(tiedCatalog, ['텐키리스']);
    const ranked = deriveRankOrder(scores);

    // 모두 1점 -> keyboardIndex 오름차순
    expect(ranked).toEqual([0, 1, 2]);
  });

  it('점수가 같으면 낮은 인덱스가 더 앞 순위이다', () => {
    const sameCatalog: Keyboard[] = [
      makeKeyboard({ product_name: '고순위', layout: '텐키리스', price: 50000 }), // idx 0: 2점
      makeKeyboard({ product_name: '저순위', layout: '텐키리스', price: 50000 }), // idx 1: 2점
    ];

    const scores = scoreBySoftTags(sameCatalog, ['텐키리스', '가성비']);
    expect(scores[0].score).toBe(scores[1].score); // 동점 확인

    const ranked = deriveRankOrder(scores);
    expect(ranked[0]).toBe(0); // idx 0이 앞
    expect(ranked[1]).toBe(1); // idx 1이 뒤
  });

  it('혼합 점수 목록에서 동점 그룹 내 idx 오름차순이 유지된다', () => {
    // 5점, 5점, 3점, 3점, 1점 순서로 설계
    const mixedCatalog: Keyboard[] = [
      makeKeyboard({ layout: '텐키리스', price: 50000, connection: '무선', wireless_type: '블루투스', weight_g: 600 }), // idx0: 5점
      makeKeyboard({ layout: '텐키리스', price: 50000, connection: '무선', wireless_type: '블루투스', weight_g: 600 }), // idx1: 5점
      makeKeyboard({ layout: '텐키리스', price: 50000, connection: '유선', wireless_type: '유선', weight_g: 1000 }),    // idx2: 2점
      makeKeyboard({ layout: '텐키리스', price: 50000, connection: '유선', wireless_type: '유선', weight_g: 1000 }),    // idx3: 2점
      makeKeyboard({ layout: '풀배열',   price: 200000, connection: '유선', wireless_type: '유선', weight_g: 1000 }),   // idx4: 0점
    ];

    const scores = scoreBySoftTags(mixedCatalog, TEST_TAGS);
    // idx0, idx1: 텐키리스+가성비+무선+멀티페어링+가벼움 = 5점
    expect(scores[0].score).toBe(5);
    expect(scores[1].score).toBe(5);
    // idx2, idx3: 텐키리스+가성비 = 2점
    expect(scores[2].score).toBe(2);
    expect(scores[3].score).toBe(2);
    // idx4: 0점
    expect(scores[4].score).toBe(0);

    const ranked = deriveRankOrder(scores);
    // [0, 1, 2, 3, 4]: idx 오름차순 내 동점 그룹
    expect(ranked[0]).toBe(0);
    expect(ranked[1]).toBe(1);
    expect(ranked[2]).toBe(2);
    expect(ranked[3]).toBe(3);
    expect(ranked[4]).toBe(4);
  });
});

// ===========================================================================
// 8. 단조성 속성의 형식적 검증
// ===========================================================================

describe('softScoreMonotonicity - 형식적 단조성 속성', () => {
  it('임의 키보드 집합에서 score <= 태그 수 불변식이 항상 성립한다', () => {
    const tags = TEST_TAGS;
    const scores = scoreBySoftTags(MONOTONE_CATALOG, tags);
    scores.forEach((s) => {
      expect(s.score).toBeLessThanOrEqual(tags.length);
      expect(s.score).toBeGreaterThanOrEqual(0);
    });
  });

  it('태그를 추가해도 기존 키보드의 score가 감소하지 않는다', () => {
    const baseScores = scoreBySoftTags(MONOTONE_CATALOG, ['텐키리스', '가성비']);
    const extendedScores = scoreBySoftTags(MONOTONE_CATALOG, ['텐키리스', '가성비', '무선']);

    // 태그를 추가하면 점수가 감소하지 않아야 한다 (단조 증가)
    baseScores.forEach((base, i) => {
      expect(extendedScores[i].score).toBeGreaterThanOrEqual(base.score);
    });
  });

  it('태그를 제거하면 기존 키보드의 score가 증가하지 않는다', () => {
    const fullScores = scoreBySoftTags(MONOTONE_CATALOG, TEST_TAGS);
    const reducedScores = scoreBySoftTags(MONOTONE_CATALOG, ['텐키리스', '가성비']);

    // 태그를 제거하면 점수가 증가하지 않아야 한다 (단조 감소)
    fullScores.forEach((full, i) => {
      expect(reducedScores[i].score).toBeLessThanOrEqual(full.score);
    });
  });

  it('deriveRankOrder 결과는 항상 0..N-1 인덱스의 순열이다', () => {
    const scores = scoreBySoftTags(MONOTONE_CATALOG, TEST_TAGS);
    const ranked = deriveRankOrder(scores);

    const expected = new Set(MONOTONE_CATALOG.map((_, i) => i));
    expect(new Set(ranked)).toEqual(expected);
    expect(ranked).toHaveLength(MONOTONE_CATALOG.length);
  });

  it('빈 태그 집합이면 모든 키보드 score == 0 이고 랭크는 idx 오름차순이다', () => {
    const scores = scoreBySoftTags(MONOTONE_CATALOG, []);
    scores.forEach((s) => {
      expect(s.score).toBe(0);
    });

    const ranked = deriveRankOrder(scores);
    // 모두 0점이므로 idx 오름차순
    expect(ranked).toEqual([0, 1, 2, 3, 4, 5]);
  });
});
