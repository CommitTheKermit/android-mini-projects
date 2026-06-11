/**
 * Sub-AC 7-1: 결과 객체 매칭 소프트태그 결정론 단위 테스트
 *
 * 검증 대상: getMatchedSoftTags(keyboard, softTags)
 * - 쿼리 소프트태그 집합과 키보드 속성을 입력받아 교집합 태그 배열을 반환한다
 * - 동일 입력에 항상 동일 출력 (결정론)
 * - 입력 softTags 순서를 보존하여 반환
 * - LLM 호출 없이 순수 함수로 동작
 *
 * 전략:
 * 1. 정확한 교집합 반환 - 매칭/비매칭 구분
 * 2. 빈 입력 처리
 * 3. 전체 매칭, 전체 불매칭 극단 케이스
 * 4. 결정론성: 동일 입력을 여러 번 호출해 항상 동일 출력임을 검증
 * 5. 순서 보존: 입력 softTags 순서와 동일한 순서로 반환
 * 6. 스키마 밖 값 -> 매칭 없음 (규칙표에 없으므로 false)
 * 7. scoreBySoftTags 와 결과 일관성 - 같은 키보드/태그에 대해 matchedTags 동일
 */

import { describe, it, expect } from 'vitest';
import { getMatchedSoftTags, scoreBySoftTags } from '../lib/softScorer';
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
// 1. 기본 교집합 반환
// ---------------------------------------------------------------------------

describe('getMatchedSoftTags - 기본 교집합', () => {
  it('매칭 태그만 반환한다 - 단일 태그 매칭', () => {
    const kb = makeKeyboard({ layout: '텐키리스' });
    const result = getMatchedSoftTags(kb, ['텐키리스', '가성비']);
    expect(result).toContain('텐키리스');
    expect(result).not.toContain('가성비');
    expect(result).toHaveLength(1);
  });

  it('여러 태그가 매칭될 때 모두 반환한다', () => {
    const kb = makeKeyboard({
      layout: '텐키리스',
      price: 50000,
      connection: '무선',
    });
    const result = getMatchedSoftTags(kb, ['텐키리스', '가성비', '무선', 'RGB']);
    expect(new Set(result)).toEqual(new Set(['텐키리스', '가성비', '무선']));
    expect(result).toHaveLength(3);
    expect(result).not.toContain('RGB');
  });

  it('아무것도 매칭되지 않으면 빈 배열을 반환한다', () => {
    const kb = makeKeyboard({
      layout: '풀배열',
      price: 300000,
      connection: '유선',
      backlight: '없음',
    });
    const result = getMatchedSoftTags(kb, ['텐키리스', '가성비', '무선', 'RGB']);
    expect(result).toHaveLength(0);
    expect(result).toEqual([]);
  });

  it('모든 태그가 매칭될 때 전체를 반환한다', () => {
    const kb = makeKeyboard({
      layout: '텐키리스',
      price: 50000,
      connection: '무선',
      wireless_type: '블루투스',
      weight_g: 600,
    });
    const tags: SoftIntentTag[] = ['텐키리스', '가성비', '무선', '멀티페어링', '가벼움'];
    const result = getMatchedSoftTags(kb, tags);
    expect(new Set(result)).toEqual(new Set(tags));
    expect(result).toHaveLength(5);
  });
});

// ---------------------------------------------------------------------------
// 2. 빈 입력 처리
// ---------------------------------------------------------------------------

describe('getMatchedSoftTags - 빈 입력', () => {
  it('소프트 태그 집합이 비어 있으면 항상 빈 배열을 반환한다', () => {
    const kb = makeKeyboard({ layout: '텐키리스', price: 50000 });
    const result = getMatchedSoftTags(kb, []);
    expect(result).toEqual([]);
  });

  it('빈 softTags 는 어떤 키보드에서도 빈 배열을 반환한다', () => {
    const keyboards = [
      makeKeyboard({ layout: '텐키리스' }),
      makeKeyboard({ layout: '풀배열', price: 50000 }),
      makeKeyboard({ connection: '무선', switch_type: '기계식' }),
    ];
    for (const kb of keyboards) {
      expect(getMatchedSoftTags(kb, [])).toEqual([]);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. 결정론성 - 동일 입력 -> 항상 동일 출력
// ---------------------------------------------------------------------------

describe('getMatchedSoftTags - 결정론성', () => {
  it('동일 입력으로 여러 번 호출해도 항상 동일 배열을 반환한다', () => {
    const kb = makeKeyboard({
      layout: '텐키리스',
      price: 50000,
      connection: '무선',
    });
    const tags: SoftIntentTag[] = ['텐키리스', '가성비', '무선', 'RGB', '기계식'];

    const results = Array.from({ length: 10 }, () => getMatchedSoftTags(kb, tags));

    // 모든 호출 결과가 첫 번째 결과와 동일해야 한다
    for (const r of results) {
      expect(r).toEqual(results[0]);
    }
  });

  it('서로 다른 두 호출이 동일 내용의 배열을 반환한다 (참조 독립성)', () => {
    const kb = makeKeyboard({ layout: '텐키리스', backlight: 'RGB 백라이트' });
    const tags: SoftIntentTag[] = ['텐키리스', 'RGB', '백라이트', '무선'];

    const r1 = getMatchedSoftTags(kb, tags);
    const r2 = getMatchedSoftTags(kb, tags);

    expect(r1).not.toBe(r2); // 서로 다른 배열 참조
    expect(r1).toEqual(r2);   // 동일 내용
  });

  it('입력 배열 순서가 같으면 동일한 순서로 반환한다 (순서 결정론)', () => {
    const kb = makeKeyboard({
      layout: '텐키리스',
      price: 50000,
      connection: '무선',
    });
    const tags: SoftIntentTag[] = ['가성비', '무선', '텐키리스'];

    const r1 = getMatchedSoftTags(kb, tags);
    const r2 = getMatchedSoftTags(kb, tags);

    expect(r1).toEqual(r2);
    // 순서까지 동일해야 함 (toEqual은 순서 포함 비교)
  });

  it('입력 배열이 변경되어도 이미 반환된 결과에 영향을 주지 않는다 (불변성)', () => {
    const kb = makeKeyboard({ layout: '텐키리스', price: 50000 });
    const tags: SoftIntentTag[] = ['텐키리스', '가성비'];

    const result = getMatchedSoftTags(kb, tags);
    const snapshot = [...result];

    // 입력 배열 변경 시도 (결과에 영향 없어야 함)
    tags.push('무선');

    expect(result).toEqual(snapshot);
  });
});

// ---------------------------------------------------------------------------
// 4. 순서 보존 - 입력 softTags 순서와 동일한 순서로 반환
// ---------------------------------------------------------------------------

describe('getMatchedSoftTags - 순서 보존', () => {
  it('입력 softTags 순서와 동일한 순서로 매칭 태그를 반환한다', () => {
    const kb = makeKeyboard({
      layout: '텐키리스',
      price: 50000,
      connection: '무선',
    });
    const tags: SoftIntentTag[] = ['무선', '가성비', '텐키리스'];
    const result = getMatchedSoftTags(kb, tags);

    // 입력 순서: ['무선', '가성비', '텐키리스'] -> 모두 매칭이므로 그 순서 그대로 반환
    expect(result[0]).toBe('무선');
    expect(result[1]).toBe('가성비');
    expect(result[2]).toBe('텐키리스');
  });

  it('일부만 매칭될 때 입력 순서에서 매칭된 항목만 순서 유지', () => {
    const kb = makeKeyboard({
      layout: '텐키리스',
      connection: '무선',
    });
    // 입력 순서: RGB, 텐키리스, 기계식, 무선
    // RGB: NO (없음), 텐키리스: YES, 기계식: NO (멤브레인), 무선: YES
    const tags: SoftIntentTag[] = ['RGB', '텐키리스', '기계식', '무선'];
    const result = getMatchedSoftTags(kb, tags);

    expect(result).toHaveLength(2);
    expect(result[0]).toBe('텐키리스'); // 입력에서 먼저 나온 것
    expect(result[1]).toBe('무선');      // 입력에서 나중에 나온 것
  });

  it('순서가 다른 동일 태그 집합은 다른 순서의 결과를 반환한다', () => {
    const kb = makeKeyboard({
      layout: '텐키리스',
      price: 50000,
      connection: '무선',
    });

    const tagsAbc: SoftIntentTag[] = ['텐키리스', '가성비', '무선'];
    const tagsCba: SoftIntentTag[] = ['무선', '가성비', '텐키리스'];

    const resultAbc = getMatchedSoftTags(kb, tagsAbc);
    const resultCba = getMatchedSoftTags(kb, tagsCba);

    // 집합은 동일하지만 순서가 다름
    expect(new Set(resultAbc)).toEqual(new Set(resultCba));
    expect(resultAbc).not.toEqual(resultCba);
    expect(resultAbc[0]).toBe('텐키리스');
    expect(resultCba[0]).toBe('무선');
  });
});

// ---------------------------------------------------------------------------
// 5. 다양한 속성 매칭 검증
// ---------------------------------------------------------------------------

describe('getMatchedSoftTags - 다양한 속성 매칭', () => {
  it('기계식 키보드는 기계식/게이밍 태그와 매칭된다', () => {
    const kb = makeKeyboard({ switch_type: '기계식' });
    const result = getMatchedSoftTags(kb, ['기계식', '게이밍', '무접점']);
    expect(result).toContain('기계식');
    expect(result).toContain('게이밍');
    expect(result).not.toContain('무접점');
  });

  it('RGB 백라이트 키보드는 RGB/백라이트 태그와 매칭된다', () => {
    const kb = makeKeyboard({ backlight: 'RGB 백라이트' });
    const result = getMatchedSoftTags(kb, ['RGB', '백라이트', '백라이트없음']);
    expect(result).toContain('RGB');
    expect(result).toContain('백라이트');
    expect(result).not.toContain('백라이트없음');
  });

  it('무접점 키보드는 무접점/조용함/사무용 태그와 매칭된다', () => {
    const kb = makeKeyboard({ switch_type: '무접점' });
    const result = getMatchedSoftTags(kb, ['무접점', '조용함', '사무용', '게이밍']);
    expect(result).toContain('무접점');
    expect(result).toContain('조용함');
    expect(result).toContain('사무용');
    expect(result).not.toContain('게이밍');
  });

  it('블루투스 무선 키보드는 멀티페어링/무선 태그와 매칭된다', () => {
    const kb = makeKeyboard({
      connection: '무선',
      wireless_type: '블루투스',
    });
    const result = getMatchedSoftTags(kb, ['무선', '멀티페어링', '텐키리스']);
    expect(result).toContain('무선');
    expect(result).toContain('멀티페어링');
    expect(result).not.toContain('텐키리스');
  });

  it('가벼운 키보드(800g 이하)는 가벼움 태그와 매칭된다', () => {
    const lightKb = makeKeyboard({ weight_g: 700 });
    const heavyKb = makeKeyboard({ weight_g: 900 });

    expect(getMatchedSoftTags(lightKb, ['가벼움'])).toContain('가벼움');
    expect(getMatchedSoftTags(heavyKb, ['가벼움'])).not.toContain('가벼움');
  });
});

// ---------------------------------------------------------------------------
// 6. scoreBySoftTags 와 결과 일관성
// ---------------------------------------------------------------------------

describe('getMatchedSoftTags - scoreBySoftTags 일관성', () => {
  it('scoreBySoftTags의 matchedTags 와 getMatchedSoftTags 결과가 동일하다', () => {
    const kb = makeKeyboard({
      layout: '텐키리스',
      price: 50000,
      connection: '무선',
      wireless_type: '블루투스',
      weight_g: 600,
    });
    const tags: SoftIntentTag[] = ['텐키리스', '가성비', '무선', '멀티페어링', '가벼움', 'RGB'];

    const scoreResult = scoreBySoftTags([kb], tags);
    const matchedResult = getMatchedSoftTags(kb, tags);

    // score == matchedTags.length
    expect(scoreResult[0].score).toBe(matchedResult.length);
    // 집합이 동일 (순서는 다를 수 있음)
    expect(new Set(scoreResult[0].matchedTags)).toEqual(new Set(matchedResult));
  });

  it('여러 키보드에 대해 scoreBySoftTags와 getMatchedSoftTags 결과가 일치한다', () => {
    const keyboards = [
      makeKeyboard({ layout: '텐키리스' }),
      makeKeyboard({ layout: '텐키리스', price: 50000 }),
      makeKeyboard({ layout: '풀배열', price: 50000, connection: '무선' }),
    ];
    const tags: SoftIntentTag[] = ['텐키리스', '가성비', '무선'];

    const scoreResults = scoreBySoftTags(keyboards, tags);

    keyboards.forEach((kb, i) => {
      const matchedResult = getMatchedSoftTags(kb, tags);
      expect(scoreResults[i].score).toBe(matchedResult.length);
      expect(new Set(scoreResults[i].matchedTags)).toEqual(new Set(matchedResult));
    });
  });
});

// ---------------------------------------------------------------------------
// 7. 결정론 - 순수 함수 속성
// ---------------------------------------------------------------------------

describe('getMatchedSoftTags - 순수 함수 속성', () => {
  it('호출이 키보드 객체를 변경하지 않는다 (부수효과 없음)', () => {
    const kb = makeKeyboard({ layout: '텐키리스', price: 50000 });
    const snapshot = JSON.stringify(kb);

    getMatchedSoftTags(kb, ['텐키리스', '가성비', '무선']);

    expect(JSON.stringify(kb)).toBe(snapshot);
  });

  it('호출이 softTags 배열을 변경하지 않는다 (부수효과 없음)', () => {
    const kb = makeKeyboard({ layout: '텐키리스' });
    const tags: SoftIntentTag[] = ['텐키리스', '가성비', '무선'];
    const snapshot = [...tags];

    getMatchedSoftTags(kb, tags);

    expect(tags).toEqual(snapshot);
  });

  it('100회 반복 호출에서 모두 동일한 결과를 반환한다', () => {
    const kb = makeKeyboard({
      layout: '텐키리스',
      price: 50000,
      connection: '무선',
      backlight: 'RGB 백라이트',
      switch_type: '기계식',
    });
    const tags: SoftIntentTag[] = ['텐키리스', '가성비', '무선', 'RGB', '백라이트', '기계식', '게이밍', '무접점'];

    const first = getMatchedSoftTags(kb, tags);
    for (let i = 0; i < 99; i++) {
      expect(getMatchedSoftTags(kb, tags)).toEqual(first);
    }
  });
});
