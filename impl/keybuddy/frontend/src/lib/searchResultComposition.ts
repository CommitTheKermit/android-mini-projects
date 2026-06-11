import type { Recommendation } from '../types';
import type { SearchOutput, SearchResultItem } from './searchEngine';

const maxResults = 30;

const relaxLabels: Record<string, string> = {
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
  return relaxLabels[key] ?? key;
}

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

export function toRecommendations(output: SearchOutput): Recommendation[] {
  return output.results.slice(0, maxResults).map((item) => ({
    ...item.keyboard,
    reason: buildReason(item, output.isFallback),
    tags: [...item.matchedTags],
  }));
}

export function buildSummary(output: SearchOutput): string {
  if (output.results.length === 0) {
    return '입력하신 조건에 맞는 제품을 찾지 못했어요. 조건을 바꿔 다시 시도해 주세요.';
  }
  const count = Math.min(output.results.length, maxResults);
  if (output.isFallback) {
    const relaxed = output.relaxedConstraints.map(relaxLabel).join(', ');
    return `조건에 딱 맞는 제품이 없어 ${relaxed} 조건을 완화해 ${count}개를 찾았어요.`;
  }
  return `입력하신 조건에 맞는 제품 ${count}개를 찾았어요.`;
}
