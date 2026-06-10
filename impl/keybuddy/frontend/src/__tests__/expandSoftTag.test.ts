/**
 * expandSoftTag 단위 테스트 (Sub-AC 2b)
 *
 * 검증 대상: expandSoftTag(tag, ruleMap?) 함수
 *
 * 시나리오:
 * 1. Happy path - 골드셋 소프트 태그 각각을 입력했을 때 기대 속성 술어 배열 반환
 * 2. Unknown tag - 규칙표에 없는 미지 태그 입력 시 빈 배열([]) 반환
 * 3. 커스텀 ruleMap 주입 - 대체 맵 사용 시 올바른 값 반환
 * 4. 반환 배열 레퍼런스 - 동일 태그를 두 번 호출하면 동일 배열 참조 반환
 */

import { describe, it, expect } from 'vitest';
import { expandSoftTag, SOFT_TAG_RULE_MAP } from '../lib/softTagRules';
import type { AttributePredicate } from '../lib/softTagRules';
import { SOFT_INTENT_VOCAB } from '../lib/tagSchema';
import type { SoftIntentTag } from '../lib/tagSchema';

// ---------------------------------------------------------------------------
// 헬퍼 - 술어 배열 구조 검증
// ---------------------------------------------------------------------------

function isValidPredicate(pred: unknown): pred is AttributePredicate {
  if (!pred || typeof pred !== 'object') return false;
  const p = pred as Record<string, unknown>;
  return (
    typeof p['field'] === 'string' &&
    typeof p['op'] === 'string' &&
    ['eq', 'contains', 'lte', 'gte'].includes(p['op'] as string) &&
    (typeof p['value'] === 'string' || typeof p['value'] === 'number')
  );
}

// ---------------------------------------------------------------------------
// Happy path - 골드셋 소프트 태그별 기대 술어 검증
// ---------------------------------------------------------------------------

/**
 * 골드셋: 대표 use-case를 커버하는 소프트 태그와 기대 술어 스펙
 *
 * 각 항목:
 *   tag          - SOFT_INTENT_VOCAB의 소프트 의도 태그
 *   minCount     - 반환 배열의 최소 술어 수
 *   mustContain  - 반환 배열에 반드시 포함되어야 하는 술어(부분 구조)
 */
const GOLDSET_EXPECTATIONS: Array<{
  tag: SoftIntentTag;
  minCount: number;
  mustContain: Array<Partial<AttributePredicate> & { field: AttributePredicate['field'] }>;
}> = [
  {
    tag: '조용함',
    minCount: 1,
    mustContain: [
      { field: 'switch_type', op: 'contains', value: '무접점' },
      { field: 'switch_type', op: 'eq', value: '펜타그래프' },
      { field: 'switch_type', op: 'eq', value: '멤브레인' },
    ],
  },
  {
    tag: '저소음',
    minCount: 1,
    mustContain: [
      { field: 'switch_type', op: 'contains', value: '무접점' },
    ],
  },
  {
    tag: '고소음',
    minCount: 1,
    mustContain: [
      { field: 'switch_type', op: 'eq', value: '기계식' },
    ],
  },
  {
    tag: '경쾌함',
    minCount: 1,
    mustContain: [
      { field: 'switch_type', op: 'eq', value: '기계식' },
    ],
  },
  {
    tag: '사무용',
    minCount: 1,
    mustContain: [
      { field: 'switch_type', op: 'contains', value: '무접점' },
      { field: 'connection', op: 'eq', value: '유선' },
    ],
  },
  {
    tag: '게이밍',
    minCount: 1,
    mustContain: [
      { field: 'switch_type', op: 'eq', value: '기계식' },
      { field: 'backlight', op: 'contains', value: 'RGB' },
    ],
  },
  {
    tag: '휴대성',
    minCount: 1,
    mustContain: [
      { field: 'layout', op: 'eq', value: '텐키리스' },
      { field: 'layout', op: 'eq', value: '미니' },
      { field: 'connection', op: 'eq', value: '무선' },
      { field: 'weight_g', op: 'lte', value: 800 },
    ],
  },
  {
    tag: '가벼움',
    minCount: 1,
    mustContain: [
      { field: 'weight_g', op: 'lte', value: 800 },
    ],
  },
  {
    tag: '무거움',
    minCount: 1,
    mustContain: [
      { field: 'weight_g', op: 'gte', value: 900 },
    ],
  },
  {
    tag: '타건감',
    minCount: 1,
    mustContain: [
      { field: 'switch_type', op: 'eq', value: '기계식' },
    ],
  },
  {
    tag: 'RGB',
    minCount: 1,
    mustContain: [
      { field: 'backlight', op: 'contains', value: 'RGB' },
    ],
  },
  {
    tag: '백라이트',
    minCount: 1,
    mustContain: [
      { field: 'backlight', op: 'contains', value: '백라이트' },
    ],
  },
  {
    tag: '백라이트없음',
    minCount: 1,
    mustContain: [
      { field: 'backlight', op: 'eq', value: '없음' },
    ],
  },
  {
    tag: '무선',
    minCount: 1,
    mustContain: [
      { field: 'connection', op: 'eq', value: '무선' },
      { field: 'connection', op: 'eq', value: '유선+무선' },
    ],
  },
  {
    tag: '멀티페어링',
    minCount: 1,
    mustContain: [
      { field: 'wireless_type', op: 'contains', value: '블루투스' },
    ],
  },
  {
    tag: '가성비',
    minCount: 1,
    mustContain: [
      { field: 'price', op: 'lte', value: 100000 },
    ],
  },
  {
    tag: '기계식',
    minCount: 1,
    mustContain: [
      { field: 'switch_type', op: 'eq', value: '기계식' },
    ],
  },
  {
    tag: '무접점',
    minCount: 1,
    mustContain: [
      { field: 'switch_type', op: 'contains', value: '무접점' },
    ],
  },
  {
    tag: '펜타그래프',
    minCount: 1,
    mustContain: [
      { field: 'switch_type', op: 'eq', value: '펜타그래프' },
    ],
  },
  {
    tag: '한영각인',
    minCount: 1,
    mustContain: [
      { field: 'engraving', op: 'eq', value: '한/영 정각' },
    ],
  },
  {
    tag: '영문각인',
    minCount: 1,
    mustContain: [
      { field: 'engraving', op: 'eq', value: '영문 정각' },
    ],
  },
  {
    tag: '풀배열',
    minCount: 1,
    mustContain: [
      { field: 'layout', op: 'eq', value: '풀배열' },
    ],
  },
  {
    tag: '텐키리스',
    minCount: 1,
    mustContain: [
      { field: 'layout', op: 'eq', value: '텐키리스' },
    ],
  },
  {
    tag: '미니',
    minCount: 1,
    mustContain: [
      { field: 'layout', op: 'eq', value: '미니' },
    ],
  },
];

describe('expandSoftTag - happy path (골드셋 소프트 태그 전체)', () => {
  it('SOFT_INTENT_VOCAB의 모든 태그(24개)가 골드셋에 포함되어 있다', () => {
    const goldsetTags = new Set(GOLDSET_EXPECTATIONS.map((g) => g.tag));
    for (const vocab of SOFT_INTENT_VOCAB) {
      expect(goldsetTags.has(vocab), `골드셋에 "${vocab}" 포함`).toBe(true);
    }
  });

  for (const spec of GOLDSET_EXPECTATIONS) {
    describe(`태그 "${spec.tag}"`, () => {
      it('배열을 반환한다', () => {
        const result = expandSoftTag(spec.tag);
        expect(Array.isArray(result)).toBe(true);
      });

      it(`최소 ${spec.minCount}개 이상의 술어를 반환한다`, () => {
        const result = expandSoftTag(spec.tag);
        expect(result.length).toBeGreaterThanOrEqual(spec.minCount);
      });

      it('각 술어가 {field, op, value} 구조를 가진다', () => {
        const result = expandSoftTag(spec.tag);
        for (const pred of result) {
          expect(isValidPredicate(pred), `술어 ${JSON.stringify(pred)}가 유효한 구조`).toBe(true);
        }
      });

      for (const expected of spec.mustContain) {
        it(`{field: "${expected.field}", op: "${expected.op}", value: ${JSON.stringify(expected.value)}} 술어를 포함한다`, () => {
          const result = expandSoftTag(spec.tag);
          const found = result.some(
            (p) =>
              p.field === expected.field &&
              p.op === expected.op &&
              p.value === expected.value,
          );
          expect(
            found,
            `"${spec.tag}" 술어 배열에 {field:"${expected.field}",op:"${expected.op}",value:${JSON.stringify(expected.value)}}가 포함되어야 한다`,
          ).toBe(true);
        });
      }
    });
  }
});

// ---------------------------------------------------------------------------
// SOFT_TAG_RULE_MAP과 동일한 참조 반환 검증
// ---------------------------------------------------------------------------

describe('expandSoftTag - 반환 참조 일관성', () => {
  it('같은 태그로 두 번 호출하면 동일한 배열 참조를 반환한다', () => {
    const first = expandSoftTag('게이밍');
    const second = expandSoftTag('게이밍');
    expect(first).toBe(second);
  });

  it('반환 배열은 SOFT_TAG_RULE_MAP[tag]와 동일한 참조다', () => {
    for (const tag of SOFT_INTENT_VOCAB) {
      const expanded = expandSoftTag(tag);
      const direct = SOFT_TAG_RULE_MAP[tag];
      expect(expanded).toBe(direct);
    }
  });
});

// ---------------------------------------------------------------------------
// Unknown tag - 미지 태그 입력 시 빈 배열 반환
// ---------------------------------------------------------------------------

describe('expandSoftTag - 미지(unknown) 태그 폴백', () => {
  const unknownTags = [
    '',
    ' ',
    '조용함_extra',
    '게이밍2',
    'gaming',
    'quiet',
    '알수없는태그',
    '123',
    '!@#',
    'RGB_plus',
    'unknown',
    'undefined',
    'null',
    '풀배열풀배열',
    '\t',
    '\n',
  ];

  for (const tag of unknownTags) {
    it(`미지 태그 "${tag}" 입력 시 빈 배열([])을 반환한다`, () => {
      const result = expandSoftTag(tag);
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
      expect(result).toEqual([]);
    });
  }

  it('규칙표에 없는 임의 문자열에 대해 항상 빈 배열을 반환한다', () => {
    const arbitraryTags = ['abc', 'xyz', '한글아닌것', '0', 'false', '{}'];
    for (const tag of arbitraryTags) {
      expect(expandSoftTag(tag)).toEqual([]);
    }
  });

  it('SOFT_INTENT_VOCAB에 없는 값은 SOFT_TAG_RULE_MAP에도 없으므로 빈 배열이다', () => {
    // 스키마 밖 값이 폐기되는 것과 동일한 보장
    const nonVocab = '임의태그_not_in_vocab';
    const inVocab = (SOFT_INTENT_VOCAB as readonly string[]).includes(nonVocab);
    expect(inVocab).toBe(false);
    expect(expandSoftTag(nonVocab)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 커스텀 ruleMap 주입 - 의존성 역전 검증
// ---------------------------------------------------------------------------

describe('expandSoftTag - 커스텀 ruleMap 주입', () => {
  const customPred: AttributePredicate = { field: 'switch_type', op: 'eq', value: '기계식' };
  const customMap: Record<string, AttributePredicate[]> = {
    테스트태그: [customPred],
  };

  it('커스텀 맵에 있는 태그는 해당 술어 배열을 반환한다', () => {
    const result = expandSoftTag('테스트태그', customMap);
    expect(result).toEqual([customPred]);
  });

  it('커스텀 맵에 없는 태그는 빈 배열을 반환한다', () => {
    const result = expandSoftTag('기계식', customMap);
    expect(result).toEqual([]);
  });

  it('빈 커스텀 맵에서 모든 태그는 빈 배열을 반환한다', () => {
    for (const tag of SOFT_INTENT_VOCAB) {
      expect(expandSoftTag(tag, {})).toEqual([]);
    }
  });

  it('커스텀 맵의 빈 술어 배열도 그대로 반환한다', () => {
    const mapWithEmpty: Record<string, AttributePredicate[]> = { 빈태그: [] };
    const result = expandSoftTag('빈태그', mapWithEmpty);
    expect(result).toEqual([]);
    expect(Array.isArray(result)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 결정론성 - 동일 입력 항상 동일 출력
// ---------------------------------------------------------------------------

describe('expandSoftTag - 결정론성', () => {
  it('동일한 태그를 여러 번 호출해도 항상 동일한 결과를 반환한다', () => {
    const tags: SoftIntentTag[] = ['조용함', '게이밍', '가성비', '무선', '기계식'];
    for (const tag of tags) {
      const results = Array.from({ length: 5 }, () => expandSoftTag(tag));
      for (let i = 1; i < results.length; i++) {
        expect(results[i]).toBe(results[0]); // 동일 참조
      }
    }
  });

  it('미지 태그도 여러 번 호출하면 항상 빈 배열을 반환한다', () => {
    const unknownTag = '존재하지않는태그';
    const results = Array.from({ length: 3 }, () => expandSoftTag(unknownTag));
    for (const result of results) {
      expect(result).toEqual([]);
    }
  });
});
