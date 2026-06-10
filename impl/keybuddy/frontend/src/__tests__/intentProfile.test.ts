/**
 * intentProfile 단위 테스트
 *
 * AC1 (완전성), AC3 (필수->하드/선호->소프트/상관없음 확장),
 * AC4 (명시 우선), AC5 (다중 의도 합집합) 검증.
 */

import { describe, it, expect } from 'vitest';
import {
  INTENT_VOCABULARY,
  INTENT_PROFILE_TABLE,
  isIntentTag,
  checkIntentProfileCompleteness,
  expandIntents,
  dimensionsOfExplicit,
  type IntentProfile,
} from '../lib/intentProfile';
import type { ExtractedTags } from '../lib/extractRawTags';

function explicit(
  hardConstraints: ExtractedTags['hardConstraints'] = {},
  softIntentTags: ExtractedTags['softIntentTags'] = [],
): ExtractedTags {
  return { hardConstraints, softIntentTags };
}

// ---------------------------------------------------------------------------
// AC1 - 완전성
// ---------------------------------------------------------------------------

describe('AC1 - 의도 어휘/프로파일 완전성', () => {
  it('모든 통제 의도가 최소 1개 차원 요구를 가진다', () => {
    expect(checkIntentProfileCompleteness()).toEqual([]);
  });

  it('각 의도 요구는 필수/선호/상관없음 강도와 (상관없음 외) 태그를 가진다', () => {
    for (const profile of INTENT_PROFILE_TABLE) {
      expect(profile.requirements.length).toBeGreaterThan(0);
      for (const req of profile.requirements) {
        expect(['필수', '선호', '상관없음']).toContain(req.strength);
        if (req.strength !== '상관없음') {
          expect(req.tag).toBeTruthy();
        }
      }
    }
  });

  it('프로파일 문서의 모든 의도는 통제 어휘에 속한다', () => {
    for (const p of INTENT_PROFILE_TABLE) {
      expect(isIntentTag(p.intent)).toBe(true);
    }
  });

  it('요구가 없는 의도가 있으면 완전성 검사가 그 의도를 반환한다', () => {
    const broken: IntentProfile[] = [{ intent: '사무용', requirements: [] }];
    expect(checkIntentProfileCompleteness(['사무용'], broken)).toEqual(['사무용']);
  });
});

// ---------------------------------------------------------------------------
// AC3 - 확장: 필수->하드(required), 선호->소프트, 상관없음->없음
// ---------------------------------------------------------------------------

describe('AC3 - 의도 확장 (강도별)', () => {
  it('사무용: 저소음=필수, 백라이트없음/한영각인=선호, 연결=상관없음', () => {
    const out = expandIntents({ intents: ['사무용'], explicit: explicit() });
    expect(out.requiredTags).toEqual(['저소음']);
    expect(out.softIntentTags).toEqual(expect.arrayContaining(['백라이트없음', '한영각인']));
    expect(out.softIntentTags).not.toContain('저소음'); // 필수는 소프트에서 제거
    expect(out.hardConstraints).toEqual({});
    // 상관없음(연결)은 아무것도 생성하지 않음
    expect(out.requiredTags).not.toContain('무선');
  });

  it('게이밍: 기계식=필수, RGB=선호', () => {
    const out = expandIntents({ intents: ['게이밍'], explicit: explicit() });
    expect(out.requiredTags).toEqual(['기계식']);
    expect(out.softIntentTags).toContain('RGB');
  });

  it('출력의 requiredTags와 softIntentTags는 상호 배타적이다', () => {
    for (const intents of [['사무용'], ['게이밍'], ['휴대용'], ['사무용', '게이밍', '휴대용']]) {
      const out = expandIntents({ intents, explicit: explicit() });
      const reqSet = new Set(out.requiredTags);
      for (const t of out.softIntentTags) expect(reqSet.has(t)).toBe(false);
    }
  });

  it('어휘 밖 의도는 폐기된다', () => {
    const out = expandIntents({ intents: ['사무용', '존재하지않는의도'], explicit: explicit() });
    expect(out.requiredTags).toEqual(['저소음']);
  });

  it('의도가 없으면 명시 제약을 그대로 통과시킨다', () => {
    const out = expandIntents({
      intents: [],
      explicit: explicit({ price_max: 100000 }, ['RGB']),
    });
    expect(out.hardConstraints).toEqual({ price_max: 100000 });
    expect(out.softIntentTags).toEqual(['RGB']);
    expect(out.requiredTags).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// AC4 - 명시 우선 (사용자 명시 차원은 의도 프로파일을 덮어씀)
// ---------------------------------------------------------------------------

describe('AC4 - 명시 표현 우선', () => {
  it('명시 소프트 RGB가 사무용의 백라이트(백라이트없음) 선호를 덮어쓴다', () => {
    // "사무용인데 RGB 화려한 거" -> 백라이트 차원은 명시(RGB)가 우선
    const out = expandIntents({ intents: ['사무용'], explicit: explicit({}, ['RGB']) });
    expect(out.softIntentTags).toContain('RGB');
    expect(out.softIntentTags).not.toContain('백라이트없음'); // 의도 백라이트 요구 차단
    expect(out.requiredTags).toEqual(['저소음']); // 소음 차원은 명시 안 됨 -> 의도 유지
  });

  it('명시 하드 switch_type이 게이밍의 스위치(기계식) 필수를 덮어쓴다', () => {
    const out = expandIntents({
      intents: ['게이밍'],
      explicit: explicit({ switch_type: '무접점' }),
    });
    expect(out.hardConstraints).toEqual({ switch_type: '무접점' });
    expect(out.requiredTags).not.toContain('기계식'); // 스위치 차원 명시 -> 의도 필수 차단
  });

  it('명시 소프트가 의도 필수와 같은 방향이면 하드로 강화한다 (조용한 사무용)', () => {
    // "조용한 사무실" -> 조용함 명시 + 사무용 저소음 필수 = 같은 정숙 방향
    const out = expandIntents({ intents: ['사무용'], explicit: explicit({}, ['조용함']) });
    expect(out.requiredTags).toContain('저소음'); // 양보가 아니라 하드 승격
    expect(out.softIntentTags).not.toContain('저소음'); // 하드로 옮겨졌으므로 소프트에서 제거
  });

  it('명시 소프트가 의도 필수와 반대 방향이면 의도 필수를 양보한다 (시끄러운 사무용)', () => {
    // "경쾌한 사무용" -> 경쾌함(소란) 명시가 사무용 저소음(정숙) 필수와 충돌 -> 양보
    const out = expandIntents({ intents: ['사무용'], explicit: explicit({}, ['경쾌함']) });
    expect(out.requiredTags).not.toContain('저소음');
    expect(out.softIntentTags).toContain('경쾌함');
  });

  it('dimensionsOfExplicit가 하드 키와 소프트 태그의 차원을 모은다', () => {
    const dims = dimensionsOfExplicit(explicit({ price_max: 50000, connection: '무선' }, ['RGB']));
    expect(dims.has('가격')).toBe(true);
    expect(dims.has('연결')).toBe(true);
    expect(dims.has('백라이트')).toBe(true);
    expect(dims.has('소음')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AC5 - 다중 의도 합집합
// ---------------------------------------------------------------------------

describe('AC5 - 다중 의도 합집합', () => {
  it('사무용+게이밍: 필수는 합쳐진다 (저소음 + 기계식)', () => {
    const out = expandIntents({ intents: ['사무용', '게이밍'], explicit: explicit() });
    expect(out.requiredTags).toEqual(expect.arrayContaining(['저소음', '기계식']));
    expect(out.requiredTags).toHaveLength(2);
  });

  it('중복 태그는 한 번만 (휴대용 + 휴대용)', () => {
    const out = expandIntents({ intents: ['휴대용', '휴대용'], explicit: explicit() });
    expect(out.requiredTags).toEqual(['가벼움']);
  });

  it('사무용+휴대용: 연결 차원은 사무용=상관없음, 휴대용=무선 선호 -> 무선 소프트 추가', () => {
    const out = expandIntents({ intents: ['사무용', '휴대용'], explicit: explicit() });
    expect(out.requiredTags).toEqual(expect.arrayContaining(['저소음', '가벼움']));
    expect(out.softIntentTags).toContain('무선');
    expect(out.softIntentTags).toContain('텐키리스');
  });
});

// ---------------------------------------------------------------------------
// 결정론 / 순수성 (AC7 일부)
// ---------------------------------------------------------------------------

describe('expandIntents 결정론', () => {
  it('동일 입력 -> 동일 출력', () => {
    const input = { intents: ['사무용', '게이밍'], explicit: explicit({ price_max: 120000 }) };
    expect(expandIntents(input)).toEqual(expandIntents(input));
  });

  it('INTENT_VOCABULARY는 3개 의도를 가진다', () => {
    expect(INTENT_VOCABULARY).toEqual(['사무용', '게이밍', '휴대용']);
  });
});
