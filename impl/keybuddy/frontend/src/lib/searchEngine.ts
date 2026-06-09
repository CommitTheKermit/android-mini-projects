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
  /** 하드 제약을 모두 만족하는지 여부 */
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

  return rankOrder.map((filteredIdx) => {
    const { score, matchedTags } = scoreVector[filteredIdx];
    const keyboard = filtered[filteredIdx];
    return {
      keyboard,
      keyboardIndex: catalog.indexOf(keyboard),
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
// 공개 API: 검색 엔진 진입점
// ---------------------------------------------------------------------------

/**
 * 태그 파이프라인 검색 엔진 진입점.
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
 * 자유형 입력과 단계선택 입력 모두 이 함수 하나를 진입점으로 사용한다:
 *   - 자유형: extractRawTags -> sanitizeTags -> searchKeyboards
 *   - 단계선택: selectionOptionConverter -> searchKeyboards
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
