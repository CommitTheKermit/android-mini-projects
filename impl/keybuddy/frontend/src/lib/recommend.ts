/**
 * recommend: 의도->다차원 프로파일 하네싱 추천 진입점
 *
 *   자유형 자연어 -> extractIntentInput (LLM: 의도 어휘 + 명시 제약) ─┐
 *                                                                     ├─> expandIntents (결정론 확장)
 *   단계선택      -> 용도->의도 + selectionOptionConverter(명시) ──────┘        |
 *                                                                              v
 *                                                          searchWithProfile (하드 필터+소프트 점수+완화)
 *
 * - LLM 호출은 자유형의 '의도/제약 추출' 단계에서만 발생한다.
 * - 의도->프로파일 확장 / 검색 / 스코어링 / 결과 생성에는 LLM 호출이 없다 (결정론).
 * - 단계선택 경로는 LLM 호출 없이 완전히 결정론적으로 동작한다 (오프라인 가능).
 *
 * 공개 시그니처 recommend(input): Promise<RecommendResult> 는 유지하여
 * App.tsx / ResultView 의 렌더링을 그대로 재사용한다.
 */

import rawCatalog from '../data/keyboards.json';
import type { Keyboard, Recommendation, RecommendInput, RecommendResult } from '../types';
import { extractIntentInput, type ExtractedTags } from './extractRawTags';
import {
  selectionOptionConverter,
  PURPOSE_OPTIONS,
  PORTABILITY_OPTIONS,
} from './guidedInputMapper';
import { expandIntents } from './intentProfile';
import { searchWithProfile } from './intentSearch';
import type { SearchOutput, SearchResultItem } from './searchEngine';

const catalog = rawCatalog as Keyboard[];

/** 결과로 노출할 최대 추천 개수 */
const MAX_RESULTS = 12;

/** 완화된 제약 라벨 -> 사용자 표시용 한글 (하드 키는 변환, 필수 태그는 태그명 그대로) */
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

/** 단계선택 답변에서 통제 의도 어휘를 도출한다 (용도/휴대성 -> 의도). */
function guidedIntents(answers: Record<string, string>): string[] {
  const intents: string[] = [];
  if (answers['용도'] === PURPOSE_OPTIONS.OFFICE) intents.push('사무용');
  if (answers['용도'] === PURPOSE_OPTIONS.GAMING) intents.push('게이밍');
  if (answers['휴대성'] === PORTABILITY_OPTIONS.PORTABLE) intents.push('휴대용');
  return intents;
}

/** 입력을 {의도, 명시 제약}으로 정규화한다. 자유형은 LLM, 단계선택은 결정론. */
async function inputToIntentInput(
  input: RecommendInput,
): Promise<{ intents: string[]; explicit: ExtractedTags }> {
  if (input.mode === 'freeform') {
    const inp = await extractIntentInput(input.query);
    return {
      intents: inp.intents,
      explicit: { hardConstraints: inp.hardConstraints, softIntentTags: inp.softIntentTags },
    };
  }
  return {
    intents: guidedIntents(input.answers),
    explicit: selectionOptionConverter(input.answers, input.budget),
  };
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
 * 의도->프로파일 하네싱 추천.
 *
 * 1. 입력 -> {의도, 명시 제약} (자유형은 LLM, 단계선택은 결정론)
 * 2. expandIntents: 의도를 차원별 프로파일로 펼침 (필수->하드, 선호->소프트, 명시 우선)
 * 3. searchWithProfile: 하드(명시+필수) 필터 + 소프트 점수 랭킹, 0건이면 단계 완화
 * 4. 결과 + 매칭 근거를 RecommendResult 로 변환
 *
 * 2~4 단계에는 LLM 호출이 없다.
 */
export async function recommend(input: RecommendInput): Promise<RecommendResult> {
  const { intents, explicit } = await inputToIntentInput(input);
  const expanded = expandIntents({ intents, explicit });
  const output = searchWithProfile(expanded, catalog);

  // 개발 모드 전용: 의도/확장 태그와 검색 결과를 브라우저 콘솔에 출력 (프로덕션 빌드 제외)
  if (import.meta.env.DEV) {
    const inputDesc = input.mode === 'freeform' ? `자유형 "${input.query}"` : '단계선택';
    console.groupCollapsed(
      `%c[keybuddy] 의도 하네싱 결과 - ${inputDesc}`,
      'color:#2563eb;font-weight:bold',
    );
    console.log('의도 (intents):', intents);
    console.log('명시 제약:', explicit.hardConstraints, explicit.softIntentTags);
    console.log('확장 하드 제약:', expanded.hardConstraints);
    console.log('필수 승격 태그 (하드):', expanded.requiredTags);
    console.log('선호 태그 (소프트 점수):', expanded.softIntentTags);
    console.log(
      `검색 결과 ${output.results.length}건` +
        (output.isFallback
          ? ` · 완화됨(${output.relaxedConstraints.join(', ') || '-'})`
          : ' · 완화 없음'),
    );
    console.table(
      output.results.slice(0, 5).map((r) => ({
        제품: r.keyboard.product_name,
        가격: r.keyboard.price,
        스위치: r.keyboard.switch_type,
        배열: r.keyboard.layout,
        연결: r.keyboard.connection,
        점수: r.score,
        매칭태그: r.matchedTags.join(','),
      })),
    );
    console.groupEnd();
  }

  return {
    summary: buildSummary(output),
    recommendations: toRecommendations(output),
  };
}
