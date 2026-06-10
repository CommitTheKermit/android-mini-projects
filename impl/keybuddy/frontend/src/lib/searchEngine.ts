/**
 * searchEngine: 태그 파이프라인 검색 엔진 진입점
 *
 * ExtractedTags (hardConstraints + softIntentTags) -> 결정론 검색 결과
 *
 * 파이프라인:
 * 1. hardConstraints -> HardTag[] 변환
 * 2. filterByHardConstraints: 하드 제약 위반 키보드 제외
 * 3. scoreBySoftTags: 소프트 의도 태그 기반 점수 계산
 * 4. deriveRankOrder: 점수 내림차순 정렬
 * 5. 결과 0건 시: 하드 제약 우선순위 역순으로 1개씩 완화 후 재검색
 *
 * LLM 호출 없이 결정론적으로 동작한다. 동일 입력 -> 동일 출력.
 * 자유형(freeform) 경로와 단계선택(guided) 경로 모두 이 진입점을 공유한다.
 */

import type { Keyboard } from '../types';
import type { ExtractedTags, HardConstraints } from './extractRawTags';
import type { SoftIntentTag } from './tagSchema';
import { filterByHardConstraints, type HardTag } from './hardFilter';
import { scoreBySoftTags, deriveRankOrder } from './softScorer';

// ---------------------------------------------------------------------------
// 결과 타입
// ---------------------------------------------------------------------------

/** 검색 결과 1건 */
export interface SearchResultItem {
  /** 카탈로그 레코드 */
  keyboard: Keyboard;
  /** 원본 카탈로그 배열의 인덱스 */
  keyboardIndex: number;
  /** 소프트 의도 태그 매칭 점수 */
  score: number;
  /** 매칭된 소프트 태그 목록 (매칭 근거) */
  matchedTags: SoftIntentTag[];
  /**
   * 완화 없이(비폴백) 모든 원래 하드 제약을 만족하는 경로에서 나온 결과인지 여부.
   * 주의: 폴백 결과여도 완화되지 않은 제약은 여전히 만족한다. 이 플래그는 개별
   * 키보드의 제약 위반 여부가 아니라 "결과가 완화 단계를 거쳤는가"를 나타낸다(= !isFallback).
   */
  satisfiesHardConstraints: boolean;
  /** 폴백(제약 완화) 경로로 반환된 결과인지 여부 */
  isFallback: boolean;
  /** 완화된 하드 제약 키 목록 */
  relaxedConstraints: string[];
  /** 완화 단계 수 */
  relaxationStepCount: number;
}

/** searchKeyboards 반환 타입 */
export interface SearchOutput {
  /** 점수 내림차순 정렬된 결과 목록 */
  results: SearchResultItem[];
  /** 결과가 폴백(제약 완화) 경로로 나왔는지 여부 */
  isFallback: boolean;
  /** 완화된 하드 제약 키 목록 */
  relaxedConstraints: string[];
  /** 완화 단계 수 */
  relaxationStepCount: number;
}

// ---------------------------------------------------------------------------
// 하드 제약 완화 우선순위
//
// 낮은 인덱스부터 먼저 완화한다 (낮은 인덱스 = 낮은 우선순위 = 먼저 릴렉스).
// ---------------------------------------------------------------------------

export const HARD_CONSTRAINT_RELAXATION_ORDER: ReadonlyArray<keyof HardConstraints> = [
  'price_min',
  'weight_max_g',
  'engraving',
  'backlight',
  'wireless_type',
  'connection',
  'switch_type',
  'layout',
  'price_max',
];

// ---------------------------------------------------------------------------
// getRelaxationOrder (Sub-AC 6-2)
// ---------------------------------------------------------------------------

/**
 * priority 속성을 가진 하드 제약 객체.
 * priority 숫자가 낮을수록 낮은 우선순위 - 먼저 완화된다.
 */
export interface PrioritizedHardConstraint {
  priority: number;
  [key: string]: unknown;
}

/**
 * priority 속성을 가진 하드 제약 배열을 받아
 * priority 오름차순(낮은 우선순위 항목이 먼저)으로 정렬된 새 배열을 반환한다.
 *
 * - 원본 배열을 변경하지 않는다 (순수 함수).
 * - 동일 priority 항목 간 상대 순서는 입력 순서를 유지한다 (안정 정렬).
 *
 * @param hardConstraints - priority 속성을 포함하는 하드 제약 배열
 * @returns priority 오름차순으로 정렬된 새 배열 (낮은 우선순위가 먼저)
 */
export function getRelaxationOrder<T extends PrioritizedHardConstraint>(
  hardConstraints: T[],
): T[] {
  return [...hardConstraints].sort((a, b) => a.priority - b.priority);
}

// ---------------------------------------------------------------------------
// 내부 유틸
// ---------------------------------------------------------------------------

/**
 * HardConstraints 객체를 filterByHardConstraints 입력 형태(HardTag[])로 변환한다.
 *
 * 내보내기(export)하여 테스트에서도 동일 변환 로직을 사용하도록 한다.
 */
export function hardConstraintsToHardTags(hc: HardConstraints): HardTag[] {
  const tags: HardTag[] = [];
  if (hc.layout !== undefined) tags.push({ type: 'layout', value: hc.layout });
  if (hc.switch_type !== undefined) tags.push({ type: 'switch_type', value: hc.switch_type });
  if (hc.price_max !== undefined) tags.push({ type: 'price_max', value: hc.price_max });
  if (hc.price_min !== undefined) tags.push({ type: 'price_min', value: hc.price_min });
  if (hc.connection !== undefined) tags.push({ type: 'connection', value: hc.connection });
  if (hc.wireless_type !== undefined) tags.push({ type: 'wireless_type', value: hc.wireless_type });
  if (hc.engraving !== undefined) tags.push({ type: 'engraving', value: hc.engraving });
  if (hc.backlight !== undefined) tags.push({ type: 'backlight', value: hc.backlight });
  if (hc.weight_max_g !== undefined) tags.push({ type: 'weight_max_g', value: hc.weight_max_g });
  return tags;
}

/**
 * 필터링된 키보드 목록과 소프트 태그로 SearchResultItem[] 를 빌드한다.
 *
 * @param filtered - 하드 제약을 통과한 키보드 목록
 * @param catalog  - 원본 카탈로그 (keyboardIndex 계산용)
 * @param softTags - 소프트 의도 태그
 * @param isFallback - 폴백 경로 여부
 * @param relaxedConstraints - 완화된 제약 키 목록
 */
function buildResults(
  filtered: Keyboard[],
  catalog: Keyboard[],
  softTags: SoftIntentTag[],
  isFallback: boolean,
  relaxedConstraints: string[],
): SearchResultItem[] {
  const scoreVector = scoreBySoftTags(filtered, softTags);
  const rankOrder = deriveRankOrder(scoreVector);
  const stepCount = relaxedConstraints.length;
  // 카탈로그 인덱스를 결과마다 indexOf(O(n))로 찾지 않도록 Map으로 1회 사전 구축(O(1) 조회)
  const catalogIndex = new Map<Keyboard, number>(catalog.map((kb, i) => [kb, i]));

  return rankOrder.map((filteredIdx) => {
    const { score, matchedTags } = scoreVector[filteredIdx];
    const keyboard = filtered[filteredIdx];
    return {
      keyboard,
      keyboardIndex: catalogIndex.get(keyboard) ?? -1,
      score,
      matchedTags,
      satisfiesHardConstraints: !isFallback,
      isFallback,
      relaxedConstraints,
      relaxationStepCount: stepCount,
    };
  });
}

// ---------------------------------------------------------------------------
// relaxAndSearch (Sub-AC 6-3)
// ---------------------------------------------------------------------------

/**
 * relaxAndSearch 반환 타입.
 * relaxationSteps는 relaxedConstraints.length와 항상 동일하다.
 */
export interface RelaxAndSearchResult<T> {
  results: T[];
  relaxedConstraints: string[];
  relaxationSteps: number;
}

/**
 * hardConstraints + searchFn을 받아 결과가 0개이면
 * 역순 우선순위(HARD_CONSTRAINT_RELAXATION_ORDER) 순서대로
 * 제약을 1개씩 제거하며 searchFn을 재호출한다.
 *
 * 첫 번째 비공(非空) 결과 시점에
 * `{ results, relaxedConstraints, relaxationSteps }` 를 반환한다.
 *
 * - 원본 hardConstraints를 변경하지 않는다 (순수 함수).
 * - searchFn 에는 LLM 호출이 없어야 하며, 이 함수 자체도 LLM 없이 동작한다.
 *
 * @param hardConstraints - 하드 제약 객체
 * @param searchFn        - (constraints: HardConstraints) => T[] 동기 검색 함수
 * @returns RelaxAndSearchResult<T>
 */
export function relaxAndSearch<T>(
  hardConstraints: HardConstraints,
  searchFn: (constraints: HardConstraints) => T[],
): RelaxAndSearchResult<T> {
  // 1. 초기 검색 - 제약 완화 없이 먼저 시도
  const initial = searchFn(hardConstraints);
  if (initial.length > 0) {
    return { results: initial, relaxedConstraints: [], relaxationSteps: 0 };
  }

  // 2. 결과 0건 - HARD_CONSTRAINT_RELAXATION_ORDER 순서로 완화
  const activeKeys = HARD_CONSTRAINT_RELAXATION_ORDER.filter(
    (k) => Object.prototype.hasOwnProperty.call(hardConstraints, k),
  );

  const currentConstraints: HardConstraints = { ...hardConstraints };
  const relaxedConstraints: string[] = [];

  for (const key of activeKeys) {
    delete currentConstraints[key];
    relaxedConstraints.push(key as string);

    // 복사본을 전달해 searchFn이 수신한 인수가 이후 변경되지 않도록 보장한다
    const results = searchFn({ ...currentConstraints });
    if (results.length > 0) {
      return {
        results,
        relaxedConstraints: [...relaxedConstraints],
        relaxationSteps: relaxedConstraints.length,
      };
    }
  }

  // 3. 모든 제약 완화 후에도 결과 없음
  return {
    results: [],
    relaxedConstraints: [...relaxedConstraints],
    relaxationSteps: relaxedConstraints.length,
  };
}

// ---------------------------------------------------------------------------
// 공개 API: 검색 엔진 진입점
// ---------------------------------------------------------------------------

/**
 * 태그 파이프라인 검색 엔진 진입점.
 *
 * [LEGACY] 현재 메인 추천 흐름(recommend.ts)은 의도 하네싱 경로인
 * intentSearch.searchWithProfile 을 사용한다. 이 함수는 ExtractedTags 기반
 * 직접 검색용으로 남아 있으며(테스트/하위호환), 신규 경로의 1차 진입점이 아니다.
 * 완화 로직이 searchWithProfile 과 거의 동일하므로, 장기적으로는 한쪽으로
 * 통합(또는 위임)해 유지보수 표면을 줄이는 것이 바람직하다.
 *
 * ExtractedTags(hardConstraints + softIntentTags)를 받아
 * 결정론 검색 결과(SearchOutput)를 반환한다.
 *
 * - 하드 제약 필터 -> 소프트 스코어링 -> 점수 내림차순 정렬
 * - 결과 0건 시: 하드 제약을 우선순위 역순으로 1개씩 완화 후 재검색
 * - 결과에 매칭 태그(matchedTags), 폴백 여부(isFallback), 완화 정보가 포함된다
 *
 * LLM 호출 없이 순수 함수로 동작한다. 동일 입력 -> 동일 출력.
 *
 * @param tags    - ExtractedTags { hardConstraints, softIntentTags }
 * @param catalog - 키보드 카탈로그 목록
 * @returns SearchOutput { results, isFallback, relaxedConstraints, relaxationStepCount }
 */
export function searchKeyboards(tags: ExtractedTags, catalog: Keyboard[]): SearchOutput {
  const initialHardTags = hardConstraintsToHardTags(tags.hardConstraints);
  const filtered = filterByHardConstraints(catalog, initialHardTags);

  if (filtered.length > 0) {
    return {
      results: buildResults(filtered, catalog, tags.softIntentTags, false, []),
      isFallback: false,
      relaxedConstraints: [],
      relaxationStepCount: 0,
    };
  }

  // 결과 0건 - 하드 제약 완화 폴백
  const activeKeys = new Set(Object.keys(tags.hardConstraints) as Array<keyof HardConstraints>);
  const relaxOrder = HARD_CONSTRAINT_RELAXATION_ORDER.filter((k) => activeKeys.has(k));

  const currentConstraints: HardConstraints = { ...tags.hardConstraints };
  const relaxedConstraints: string[] = [];

  for (const key of relaxOrder) {
    delete currentConstraints[key];
    relaxedConstraints.push(key as string);

    const newHardTags = hardConstraintsToHardTags(currentConstraints);
    const relaxedFiltered = filterByHardConstraints(catalog, newHardTags);

    if (relaxedFiltered.length > 0) {
      return {
        results: buildResults(
          relaxedFiltered,
          catalog,
          tags.softIntentTags,
          true,
          [...relaxedConstraints],
        ),
        isFallback: true,
        relaxedConstraints: [...relaxedConstraints],
        relaxationStepCount: relaxedConstraints.length,
      };
    }
  }

  // 모든 제약 완화 후에도 결과 없음 -> 빈 결과
  return {
    results: [],
    isFallback: true,
    relaxedConstraints: [...relaxedConstraints],
    relaxationStepCount: relaxedConstraints.length,
  };
}
