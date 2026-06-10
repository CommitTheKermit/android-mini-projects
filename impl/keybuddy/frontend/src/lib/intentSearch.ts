/**
 * intentSearch: 의도 확장 결과(ExpandedTags)로 검색하는 결정론 엔진
 *
 * 하드 = 명시 하드 제약 + 필수 승격 태그(둘 다 위반 제외)
 * 소프트 = 선호 태그 점수 랭킹
 *
 * 결과 0건 시 완화 순서:
 *   1) 의도 파생 '필수 태그'를 먼저 완화 (의도는 명시보다 약하므로)
 *   2) 그 다음 명시 하드 제약 키를 HARD_CONSTRAINT_RELAXATION_ORDER 순서로 완화
 *
 * searchEngine 코어를 수정하지 않고 그 export(타입/상수/유틸)와 softScorer/hardFilter를
 * 조합한다. LLM 호출 없이 순수 함수로 동작한다.
 */

import type { Keyboard } from '../types';
import type { SoftIntentTag } from './tagSchema';
import type { HardConstraints } from './extractRawTags';
import type { ExpandedTags } from './intentProfile';
import { checkHardConstraintViolation } from './hardFilter';
import { scoreBySoftTags, deriveRankOrder, getMatchedSoftTags } from './softScorer';
import {
  HARD_CONSTRAINT_RELAXATION_ORDER,
  hardConstraintsToHardTags,
  type SearchOutput,
  type SearchResultItem,
} from './searchEngine';

// ---------------------------------------------------------------------------
// 필수 태그 하드 필터
// ---------------------------------------------------------------------------

/**
 * 키보드가 모든 필수 태그의 술어를 만족하는지 확인한다.
 * 태그 내부 술어는 OR(softScorer와 동일), 태그 간에는 AND.
 */
export function satisfiesRequiredTags(kb: Keyboard, requiredTags: SoftIntentTag[]): boolean {
  return requiredTags.every((t) => getMatchedSoftTags(kb, [t]).length > 0);
}

/**
 * 필수 태그를 하드 필터로 적용해 위반 키보드를 제외한다.
 * requiredTags가 비면 전체를 그대로 반환한다(순수 함수, 원본 불변).
 */
export function filterByRequiredTags(
  keyboards: Keyboard[],
  requiredTags: SoftIntentTag[],
): Keyboard[] {
  if (requiredTags.length === 0) return keyboards.slice();
  return keyboards.filter((kb) => satisfiesRequiredTags(kb, requiredTags));
}

// ---------------------------------------------------------------------------
// 완화 단위
// ---------------------------------------------------------------------------

type RelaxUnit =
  | { kind: 'required'; tag: SoftIntentTag }
  | { kind: 'hard'; key: keyof HardConstraints };

function unitLabel(u: RelaxUnit): string {
  return u.kind === 'required' ? u.tag : (u.key as string);
}

function pickHardConstraints(
  hc: HardConstraints,
  keys: Array<keyof HardConstraints>,
): HardConstraints {
  const out: HardConstraints = {};
  for (const k of keys) {
    if (hc[k] !== undefined) {
      (out as Record<string, unknown>)[k] = hc[k];
    }
  }
  return out;
}

function applyHardAndRequired(
  catalog: Keyboard[],
  activeHard: HardConstraints,
  activeRequired: SoftIntentTag[],
): Keyboard[] {
  const hardTags = hardConstraintsToHardTags(activeHard);
  return catalog.filter(
    (kb) =>
      !hardTags.some((tag) => checkHardConstraintViolation(kb, tag)) &&
      satisfiesRequiredTags(kb, activeRequired),
  );
}

function buildOutput(
  filtered: Keyboard[],
  catalog: Keyboard[],
  softTags: SoftIntentTag[],
  isFallback: boolean,
  relaxed: string[],
): SearchOutput {
  const scoreVector = scoreBySoftTags(filtered, softTags);
  const rankOrder = deriveRankOrder(scoreVector);
  // 카탈로그 인덱스를 결과마다 indexOf(O(n))로 찾지 않도록 Map으로 1회 사전 구축(O(1) 조회)
  const catalogIndex = new Map<Keyboard, number>(catalog.map((kb, i) => [kb, i]));
  const results: SearchResultItem[] = rankOrder.map((filteredIdx) => {
    const { score, matchedTags } = scoreVector[filteredIdx];
    const keyboard = filtered[filteredIdx];
    return {
      keyboard,
      keyboardIndex: catalogIndex.get(keyboard) ?? -1,
      score,
      matchedTags,
      // 폴백(완화) 경로가 아니면 모든 원래 하드 제약을 만족. 폴백 결과여도 완화되지 않은
      // 제약은 여전히 만족하므로, 이 플래그는 "완화 단계를 거쳤는가"의 의미로 해석한다.
      satisfiesHardConstraints: !isFallback,
      isFallback,
      relaxedConstraints: relaxed,
      relaxationStepCount: relaxed.length,
    };
  });
  return {
    results,
    isFallback,
    relaxedConstraints: relaxed,
    relaxationStepCount: relaxed.length,
  };
}

// ---------------------------------------------------------------------------
// 공개 API
// ---------------------------------------------------------------------------

/**
 * 의도 확장 결과(ExpandedTags)로 검색한다.
 *
 * - 하드 제약 + 필수 태그를 모두 만족하는 키보드만 결과에 포함(위반 0건 보장)
 * - 선호(소프트) 태그로 점수 랭킹
 * - 결과 0건이면 완화 우선순위가 낮은 유닛부터 누적으로 1개씩 더 풀며 재검색
 *   ([필수 태그..., 명시 하드 키...] 순서. 가장 약한 유닛이 가장 먼저 완화된다)
 *
 * @returns SearchOutput (searchEngine과 동일 형태)
 */
export function searchWithProfile(expanded: ExpandedTags, catalog: Keyboard[]): SearchOutput {
  const { hardConstraints, requiredTags, softIntentTags } = expanded;

  const hardKeys = HARD_CONSTRAINT_RELAXATION_ORDER.filter((k) =>
    Object.prototype.hasOwnProperty.call(hardConstraints, k),
  );

  // 완화 우선순위: 의도 파생 필수 태그 먼저, 그 다음 명시 하드 키
  const units: RelaxUnit[] = [
    ...requiredTags.map((tag): RelaxUnit => ({ kind: 'required', tag })),
    ...hardKeys.map((key): RelaxUnit => ({ kind: 'hard', key })),
  ];

  // drop = 이번 시도에서 선행 유닛 몇 개를 동시에 풀 것인가(누적 완화).
  // drop=0은 완화 없음, drop=1은 units[0]만, drop=2는 units[0..1]을 함께 푼다.
  // 우선순위가 낮은 유닛이 앞쪽에 있어 가장 먼저 완화되며, 첫 비공 결과를 채택한다.
  for (let drop = 0; drop <= units.length; drop++) {
    const active = units.slice(drop);
    const activeRequired = active.flatMap((u) => (u.kind === 'required' ? [u.tag] : []));
    const activeHardKeys = active.flatMap((u) => (u.kind === 'hard' ? [u.key] : []));
    const activeHard = pickHardConstraints(hardConstraints, activeHardKeys);

    const filtered = applyHardAndRequired(catalog, activeHard, activeRequired);
    if (filtered.length > 0) {
      const relaxed = units.slice(0, drop).map(unitLabel);
      return buildOutput(filtered, catalog, softIntentTags, drop > 0, relaxed);
    }
  }

  // 모든 완화 후에도 결과 0건 (카탈로그가 비었을 때만 도달)
  return {
    results: [],
    isFallback: units.length > 0,
    relaxedConstraints: units.map(unitLabel),
    relaxationStepCount: units.length,
  };
}
