/**
 * recommend: 태그 파이프라인 추천 진입점
 *
 * 기존 'LLM이 결과를 직접 선택'하던 방식을 '태그 파이프라인'으로 교체한다.
 *
 *   자유형 자연어 -> extractAndValidateTags (LLM 태그 추출) ─┐
 *                                                            ├─> searchKeyboards (결정론 검색) -> 결과
 *   단계선택      -> selectionOptionConverter (결정론 변환) ─┘
 *
 * - LLM 호출은 자유형 입력의 '태그 추출' 단계에서만 발생한다.
 * - 검색/스코어링/결과/매칭 근거 생성에는 LLM 호출이 없다 (결정론).
 * - 단계선택 경로는 LLM 호출 없이 완전히 결정론적으로 동작한다 (오프라인 가능).
 *
 * 공개 시그니처 recommend(input): Promise<RecommendResult> 는 유지하여
 * App.tsx / ResultView 의 렌더링을 그대로 재사용한다.
 */

import rawCatalog from '../data/keyboards.json';
import type { Keyboard, Recommendation, RecommendInput, RecommendResult } from '../types';
import { extractAndValidateTags, type ExtractedTags } from './extractRawTags';
import { selectionOptionConverter } from './guidedInputMapper';
import { searchKeyboards, type SearchOutput, type SearchResultItem } from './searchEngine';

const catalog = rawCatalog as Keyboard[];

/** 결과로 노출할 최대 추천 개수 */
const MAX_RESULTS = 12;

/** 완화된 하드 제약 키 -> 사용자 표시용 한글 라벨 */
const RELAX_LABELS: Record<string, string> = {
  price_min: '최소 가격',
  price_max: '최대 가격',
  weight_max_g: '무게',
  connection: '연결방식',
  layout: '배열',
  switch_type: '스위치',
  wireless_type: '무선 방식',
  engraving: '각인',
  backlight: '백라이트',
};

function relaxLabel(key: string): string {
  return RELAX_LABELS[key] ?? key;
}

/**
 * 입력을 ExtractedTags로 정규화한다.
 * - 자유형: LLM으로 태그 추출 (extractAndValidateTags)
 * - 단계선택: 규칙 기반 결정론 변환 (selectionOptionConverter), LLM 미호출
 */
async function inputToTags(input: RecommendInput): Promise<ExtractedTags> {
  if (input.mode === 'freeform') {
    return extractAndValidateTags(input.query);
  }
  return selectionOptionConverter(input.answers, input.budget);
}

/** 결과 1건의 매칭 근거 문장을 결정론적으로 생성한다 (LLM 미사용). */
export function buildReason(item: SearchResultItem, isFallback: boolean): string {
  const matched = item.matchedTags;
  if (isFallback) {
    return matched.length > 0
      ? `조건을 일부 완화해 찾았어요. ${matched.join('·')} 의도와 맞습니다.`
      : '조건에 딱 맞는 제품이 없어 조건을 완화해 찾은 결과예요.';
  }
  return matched.length > 0
    ? `${matched.join('·')} 의도에 맞는 제품이에요.`
    : '입력하신 조건을 모두 충족하는 제품이에요.';
}

/** SearchOutput -> 화면이 기대하는 Recommendation[] 로 변환한다. */
export function toRecommendations(output: SearchOutput): Recommendation[] {
  return output.results.slice(0, MAX_RESULTS).map((item) => ({
    ...item.keyboard,
    reason: buildReason(item, output.isFallback),
    // 매칭 근거 = 결정론적으로 일치한 소프트 의도 태그 (결과 필터 칩으로도 사용)
    tags: [...item.matchedTags],
  }));
}

/** 전체 추천 요약 문장을 결정론적으로 생성한다. */
export function buildSummary(output: SearchOutput): string {
  if (output.results.length === 0) {
    return '입력하신 조건에 맞는 제품을 찾지 못했어요. 조건을 바꿔 다시 시도해 주세요.';
  }
  const n = Math.min(output.results.length, MAX_RESULTS);
  if (output.isFallback) {
    const relaxed = output.relaxedConstraints.map(relaxLabel).join(', ');
    return `조건에 딱 맞는 제품이 없어 ${relaxed} 조건을 완화해 ${n}개를 찾았어요.`;
  }
  return `입력하신 조건에 맞는 제품 ${n}개를 찾았어요.`;
}

/**
 * 태그 파이프라인 추천.
 *
 * 1. 입력 -> ExtractedTags (자유형은 LLM 추출, 단계선택은 결정론 변환)
 * 2. searchKeyboards: 하드 제약 필터(위반 제외) + 소프트 의도 점수 랭킹
 *    - 결과 0건 시 하드 제약을 우선순위 역순으로 1개씩 완화해 재검색
 * 3. 결과 + 매칭 근거를 RecommendResult 로 변환
 *
 * 2~3 단계에는 LLM 호출이 없다.
 */
export async function recommend(input: RecommendInput): Promise<RecommendResult> {
  const tags = await inputToTags(input);
  const output = searchKeyboards(tags, catalog);
  return {
    summary: buildSummary(output),
    recommendations: toRecommendations(output),
  };
}
