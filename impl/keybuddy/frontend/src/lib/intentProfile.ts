/**
 * intentProfile: 의도 -> 다차원 속성 프로파일 하네싱 (정적 문서 + 결정론 확장)
 *
 * 고수준 의도(사무용/게이밍/휴대용)를 차원별 요구로 펼친다.
 * 각 차원 요구는 강도를 가진다:
 *   - 필수(REQUIRED): 하드 제약으로 승격 (해당 소프트 태그 술어를 만족해야 결과 통과)
 *   - 선호(PREFERRED): 소프트 점수 태그로 (랭킹에만 반영)
 *   - 상관없음(NONE):  제약 없음 (문서화 목적으로만 명시)
 *
 * 프로파일 문서(INTENT_PROFILE_TABLE)는 'LLM 초안 + 사람 검수'로 고정한 정적 산출물이며,
 * 런타임/쿼리 시 LLM 호출 없이 결정론적으로 확장한다.
 *
 * 확장 규칙:
 *   - 사용자가 명시한 차원은 의도 프로파일보다 우선한다(명시 우선). 의도는 명시되지 않은 차원만 채운다.
 *   - 다중 의도는 프로파일을 합친다(union, 중복 제거).
 *   - 필수로 승격된 태그는 소프트 목록에서 제거한다(하드가 우선).
 */

import type { SoftIntentTag } from './tagSchema';
import type { ExtractedTags, HardConstraints } from './extractRawTags';

// ---------------------------------------------------------------------------
// 강도 / 차원 타입
// ---------------------------------------------------------------------------

/** 차원별 적용 강도 */
export type Strength = '필수' | '선호' | '상관없음';

/** 속성 차원 (제약이 걸릴 수 있는 facet) */
export type Dimension = '소음' | '스위치' | '백라이트' | '연결' | '배열' | '가격' | '무게' | '각인';

/** 의도 1개가 한 차원에 요구하는 내용 */
export interface DimensionRequirement {
  dimension: Dimension;
  strength: Strength;
  /** 필수/선호일 때 사용할 소프트 태그(이 태그의 술어가 확장에 쓰임). 상관없음이면 생략. */
  tag?: SoftIntentTag;
}

/** 의도 1개의 차원별 프로파일 */
export interface IntentProfile {
  intent: string;
  requirements: DimensionRequirement[];
}

// ---------------------------------------------------------------------------
// 통제된 의도 어휘 + 정적 프로파일 문서 (LLM 초안 + 사람 검수)
// ---------------------------------------------------------------------------

/** 통제된 고수준 의도 어휘. 이 목록 밖 의도는 폐기된다. */
export const INTENT_VOCABULARY = ['사무용', '게이밍', '휴대용'] as const;

export type IntentTag = (typeof INTENT_VOCABULARY)[number];

/** 문자열이 통제 의도 어휘 멤버인지 확인 */
export function isIntentTag(value: string): value is IntentTag {
  return (INTENT_VOCABULARY as readonly string[]).includes(value);
}

/**
 * 의도 -> 차원별 프로파일 정적 문서.
 *
 * 생성 근거(LLM 초안 + 사람 검수):
 * - 사무용: 사무 환경은 소음이 낮아야 하므로 저소음=필수. RGB 없는 편이 선호되고 한영각인 선호.
 *           연결 방식은 사무용과 무관 -> 상관없음.
 * - 게이밍: 빠른 반응의 기계식=필수. RGB 백라이트 선호. 소음은 무관 -> 상관없음.
 * - 휴대용: 들고 다니므로 가벼움=필수. 작은 텐키리스 선호, 무선 선호.
 */
export const INTENT_PROFILE_TABLE: IntentProfile[] = [
  {
    intent: '사무용',
    requirements: [
      { dimension: '소음', strength: '필수', tag: '저소음' },
      { dimension: '백라이트', strength: '선호', tag: '백라이트없음' },
      { dimension: '각인', strength: '선호', tag: '한영각인' },
      { dimension: '연결', strength: '상관없음' },
    ],
  },
  {
    intent: '게이밍',
    requirements: [
      { dimension: '스위치', strength: '필수', tag: '기계식' },
      { dimension: '백라이트', strength: '선호', tag: 'RGB' },
      { dimension: '소음', strength: '상관없음' },
    ],
  },
  {
    intent: '휴대용',
    requirements: [
      { dimension: '무게', strength: '필수', tag: '가벼움' },
      { dimension: '배열', strength: '선호', tag: '텐키리스' },
      { dimension: '연결', strength: '선호', tag: '무선' },
    ],
  },
];

// ---------------------------------------------------------------------------
// 차원 매핑 (명시 우선 판정용)
// ---------------------------------------------------------------------------

/** 소프트 태그 -> 차원 */
const TAG_DIMENSION: Partial<Record<SoftIntentTag, Dimension>> = {
  조용함: '소음',
  저소음: '소음',
  고소음: '소음',
  경쾌함: '소음',
  기계식: '스위치',
  무접점: '스위치',
  펜타그래프: '스위치',
  타건감: '스위치',
  RGB: '백라이트',
  백라이트: '백라이트',
  백라이트없음: '백라이트',
  무선: '연결',
  멀티페어링: '연결',
  풀배열: '배열',
  텐키리스: '배열',
  미니: '배열',
  가성비: '가격',
  가벼움: '무게',
  무거움: '무게',
  휴대성: '무게',
  한영각인: '각인',
  영문각인: '각인',
  // 사무용/게이밍: 의도 자체이며 제약 차원이 아니므로 매핑하지 않음
};

/**
 * 같은 차원 안에서 상반된 방향을 구분하는 극성 라벨.
 * 같은 라벨이면 같은 방향(강화 가능), 다른 라벨이면 충돌(양보).
 * 현재는 소음 축만 정의한다(정숙 vs 소란).
 */
const TAG_POLARITY: Partial<Record<SoftIntentTag, string>> = {
  조용함: '소음:정숙',
  저소음: '소음:정숙',
  고소음: '소음:소란',
  경쾌함: '소음:소란',
};

/** 하드 제약 키 -> 차원 */
const HARD_KEY_DIMENSION: Partial<Record<keyof HardConstraints, Dimension>> = {
  switch_type: '스위치',
  backlight: '백라이트',
  connection: '연결',
  wireless_type: '연결',
  layout: '배열',
  price_max: '가격',
  price_min: '가격',
  weight_max_g: '무게',
  engraving: '각인',
};

/**
 * 명시 추출 결과(하드 제약 키 + 소프트 태그)가 다루는 차원 집합을 구한다.
 * 이 차원들은 의도 프로파일 확장에서 건너뛴다(명시 우선).
 */
export function dimensionsOfExplicit(explicit: ExtractedTags): Set<Dimension> {
  const dims = new Set<Dimension>();
  for (const key of Object.keys(explicit.hardConstraints) as Array<keyof HardConstraints>) {
    const d = HARD_KEY_DIMENSION[key];
    if (d) dims.add(d);
  }
  for (const tag of explicit.softIntentTags) {
    const d = TAG_DIMENSION[tag];
    if (d) dims.add(d);
  }
  return dims;
}

// ---------------------------------------------------------------------------
// 완전성 검사 (AC1)
// ---------------------------------------------------------------------------

/**
 * 통제 의도 어휘의 모든 의도가 프로파일 문서에 최소 1개 차원 요구를 가지는지 확인한다.
 *
 * @returns 요구가 없는(또는 문서에 없는) 의도 목록. 모두 충족되면 빈 배열.
 */
export function checkIntentProfileCompleteness(
  vocab: readonly string[] = INTENT_VOCABULARY,
  table: IntentProfile[] = INTENT_PROFILE_TABLE,
): string[] {
  const covered = new Set(
    table.filter((p) => p.requirements.length > 0).map((p) => p.intent),
  );
  return vocab.filter((intent) => !covered.has(intent));
}

// ---------------------------------------------------------------------------
// 확장 (AC3/4/5-합집합)
// ---------------------------------------------------------------------------

/** 의도 확장의 입력: 추출된 의도 + 명시 제약 */
export interface IntentInput {
  intents: string[];
  explicit: ExtractedTags;
}

/** 의도 확장의 출력: 하드 제약 + 필수 승격 태그 + 선호 소프트 태그 */
export interface ExpandedTags {
  hardConstraints: HardConstraints;
  /** 필수로 승격되어 하드 필터로 적용될 소프트 태그 */
  requiredTags: SoftIntentTag[];
  /** 선호: 소프트 점수 태그 */
  softIntentTags: SoftIntentTag[];
}

/**
 * 의도 집합 + 명시 제약을 ExpandedTags로 결정론적으로 확장한다. (LLM 미호출)
 *
 * - 명시 하드 차원은 항상 의도보다 우선(해당 차원의 의도 요구는 건너뜀)
 * - 명시 소프트가 의도 필수와 같은 차원이면 방향으로 판단(소음 등 극성 정의된 축):
 *     같은 방향이면 의도 필수를 하드로 강화, 충돌(반대 방향)이면 의도 필수를 양보(소프트만)
 *   예) "조용한 사무실" -> 조용함 명시 + 사무용 저소음 필수 = 같은 방향 -> 저소음을 하드로 승격
 * - 필수 -> requiredTags(하드), 선호 -> softIntentTags(소프트), 상관없음 -> 미생성
 * - 다중 의도는 합치고 중복 제거
 * - 필수로 승격된 태그는 소프트 목록에서 제거(하드 우선)
 * - 어휘 밖 의도(프로파일 없음)는 무시
 */
export function expandIntents(input: IntentInput): ExpandedTags {
  // 명시 차원을 하드/소프트로 구분하고, 소프트는 차원별 극성까지 모은다.
  const explicitHardDims = new Set<Dimension>();
  for (const key of Object.keys(input.explicit.hardConstraints) as Array<keyof HardConstraints>) {
    const d = HARD_KEY_DIMENSION[key];
    if (d) explicitHardDims.add(d);
  }
  const explicitSoftDims = new Set<Dimension>();
  const explicitSoftPolaritiesByDim = new Map<Dimension, Set<string>>();
  for (const tag of input.explicit.softIntentTags) {
    const d = TAG_DIMENSION[tag];
    if (!d) continue;
    explicitSoftDims.add(d);
    const pol = TAG_POLARITY[tag];
    if (pol) {
      const set = explicitSoftPolaritiesByDim.get(d) ?? new Set<string>();
      set.add(pol);
      explicitSoftPolaritiesByDim.set(d, set);
    }
  }

  const hardConstraints: HardConstraints = { ...input.explicit.hardConstraints };
  const requiredTags: SoftIntentTag[] = [];
  const softIntentTags: SoftIntentTag[] = [...input.explicit.softIntentTags];

  for (const intent of input.intents) {
    const profile = INTENT_PROFILE_TABLE.find((p) => p.intent === intent);
    if (!profile) continue; // 어휘 밖 의도 폐기
    for (const req of profile.requirements) {
      const dim = req.dimension;
      if (req.strength === '필수' && req.tag) {
        if (explicitHardDims.has(dim)) continue; // 명시 하드 우선
        if (explicitSoftDims.has(dim)) {
          // 명시 소프트가 같은 차원: 방향 일치 시 하드로 강화, 충돌/극성미정 시 양보(소프트만)
          const reqPol = TAG_POLARITY[req.tag];
          const sameDirection = reqPol !== undefined && explicitSoftPolaritiesByDim.get(dim)?.has(reqPol);
          if (sameDirection) requiredTags.push(req.tag);
          continue;
        }
        requiredTags.push(req.tag); // 차원 미명시 -> 정상 하드 승격
      } else if (req.strength === '선호' && req.tag) {
        if (explicitHardDims.has(dim) || explicitSoftDims.has(dim)) continue; // 명시 우선
        softIntentTags.push(req.tag);
      }
      // 상관없음: 아무것도 생성하지 않음
    }
  }

  const uniqueRequired = [...new Set(requiredTags)];
  const requiredSet = new Set<SoftIntentTag>(uniqueRequired);
  const uniqueSoft = [...new Set(softIntentTags)].filter((t) => !requiredSet.has(t));

  return { hardConstraints, requiredTags: uniqueRequired, softIntentTags: uniqueSoft };
}
