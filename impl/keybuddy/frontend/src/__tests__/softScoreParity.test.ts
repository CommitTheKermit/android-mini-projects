/**
 * Sub-AC 2-3-b: softScoreParity 단위 테스트
 *
 * 선택 변환 소프트태그와 자유형 소프트태그를 scoreBySoftTags에 전달했을 때
 * 동일한 점수 순위가 산출되는지 검증한다.
 *
 * 검증 전략:
 * 1. 선택 경로: guidedAnswersToSoftTags(answers) -> SoftIntentTag[]
 * 2. 자유형 경로: sanitizeTags({ hardConstraints: {}, softIntentTags: [...] }) -> SoftIntentTag[]
 * 3. 두 태그 집합을 scoreBySoftTags(CATALOG, tags)에 전달
 * 4. 키보드별 점수(score)가 모두 일치하는지 확인
 * 5. deriveRankOrder로 산출한 순위 배열이 동일한지 확인
 *
 * 각 시나리오에서 선택 경로와 자유형 경로가 동일 의도를 표현한다.
 * LLM 호출 없이 순수 함수만 사용한다.
 */

import { describe, it, expect } from 'vitest';
import { scoreBySoftTags, deriveRankOrder, type KeyboardScore } from '../lib/softScorer';
import { SOFT_INTENT_VOCAB } from '../lib/tagSchema';
import {
  guidedAnswersToSoftTags,
  PURPOSE_OPTIONS,
  SOUND_OPTIONS,
  KEY_FEEL_OPTIONS,
  CONNECTION_OPTIONS,
  LAYOUT_OPTIONS,
  BACKLIGHT_OPTIONS,
  PORTABILITY_OPTIONS,
  KEY_FORCE_OPTIONS,
  ENGRAVING_OPTIONS,
} from '../lib/guidedInputMapper';
import { sanitizeTags } from '../lib/extractRawTags';
import type { Keyboard } from '../types';
import type { SoftIntentTag } from '../lib/tagSchema';

// ---------------------------------------------------------------------------
// 테스트용 키보드 카탈로그 픽스처
// ---------------------------------------------------------------------------

function makeKeyboard(overrides: Partial<Keyboard>): Keyboard {
  return {
    product_name: '기본 키보드',
    brand: '테스트브랜드',
    price: 100000,
    image_url: '',
    switch_type: '기계식',
    connection: '유선',
    layout: '텐키리스',
    key_force: '45g',
    weight_g: 800,
    wireless_type: '유선',
    engraving: '한/영 정각',
    backlight: '없음',
    ...overrides,
  };
}

/**
 * 다양한 속성 조합으로 구성된 카탈로그.
 * 각 소프트 태그가 서로 다른 키보드에 다르게 매핑되도록 설계한다.
 */
const CATALOG: Keyboard[] = [
  // idx 0: 기계식 + 풀배열 + 유선 + RGB + 10만 + 1200g
  makeKeyboard({
    product_name: '기계식-풀배열-유선-RGB-10만',
    switch_type: '기계식',
    layout: '풀배열',
    connection: '유선',
    backlight: 'RGB 백라이트',
    price: 100000,
    weight_g: 1200,
    wireless_type: '유선',
    engraving: '영문 정각',
  }),
  // idx 1: 무접점 + 텐키리스 + 무선(블루투스) + 없음 + 20만 + 600g
  makeKeyboard({
    product_name: '무접점-텐키리스-무선-없음-20만',
    switch_type: '무접점',
    layout: '텐키리스',
    connection: '무선',
    backlight: '없음',
    price: 200000,
    weight_g: 600,
    wireless_type: '블루투스',
    engraving: '한/영 정각',
  }),
  // idx 2: 펜타그래프 + 풀배열 + 유선 + 단색 + 5만 + 900g
  makeKeyboard({
    product_name: '펜타그래프-풀배열-유선-단색-5만',
    switch_type: '펜타그래프',
    layout: '풀배열',
    connection: '유선',
    backlight: '단색 백라이트',
    price: 50000,
    weight_g: 900,
    wireless_type: '유선',
    engraving: '한/영 정각',
  }),
  // idx 3: 기계식 + 미니 + 무선(USB동글) + 없음 + 7만 + 550g
  makeKeyboard({
    product_name: '기계식-미니-동글-없음-7만',
    switch_type: '기계식',
    layout: '미니',
    connection: '무선',
    backlight: '없음',
    price: 70000,
    weight_g: 550,
    wireless_type: '전용동글(리시버)',
    engraving: '영문 정각',
  }),
  // idx 4: 무접점 자석축 + 풀배열 + 유선 + 없음 + 15만 + 1000g
  makeKeyboard({
    product_name: '무접점자석축-풀배열-유선-없음-15만',
    switch_type: '무접점 자석축',
    layout: '풀배열',
    connection: '유선',
    backlight: '없음',
    price: 150000,
    weight_g: 1000,
    wireless_type: '유선',
    engraving: '한/영 정각',
  }),
  // idx 5: 기계식 + 텐키리스 + 유선+무선 + RGB + 18만 + 750g
  makeKeyboard({
    product_name: '기계식-텐키리스-유무선-RGB-18만',
    switch_type: '기계식',
    layout: '텐키리스',
    connection: '유선+무선',
    backlight: 'RGB 백라이트',
    price: 180000,
    weight_g: 750,
    wireless_type: '블루투스',
    engraving: '영문 정각',
  }),
  // idx 6: 멤브레인 + 풀배열 + 유선 + 없음 + 3만 + 950g
  makeKeyboard({
    product_name: '멤브레인-풀배열-유선-없음-3만',
    switch_type: '멤브레인',
    layout: '풀배열',
    connection: '유선',
    backlight: '없음',
    price: 30000,
    weight_g: 950,
    wireless_type: '유선',
    engraving: '한/영 정각',
  }),
];

// ---------------------------------------------------------------------------
// 헬퍼: 두 점수 벡터를 비교하는 유틸 함수
// ---------------------------------------------------------------------------

/**
 * 두 KeyboardScore[] 벡터의 점수(score)가 인덱스별로 모두 일치하는지 확인한다.
 * matchedTags 순서는 무시하고 포함 여부(집합)만 비교한다.
 */
function assertScoreVectorEqual(
  vectorA: KeyboardScore[],
  vectorB: KeyboardScore[],
  desc: string,
): void {
  expect(vectorA.length, `[${desc}] 벡터 길이 불일치`).toBe(vectorB.length);
  vectorA.forEach((a, i) => {
    const b = vectorB[i];
    expect(a.keyboardIndex, `[${desc}] index[${i}] 불일치`).toBe(b.keyboardIndex);
    expect(a.score, `[${desc}] score[${i}] 불일치 (선택:${a.score} vs 자유형:${b.score})`).toBe(
      b.score,
    );
    // matchedTags 집합 동일성 검증 (순서 무관)
    expect(
      new Set(a.matchedTags),
      `[${desc}] matchedTags[${i}] 집합 불일치`,
    ).toEqual(new Set(b.matchedTags));
  });
}

/**
 * 두 점수 벡터로 산출한 순위 배열이 동일한지 확인한다.
 */
function assertRankOrderEqual(
  vectorA: KeyboardScore[],
  vectorB: KeyboardScore[],
  desc: string,
): void {
  const rankA = deriveRankOrder(vectorA);
  const rankB = deriveRankOrder(vectorB);
  expect(rankA, `[${desc}] 순위 배열 불일치`).toEqual(rankB);
}

// ===========================================================================
// 시나리오 1: 사무용 + 조용함
// ===========================================================================

describe('softScoreParity - 사무용+조용함 시나리오', () => {
  // 선택 경로: 용도=사무용, 소리=매우 조용함
  // -> guidedAnswersToSoftTags: ['사무용', '조용함', '저소음']
  // 자유형 경로 시뮬레이션: '조용한 사무용 키보드 추천해줘'
  // -> LLM 추출 후 sanitizeTags: ['사무용', '조용함', '저소음']

  it('선택 경로 태그와 자유형 경로 태그가 동일 집합이다', () => {
    const selectionTags = guidedAnswersToSoftTags({
      용도: PURPOSE_OPTIONS.OFFICE,
      소리: SOUND_OPTIONS.VERY_QUIET,
    });
    const freeformExtracted = sanitizeTags({
      hardConstraints: {},
      softIntentTags: ['사무용', '조용함', '저소음'],
    });
    expect(new Set(selectionTags)).toEqual(new Set(freeformExtracted.softIntentTags));
  });

  it('두 경로의 스코어 벡터가 키보드별로 일치한다', () => {
    const selectionTags = guidedAnswersToSoftTags({
      용도: PURPOSE_OPTIONS.OFFICE,
      소리: SOUND_OPTIONS.VERY_QUIET,
    });
    const freeformTags = sanitizeTags({
      hardConstraints: {},
      softIntentTags: ['사무용', '조용함', '저소음'],
    }).softIntentTags;

    const selectionScores = scoreBySoftTags(CATALOG, selectionTags);
    const freeformScores = scoreBySoftTags(CATALOG, freeformTags);

    assertScoreVectorEqual(selectionScores, freeformScores, '사무용+조용함');
  });

  it('두 경로의 순위 배열이 일치한다', () => {
    const selectionTags = guidedAnswersToSoftTags({
      용도: PURPOSE_OPTIONS.OFFICE,
      소리: SOUND_OPTIONS.VERY_QUIET,
    });
    const freeformTags = sanitizeTags({
      hardConstraints: {},
      softIntentTags: ['사무용', '조용함', '저소음'],
    }).softIntentTags;

    const selectionScores = scoreBySoftTags(CATALOG, selectionTags);
    const freeformScores = scoreBySoftTags(CATALOG, freeformTags);

    assertRankOrderEqual(selectionScores, freeformScores, '사무용+조용함 순위');
  });

  it('무접점/펜타그래프/멤브레인/유선 키보드가 기계식+무선보다 높은 점수를 받는다', () => {
    const tags = guidedAnswersToSoftTags({
      용도: PURPOSE_OPTIONS.OFFICE,
      소리: SOUND_OPTIONS.VERY_QUIET,
    });
    const scores = scoreBySoftTags(CATALOG, tags);

    // idx 1: 무접점 텐키리스 무선 -> 사무용(무접점), 조용함(무접점), 저소음(무접점) = 3점
    // idx 0: 기계식 풀배열 유선 -> 사무용(유선), 조용함(no), 저소음(no) = 1점
    // idx 3: 기계식 미니 무선 -> 사무용(no, 무선이고 기계식), 조용함(no), 저소음(no) = 0점
    expect(scores[1].score).toBeGreaterThan(scores[0].score);
    expect(scores[0].score).toBeGreaterThan(scores[3].score);
  });
});

// ===========================================================================
// 시나리오 2: 게이밍 + RGB
// ===========================================================================

describe('softScoreParity - 게이밍+RGB 시나리오', () => {
  it('선택 경로 태그와 자유형 경로 태그가 동일 집합이다', () => {
    const selectionTags = guidedAnswersToSoftTags({
      용도: PURPOSE_OPTIONS.GAMING,
      백라이트: BACKLIGHT_OPTIONS.RGB,
    });
    const freeformTags = sanitizeTags({
      hardConstraints: {},
      softIntentTags: ['게이밍', 'RGB', '백라이트'],
    }).softIntentTags;

    expect(new Set(selectionTags)).toEqual(new Set(freeformTags));
  });

  it('두 경로의 스코어 벡터가 키보드별로 일치한다', () => {
    const selectionTags = guidedAnswersToSoftTags({
      용도: PURPOSE_OPTIONS.GAMING,
      백라이트: BACKLIGHT_OPTIONS.RGB,
    });
    const freeformTags = sanitizeTags({
      hardConstraints: {},
      softIntentTags: ['게이밍', 'RGB', '백라이트'],
    }).softIntentTags;

    const selectionScores = scoreBySoftTags(CATALOG, selectionTags);
    const freeformScores = scoreBySoftTags(CATALOG, freeformTags);

    assertScoreVectorEqual(selectionScores, freeformScores, '게이밍+RGB');
  });

  it('두 경로의 순위 배열이 일치한다', () => {
    const selectionTags = guidedAnswersToSoftTags({
      용도: PURPOSE_OPTIONS.GAMING,
      백라이트: BACKLIGHT_OPTIONS.RGB,
    });
    const freeformTags = sanitizeTags({
      hardConstraints: {},
      softIntentTags: ['게이밍', 'RGB', '백라이트'],
    }).softIntentTags;

    assertRankOrderEqual(
      scoreBySoftTags(CATALOG, selectionTags),
      scoreBySoftTags(CATALOG, freeformTags),
      '게이밍+RGB 순위',
    );
  });

  it('RGB 백라이트 키보드가 높은 점수를 받는다', () => {
    const tags: SoftIntentTag[] = ['게이밍', 'RGB', '백라이트'];
    const scores = scoreBySoftTags(CATALOG, tags);

    // idx 0: 기계식 풀배열 RGB -> 게이밍(기계식/RGB), RGB(RGB), 백라이트(RGB포함) = 3점
    // idx 5: 기계식 텐키리스 유무선 RGB -> 게이밍(기계식/RGB), RGB(RGB), 백라이트(RGB포함) = 3점
    // idx 1: 무접점 텐키리스 없음 -> 게이밍(no), RGB(no), 백라이트(no) = 0점
    expect(scores[0].score).toBe(3);
    expect(scores[5].score).toBe(3);
    expect(scores[1].score).toBe(0);
  });
});

// ===========================================================================
// 시나리오 3: 무선 + 미니 + 휴대성
// ===========================================================================

describe('softScoreParity - 무선+미니+휴대성 시나리오', () => {
  it('선택 경로 태그와 자유형 경로 태그가 동일 집합이다', () => {
    const selectionTags = guidedAnswersToSoftTags({
      연결방식: CONNECTION_OPTIONS.BLUETOOTH,
      크기: LAYOUT_OPTIONS.MINI,
      휴대성: PORTABILITY_OPTIONS.PORTABLE,
    });
    const freeformTags = sanitizeTags({
      hardConstraints: {},
      softIntentTags: ['무선', '멀티페어링', '미니', '휴대성', '가벼움'],
    }).softIntentTags;

    expect(new Set(selectionTags)).toEqual(new Set(freeformTags));
  });

  it('두 경로의 스코어 벡터가 키보드별로 일치한다', () => {
    const selectionTags = guidedAnswersToSoftTags({
      연결방식: CONNECTION_OPTIONS.BLUETOOTH,
      크기: LAYOUT_OPTIONS.MINI,
      휴대성: PORTABILITY_OPTIONS.PORTABLE,
    });
    const freeformTags = sanitizeTags({
      hardConstraints: {},
      softIntentTags: ['무선', '멀티페어링', '미니', '휴대성', '가벼움'],
    }).softIntentTags;

    const selectionScores = scoreBySoftTags(CATALOG, selectionTags);
    const freeformScores = scoreBySoftTags(CATALOG, freeformTags);

    assertScoreVectorEqual(selectionScores, freeformScores, '무선+미니+휴대성');
  });

  it('두 경로의 순위 배열이 일치한다', () => {
    const selectionTags = guidedAnswersToSoftTags({
      연결방식: CONNECTION_OPTIONS.BLUETOOTH,
      크기: LAYOUT_OPTIONS.MINI,
      휴대성: PORTABILITY_OPTIONS.PORTABLE,
    });
    const freeformTags = sanitizeTags({
      hardConstraints: {},
      softIntentTags: ['무선', '멀티페어링', '미니', '휴대성', '가벼움'],
    }).softIntentTags;

    assertRankOrderEqual(
      scoreBySoftTags(CATALOG, selectionTags),
      scoreBySoftTags(CATALOG, freeformTags),
      '무선+미니+휴대성 순위',
    );
  });

  it('미니 레이아웃 기계식 무선 키보드(idx3)가 높은 점수를 받는다', () => {
    const tags: SoftIntentTag[] = ['무선', '멀티페어링', '미니', '휴대성', '가벼움'];
    const scores = scoreBySoftTags(CATALOG, tags);

    // idx 3: 기계식 미니 무선(동글) 없음 7만 550g
    // - 무선(connection=무선) YES
    // - 멀티페어링(wireless_type contains 블루투스) NO(동글)
    // - 미니(layout=미니) YES
    // - 휴대성(layout=미니 or layout=텐키리스 or 무선 or weight<=800) YES(미니, 무선, 550g)
    // - 가벼움(weight<=800) YES(550g)
    // score = 4
    expect(scores[3].score).toBe(4);

    // idx 0: 기계식 풀배열 유선 RGB 1200g
    // - 무선: NO(유선)
    // - 멀티페어링: NO
    // - 미니: NO
    // - 휴대성: NO(풀배열, 유선, 1200g>800)
    // - 가벼움: NO(1200g)
    // score = 0
    expect(scores[0].score).toBe(0);
  });
});

// ===========================================================================
// 시나리오 4: 기계식 + 타건감 + 경쾌함
// ===========================================================================

describe('softScoreParity - 기계식+타건감+경쾌함 시나리오', () => {
  it('선택 경로(또각또각) 태그와 자유형 경로 태그가 동일 집합이다', () => {
    const selectionTags = guidedAnswersToSoftTags({
      키감: KEY_FEEL_OPTIONS.TACTILE,
    });
    const freeformTags = sanitizeTags({
      hardConstraints: {},
      softIntentTags: ['기계식', '타건감', '경쾌함'],
    }).softIntentTags;

    expect(new Set(selectionTags)).toEqual(new Set(freeformTags));
  });

  it('두 경로의 스코어 벡터가 키보드별로 일치한다', () => {
    const selectionTags = guidedAnswersToSoftTags({ 키감: KEY_FEEL_OPTIONS.TACTILE });
    const freeformTags = sanitizeTags({
      hardConstraints: {},
      softIntentTags: ['기계식', '타건감', '경쾌함'],
    }).softIntentTags;

    const selectionScores = scoreBySoftTags(CATALOG, selectionTags);
    const freeformScores = scoreBySoftTags(CATALOG, freeformTags);

    assertScoreVectorEqual(selectionScores, freeformScores, '기계식+타건감+경쾌함');
  });

  it('두 경로의 순위 배열이 일치한다', () => {
    const selectionTags = guidedAnswersToSoftTags({ 키감: KEY_FEEL_OPTIONS.TACTILE });
    const freeformTags = sanitizeTags({
      hardConstraints: {},
      softIntentTags: ['기계식', '타건감', '경쾌함'],
    }).softIntentTags;

    assertRankOrderEqual(
      scoreBySoftTags(CATALOG, selectionTags),
      scoreBySoftTags(CATALOG, freeformTags),
      '기계식+타건감+경쾌함 순위',
    );
  });

  it('서걱서걱(기계식+타건감)과 또각또각(기계식+타건감+경쾌함) 간 점수 차이가 반영된다', () => {
    const tactileTags = guidedAnswersToSoftTags({ 키감: KEY_FEEL_OPTIONS.TACTILE }); // ['기계식', '타건감', '경쾌함']
    const linearTags = guidedAnswersToSoftTags({ 키감: KEY_FEEL_OPTIONS.LINEAR });   // ['기계식', '타건감']

    const tactileScores = scoreBySoftTags(CATALOG, tactileTags);
    const linearScores = scoreBySoftTags(CATALOG, linearTags);

    // 기계식 키보드(idx 0, 3, 5)는 또각또각에서 더 높거나 같은 점수를 받는다
    // (경쾌함 태그가 추가로 기계식에 매핑되므로)
    const kbIdx = [0, 3, 5]; // 기계식 키보드들
    kbIdx.forEach((i) => {
      expect(tactileScores[i].score).toBeGreaterThanOrEqual(linearScores[i].score);
    });

    // 기계식이 아닌 키보드(idx 1: 무접점, idx 2: 펜타그래프)는
    // 또각또각과 서걱서걱 모두에서 낮은 점수를 받는다
    expect(tactileScores[1].score).toBe(0);
    expect(linearScores[1].score).toBe(0);
  });
});

// ===========================================================================
// 시나리오 5: 무접점 + 조용함
// ===========================================================================

describe('softScoreParity - 무접점+조용함 시나리오', () => {
  it('선택 경로(보글보글) 태그와 자유형 경로 태그가 동일 집합이다', () => {
    const selectionTags = guidedAnswersToSoftTags({ 키감: KEY_FEEL_OPTIONS.TOPRE });
    const freeformTags = sanitizeTags({
      hardConstraints: {},
      softIntentTags: ['무접점', '타건감', '조용함'],
    }).softIntentTags;

    expect(new Set(selectionTags)).toEqual(new Set(freeformTags));
  });

  it('두 경로의 스코어 벡터가 키보드별로 일치한다', () => {
    const selectionTags = guidedAnswersToSoftTags({ 키감: KEY_FEEL_OPTIONS.TOPRE });
    const freeformTags = sanitizeTags({
      hardConstraints: {},
      softIntentTags: ['무접점', '타건감', '조용함'],
    }).softIntentTags;

    const selectionScores = scoreBySoftTags(CATALOG, selectionTags);
    const freeformScores = scoreBySoftTags(CATALOG, freeformTags);

    assertScoreVectorEqual(selectionScores, freeformScores, '무접점+조용함');
  });

  it('두 경로의 순위 배열이 일치한다', () => {
    const selectionTags = guidedAnswersToSoftTags({ 키감: KEY_FEEL_OPTIONS.TOPRE });
    const freeformTags = sanitizeTags({
      hardConstraints: {},
      softIntentTags: ['무접점', '타건감', '조용함'],
    }).softIntentTags;

    assertRankOrderEqual(
      scoreBySoftTags(CATALOG, selectionTags),
      scoreBySoftTags(CATALOG, freeformTags),
      '무접점+조용함 순위',
    );
  });

  it('무접점 키보드가 최상위 순위에 위치한다', () => {
    const tags: SoftIntentTag[] = ['무접점', '타건감', '조용함'];
    const scores = scoreBySoftTags(CATALOG, tags);
    const ranked = deriveRankOrder(scores);

    // idx 1(무접점 텐키리스): switch_type='무접점'
    //   - 무접점('무접점'.includes('무접점')) YES
    //   - 타건감: eq 기계식(NO), contains '무접점 자석축'('무접점'.includes('무접점 자석축')=NO),
    //             contains '무접점 광축'('무접점'.includes('무접점 광축')=NO) -> NO
    //   - 조용함('무접점'.includes('무접점')) YES
    //   score = 2
    //
    // idx 4(무접점 자석축 풀배열): switch_type='무접점 자석축'
    //   - 무접점('무접점 자석축'.includes('무접점')) YES
    //   - 타건감('무접점 자석축'.includes('무접점 자석축')) YES
    //   - 조용함('무접점 자석축'.includes('무접점')) YES
    //   score = 3
    expect(scores[1].score).toBe(2);
    expect(scores[4].score).toBe(3);

    // 기계식(idx 0): 무접점 NO, 타건감(기계식) YES, 조용함 NO = 1점
    expect(scores[0].score).toBe(1);

    // 무접점 자석축(idx 4)이 1위, 무접점 단순(idx 1)이 2위
    expect(ranked[0]).toBe(4);
    expect(ranked[1]).toBe(1);
  });
});

// ===========================================================================
// 시나리오 6: 가성비 + 풀배열
// ===========================================================================

describe('softScoreParity - 가성비+풀배열 시나리오', () => {
  it('두 경로의 스코어 벡터가 키보드별로 일치한다', () => {
    // 선택 경로: 크기=풀배열, 예산에서 파생되는 가성비 소프트태그는
    // guidedAnswersToSoftTags에서 직접 생성되지 않으므로
    // 자유형 경로와 비교할 수 있는 태그 집합을 직접 구성한다
    const selectionTags: SoftIntentTag[] = ['풀배열'];
    const selectionScores = scoreBySoftTags(CATALOG, selectionTags);

    const freeformTags = sanitizeTags({
      hardConstraints: {},
      softIntentTags: ['풀배열'],
    }).softIntentTags;
    const freeformScores = scoreBySoftTags(CATALOG, freeformTags);

    assertScoreVectorEqual(selectionScores, freeformScores, '풀배열');
  });

  it('가성비 태그: 두 경로의 스코어 벡터가 일치한다', () => {
    const selectionTags: SoftIntentTag[] = ['가성비'];
    const selectionScores = scoreBySoftTags(CATALOG, selectionTags);

    const freeformTags = sanitizeTags({
      hardConstraints: {},
      softIntentTags: ['가성비'],
    }).softIntentTags;
    const freeformScores = scoreBySoftTags(CATALOG, freeformTags);

    assertScoreVectorEqual(selectionScores, freeformScores, '가성비');
  });

  it('10만원 이하 키보드만 가성비 점수를 받는다', () => {
    const tags: SoftIntentTag[] = ['가성비'];
    const scores = scoreBySoftTags(CATALOG, tags);

    // idx 0: 10만원 (=100000) -> 가성비(lte 100000) YES = 1점
    // idx 2: 5만원 -> 가성비 YES = 1점
    // idx 3: 7만원 -> 가성비 YES = 1점
    // idx 6: 3만원 -> 가성비 YES = 1점
    // idx 1: 20만원 -> 가성비 NO = 0점
    // idx 4: 15만원 -> 가성비 NO = 0점
    // idx 5: 18만원 -> 가성비 NO = 0점
    expect(scores[0].score).toBe(1); // 100000 <= 100000
    expect(scores[2].score).toBe(1);
    expect(scores[3].score).toBe(1);
    expect(scores[6].score).toBe(1);
    expect(scores[1].score).toBe(0);
    expect(scores[4].score).toBe(0);
    expect(scores[5].score).toBe(0);
  });
});

// ===========================================================================
// 시나리오 7: 복합 - 전체 단계 입력
// ===========================================================================

describe('softScoreParity - 복합 전체 단계 시나리오', () => {
  it('사무용 전체 단계: 두 경로의 스코어 벡터가 일치한다', () => {
    const answers = {
      용도: PURPOSE_OPTIONS.OFFICE,
      휴대성: PORTABILITY_OPTIONS.DESK,
      소리: SOUND_OPTIONS.VERY_QUIET,
      키감: KEY_FEEL_OPTIONS.TOPRE,
      키압: KEY_FORCE_OPTIONS.LIGHT,
      연결방식: CONNECTION_OPTIONS.WIRED,
      크기: LAYOUT_OPTIONS.TKL,
      각인: ENGRAVING_OPTIONS.BOTH,
      백라이트: BACKLIGHT_OPTIONS.NONE,
    };
    const selectionTags = guidedAnswersToSoftTags(answers);
    // 자유형 경로: 동일한 의도로 추출된 태그 집합
    const freeformTags = sanitizeTags({
      hardConstraints: {},
      softIntentTags: selectionTags, // 동일 태그 집합
    }).softIntentTags;

    const selectionScores = scoreBySoftTags(CATALOG, selectionTags);
    const freeformScores = scoreBySoftTags(CATALOG, freeformTags);

    assertScoreVectorEqual(selectionScores, freeformScores, '사무용 전체 단계');
    assertRankOrderEqual(selectionScores, freeformScores, '사무용 전체 단계 순위');
  });

  it('게이밍 전체 단계: 두 경로의 스코어 벡터가 일치한다', () => {
    const answers = {
      용도: PURPOSE_OPTIONS.GAMING,
      소리: SOUND_OPTIONS.LOUD,
      키감: KEY_FEEL_OPTIONS.TACTILE,
      키압: KEY_FORCE_OPTIONS.HEAVY,
      연결방식: CONNECTION_OPTIONS.WIRED,
      크기: LAYOUT_OPTIONS.FULL,
      백라이트: BACKLIGHT_OPTIONS.RGB,
    };
    const selectionTags = guidedAnswersToSoftTags(answers);
    const freeformTags = sanitizeTags({
      hardConstraints: {},
      softIntentTags: selectionTags,
    }).softIntentTags;

    const selectionScores = scoreBySoftTags(CATALOG, selectionTags);
    const freeformScores = scoreBySoftTags(CATALOG, freeformTags);

    assertScoreVectorEqual(selectionScores, freeformScores, '게이밍 전체 단계');
    assertRankOrderEqual(selectionScores, freeformScores, '게이밍 전체 단계 순위');
  });

  it('휴대용 블루투스 미니: 두 경로의 스코어 벡터가 일치한다', () => {
    const answers = {
      휴대성: PORTABILITY_OPTIONS.PORTABLE,
      연결방식: CONNECTION_OPTIONS.BLUETOOTH,
      크기: LAYOUT_OPTIONS.MINI,
      백라이트: BACKLIGHT_OPTIONS.NONE,
    };
    const selectionTags = guidedAnswersToSoftTags(answers);
    const freeformTags = sanitizeTags({
      hardConstraints: {},
      softIntentTags: selectionTags,
    }).softIntentTags;

    assertScoreVectorEqual(
      scoreBySoftTags(CATALOG, selectionTags),
      scoreBySoftTags(CATALOG, freeformTags),
      '휴대용 블루투스 미니',
    );
  });
});

// ===========================================================================
// 결정론성: 동일 태그 집합 -> 항상 동일 점수 벡터
// ===========================================================================

describe('softScoreParity - 결정론성 검증', () => {
  it('동일 태그 집합을 세 번 호출해도 항상 동일한 벡터를 반환한다', () => {
    const tags: SoftIntentTag[] = ['사무용', '조용함', '저소음', '무접점'];
    const s1 = scoreBySoftTags(CATALOG, tags);
    const s2 = scoreBySoftTags(CATALOG, tags);
    const s3 = scoreBySoftTags(CATALOG, tags);

    expect(s1).toEqual(s2);
    expect(s2).toEqual(s3);
  });

  it('태그 순서가 달라도 점수(score)는 동일하다', () => {
    const tagsA: SoftIntentTag[] = ['게이밍', 'RGB', '백라이트'];
    const tagsB: SoftIntentTag[] = ['백라이트', '게이밍', 'RGB']; // 순서 변경

    const scoresA = scoreBySoftTags(CATALOG, tagsA);
    const scoresB = scoreBySoftTags(CATALOG, tagsB);

    scoresA.forEach((a, i) => {
      expect(a.score).toBe(scoresB[i].score);
    });
  });

  it('선택 경로와 자유형 경로가 동일 태그 집합을 생성할 때 순위가 동일하다', () => {
    // 여러 시나리오에서 일관성 확인
    const scenarios: Array<{ answers: Record<string, string>; softTags: SoftIntentTag[] }> = [
      {
        answers: { 용도: PURPOSE_OPTIONS.OFFICE },
        softTags: ['사무용'],
      },
      {
        answers: { 소리: SOUND_OPTIONS.VERY_QUIET },
        softTags: ['조용함', '저소음'],
      },
      {
        answers: { 용도: PURPOSE_OPTIONS.GAMING, 백라이트: BACKLIGHT_OPTIONS.RGB },
        softTags: ['게이밍', 'RGB', '백라이트'],
      },
      {
        answers: { 연결방식: CONNECTION_OPTIONS.BLUETOOTH, 크기: LAYOUT_OPTIONS.MINI },
        softTags: ['무선', '멀티페어링', '미니', '휴대성'],
      },
    ];

    for (const { answers, softTags } of scenarios) {
      const selectionTags = guidedAnswersToSoftTags(answers);
      const freeformTags = sanitizeTags({
        hardConstraints: {},
        softIntentTags: softTags,
      }).softIntentTags;

      // 집합 동일성 확인
      expect(
        new Set(selectionTags),
        `answers=${JSON.stringify(answers)}: 태그 집합 불일치`,
      ).toEqual(new Set(freeformTags));

      // 점수 벡터 동일성 확인
      const selectionScores = scoreBySoftTags(CATALOG, selectionTags);
      const freeformScores = scoreBySoftTags(CATALOG, freeformTags);

      selectionScores.forEach((s, i) => {
        expect(
          s.score,
          `answers=${JSON.stringify(answers)}: 키보드[${i}] 점수 불일치`,
        ).toBe(freeformScores[i].score);
      });

      // 순위 배열 동일성 확인
      expect(
        deriveRankOrder(selectionScores),
        `answers=${JSON.stringify(answers)}: 순위 불일치`,
      ).toEqual(deriveRankOrder(freeformScores));
    }
  });
});

// ===========================================================================
// scoreBySoftTags 기본 동작 검증
// ===========================================================================

describe('scoreBySoftTags 기본 동작', () => {
  it('빈 태그 집합 -> 모든 키보드 점수 0', () => {
    const scores = scoreBySoftTags(CATALOG, []);
    scores.forEach((s) => {
      expect(s.score).toBe(0);
      expect(s.matchedTags).toEqual([]);
    });
  });

  it('빈 카탈로그 -> 빈 벡터 반환', () => {
    const scores = scoreBySoftTags([], ['사무용']);
    expect(scores).toEqual([]);
  });

  it('결과 벡터 길이가 카탈로그 길이와 같다', () => {
    const scores = scoreBySoftTags(CATALOG, ['게이밍', 'RGB']);
    expect(scores).toHaveLength(CATALOG.length);
  });

  it('keyboardIndex가 0부터 순서대로 할당된다', () => {
    const scores = scoreBySoftTags(CATALOG, ['사무용']);
    scores.forEach((s, i) => {
      expect(s.keyboardIndex).toBe(i);
    });
  });

  it('matchedTags는 SOFT_INTENT_VOCAB 내 값만 포함한다', () => {
    const vocab = new Set(SOFT_INTENT_VOCAB as unknown as string[]);
    const scores = scoreBySoftTags(CATALOG, ['게이밍', 'RGB', '무선', '휴대성']);
    scores.forEach((s) => {
      s.matchedTags.forEach((tag) => {
        expect(vocab.has(tag)).toBe(true);
      });
    });
  });

  it('score === matchedTags.length 가 항상 성립한다', () => {
    const scores = scoreBySoftTags(CATALOG, ['사무용', '조용함', '저소음', 'RGB', '무선']);
    scores.forEach((s) => {
      expect(s.score).toBe(s.matchedTags.length);
    });
  });

  it('LLM 호출 없이 동기 함수로 동작한다', () => {
    const result = scoreBySoftTags(CATALOG, ['게이밍']);
    expect(result).not.toBeInstanceOf(Promise);
    expect(Array.isArray(result)).toBe(true);
  });
});

// ===========================================================================
// deriveRankOrder 검증
// ===========================================================================

describe('deriveRankOrder', () => {
  it('점수 높은 키보드가 앞에 위치한다', () => {
    const tags: SoftIntentTag[] = ['사무용', '조용함', '저소음'];
    const scores = scoreBySoftTags(CATALOG, tags);
    const ranked = deriveRankOrder(scores);

    // 첫 번째 순위 키보드의 점수가 마지막보다 크거나 같아야 한다
    expect(scores[ranked[0]].score).toBeGreaterThanOrEqual(scores[ranked[ranked.length - 1]].score);
  });

  it('동점이면 keyboardIndex 오름차순이다', () => {
    const tags: SoftIntentTag[] = ['풀배열']; // 풀배열 키보드(idx 0, 2, 4, 6)가 모두 1점
    const scores = scoreBySoftTags(CATALOG, tags);
    const ranked = deriveRankOrder(scores);

    // 1점 키보드들 (idx 0, 2, 4, 6) 중 idx 오름차순 정렬되어야 함
    const idx1ScoreKbs = scores.filter((s) => s.score === 1).map((s) => s.keyboardIndex);
    const idx0ScoreKbs = scores.filter((s) => s.score === 0).map((s) => s.keyboardIndex);

    // ranked 앞부분이 1점, 뒷부분이 0점
    const rankedTop = ranked.slice(0, idx1ScoreKbs.length);
    const rankedBottom = ranked.slice(idx1ScoreKbs.length);

    expect(new Set(rankedTop)).toEqual(new Set(idx1ScoreKbs));
    expect(new Set(rankedBottom)).toEqual(new Set(idx0ScoreKbs));

    // 동점 내에서 idx 오름차순
    for (let i = 0; i < rankedTop.length - 1; i++) {
      expect(rankedTop[i]).toBeLessThan(rankedTop[i + 1]);
    }
  });

  it('결과 배열 길이가 입력 벡터 길이와 같다', () => {
    const scores = scoreBySoftTags(CATALOG, ['게이밍']);
    const ranked = deriveRankOrder(scores);
    expect(ranked).toHaveLength(scores.length);
  });

  it('결과 배열은 0..N-1의 모든 인덱스를 포함한다 (순열)', () => {
    const scores = scoreBySoftTags(CATALOG, ['게이밍', 'RGB']);
    const ranked = deriveRankOrder(scores);
    const expectedIndices = new Set(scores.map((s) => s.keyboardIndex));
    expect(new Set(ranked)).toEqual(expectedIndices);
  });
});
