import type { Recommendation } from '../types';

const NO_MATCH_SUMMARY_PATTERN =
  /(만족|일치|맞는|해당|조건|상품|제품|후보).{0,40}(없|찾지 못|못 찾)|(?:없|찾지 못|못 찾).{0,40}(상품|제품|후보|조건)/;

export function summarySaysNoMatches(summary: string): boolean {
  return NO_MATCH_SUMMARY_PATTERN.test(summary);
}

export function hasOnlyFallbackRecommendations(recommendations: Recommendation[]): boolean {
  return recommendations.length > 0 && recommendations.every((item) => item.is_fallback);
}

export function getDisplaySummary(
  summary: string | undefined,
  recommendations: Recommendation[],
): string {
  const trimmedSummary = summary?.trim();

  if (recommendations.length === 0) {
    return trimmedSummary || '해당 조건에 맞는 제품이 없습니다.';
  }

  if (trimmedSummary && !summarySaysNoMatches(trimmedSummary)) {
    return trimmedSummary;
  }

  if (hasOnlyFallbackRecommendations(recommendations)) {
    return '입력하신 모든 조건을 동시에 만족하는 상품은 없어, 조건에 가까운 후보를 우선 보여드려요.';
  }

  return '입력하신 조건에 가까운 추천 후보를 찾았어요. 일부 조건은 상품별로 다를 수 있어 세부 사양을 함께 확인해 주세요.';
}

export function getResultHeadline(
  activeFilter: string,
  resultCount: number,
  recommendations: Recommendation[],
): string {
  if (activeFilter !== '전체') {
    return `${activeFilter} 필터로 ${resultCount}개의 상품이 남았어요`;
  }

  if (hasOnlyFallbackRecommendations(recommendations)) {
    return `조건에 가까운 ${resultCount}개의 후보를 찾았어요`;
  }

  return `총 ${resultCount}개의 상품을 찾았어요`;
}
