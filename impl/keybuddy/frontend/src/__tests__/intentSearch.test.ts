/**
 * intentSearch 단위 테스트
 *
 * AC6 (확장된 하드 위반 0건 + 소프트 랭킹), AC5 (다중 의도 모순시 완화),
 * 완화 우선순위(필수 태그 -> 명시 하드), 결정론 검증.
 */

import { describe, it, expect } from 'vitest';
import rawCatalog from '../data/keyboards.json';
import type { Keyboard } from '../types';
import {
  searchWithProfile,
  filterByRequiredTags,
  satisfiesRequiredTags,
} from '../lib/intentSearch';
import { expandIntents } from '../lib/intentProfile';
import type { ExpandedTags } from '../lib/intentProfile';

const catalog = rawCatalog as Keyboard[];

function expanded(partial: Partial<ExpandedTags>): ExpandedTags {
  return {
    hardConstraints: partial.hardConstraints ?? {},
    requiredTags: partial.requiredTags ?? [],
    softIntentTags: partial.softIntentTags ?? [],
  };
}

// ---------------------------------------------------------------------------
// filterByRequiredTags
// ---------------------------------------------------------------------------

describe('filterByRequiredTags', () => {
  it("'저소음' 필수: 결과는 모두 저소음 술어를 만족한다(무접점/펜타그래프/멤브레인)", () => {
    const filtered = filterByRequiredTags(catalog, ['저소음']);
    expect(filtered.length).toBeGreaterThan(0);
    for (const kb of filtered) {
      expect(satisfiesRequiredTags(kb, ['저소음'])).toBe(true);
    }
    // 기계식(저소음 아님)은 제외됨
    expect(filtered.every((kb) => kb.switch_type !== '기계식')).toBe(true);
  });

  it('빈 필수 목록은 전체를 그대로 반환한다', () => {
    expect(filterByRequiredTags(catalog, [])).toHaveLength(catalog.length);
  });

  it('원본 배열을 변경하지 않는다', () => {
    const before = catalog.length;
    filterByRequiredTags(catalog, ['기계식']);
    expect(catalog.length).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// AC6 - 확장된 하드 위반 0건 + 소프트 랭킹
// ---------------------------------------------------------------------------

describe('AC6 - searchWithProfile 하드 위반 0건 + 소프트 점수', () => {
  it('사무용 확장: 모든 결과가 필수(저소음)를 만족하고 완화 없음', () => {
    const out = searchWithProfile(expandIntents({ intents: ['사무용'], explicit: { hardConstraints: {}, softIntentTags: [] } }), catalog);
    expect(out.results.length).toBeGreaterThan(0);
    expect(out.isFallback).toBe(false);
    for (const r of out.results) {
      expect(satisfiesRequiredTags(r.keyboard, ['저소음'])).toBe(true);
    }
  });

  it('점수는 내림차순으로 정렬된다', () => {
    const out = searchWithProfile(
      expanded({ requiredTags: ['저소음'], softIntentTags: ['백라이트없음', '한영각인'] }),
      catalog,
    );
    for (let i = 1; i < out.results.length; i++) {
      expect(out.results[i - 1].score).toBeGreaterThanOrEqual(out.results[i].score);
    }
  });

  it('명시 하드 + 필수 태그를 동시에 만족 (예산 + 저소음)', () => {
    const out = searchWithProfile(
      expanded({ hardConstraints: { price_max: 150000 }, requiredTags: ['저소음'] }),
      catalog,
    );
    expect(out.isFallback).toBe(false);
    for (const r of out.results) {
      expect(r.keyboard.price).toBeLessThanOrEqual(150000);
      expect(satisfiesRequiredTags(r.keyboard, ['저소음'])).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// AC5 - 다중 의도 모순 시 완화
// ---------------------------------------------------------------------------

describe('AC5 - 필수 모순 시 완화', () => {
  it('저소음 + 기계식(모순)은 결과 0 -> 필수 완화로 근접 반환', () => {
    const out = searchWithProfile(expanded({ requiredTags: ['저소음', '기계식'] }), catalog);
    expect(out.results.length).toBeGreaterThan(0);
    expect(out.isFallback).toBe(true);
    // 첫 단위(저소음)부터 완화 -> 결과는 모두 기계식
    expect(out.relaxedConstraints).toContain('저소음');
    expect(out.results.every((r) => r.keyboard.switch_type === '기계식')).toBe(true);
  });

  it('사무용+게이밍 확장은 필수 모순(저소음+기계식)으로 완화된다', () => {
    const out = searchWithProfile(
      expandIntents({ intents: ['사무용', '게이밍'], explicit: { hardConstraints: {}, softIntentTags: [] } }),
      catalog,
    );
    expect(out.results.length).toBeGreaterThan(0);
    expect(out.isFallback).toBe(true);
    expect(out.relaxationStepCount).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 완화 우선순위: 의도 파생 필수 태그를 명시 하드보다 먼저 완화
// ---------------------------------------------------------------------------

describe('완화 우선순위 (필수 태그 -> 명시 하드)', () => {
  it('필수(저소음) + 명시 하드(switch_type=기계식) 모순 -> 필수를 먼저 완화', () => {
    const out = searchWithProfile(
      expanded({ hardConstraints: { switch_type: '기계식' }, requiredTags: ['저소음'] }),
      catalog,
    );
    expect(out.results.length).toBeGreaterThan(0);
    expect(out.isFallback).toBe(true);
    // 의도 파생 필수(저소음)가 완화되고, 명시 하드(switch_type)는 유지됨
    expect(out.relaxedConstraints).toContain('저소음');
    expect(out.relaxedConstraints).not.toContain('switch_type');
    expect(out.results.every((r) => r.keyboard.switch_type === '기계식')).toBe(true);
  });

  it('명시 하드만 과제약(price_max=5000)이면 하드 키를 완화한다', () => {
    const out = searchWithProfile(expanded({ hardConstraints: { price_max: 5000 } }), catalog);
    expect(out.results.length).toBeGreaterThan(0);
    expect(out.isFallback).toBe(true);
    expect(out.relaxedConstraints).toContain('price_max');
  });
});

// ---------------------------------------------------------------------------
// 결정론
// ---------------------------------------------------------------------------

describe('searchWithProfile 결정론', () => {
  it('동일 입력 -> 동일 결과 인덱스', () => {
    const e = expanded({ hardConstraints: { price_max: 120000 }, requiredTags: ['저소음'], softIntentTags: ['백라이트없음'] });
    const a = searchWithProfile(e, catalog).results.map((r) => r.keyboardIndex);
    const b = searchWithProfile(e, catalog).results.map((r) => r.keyboardIndex);
    expect(a).toEqual(b);
  });
});
