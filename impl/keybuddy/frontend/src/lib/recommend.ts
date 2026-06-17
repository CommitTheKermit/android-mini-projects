/**
 * recommend: 의도 하네스(결정론) 추천 진입점
 *
 * - freeform(자연어): Edge Function에서 OpenAI로 {intents, hardConstraints, softIntentTags}
 *   태그추출만 받고(LLM 키는 서버 secret에만), 검색·랭킹은 클라이언트 결정론 파이프라인이 수행.
 * - guided(단계선택): selectionOptionConverter로 답변을 태그로 직접 변환(LLM 0회).
 *
 * 두 경로 모두 expandIntents → searchWithProfile(점수순 정렬) → 상위 MAX_RESULTS개로 끝난다.
 * 점수 내림차순은 searchWithProfile/deriveRankOrder가 보장하므로 결과는 "점수순 top N"이다.
 */

import catalog from '../data/keyboards.json';
import type { Keyboard, RecommendInput, RecommendResult } from '../types';
import { sanitizeTags, type ExtractedTags, type IntentExtraction } from './extractRawTags';
import { expandIntents, isIntentTag } from './intentProfile';
import { searchWithProfile } from './intentSearch';
import { toRecommendations, buildSummary } from './searchResultComposition';
import { selectionOptionConverter } from './guidedInputMapper';

const recommendTimeoutMs = 55000;

/** 노출 추천 개수 - 점수순 상위 N개만 보여준다. */
const MAX_RESULTS = 3;

const keyboards = catalog as Keyboard[];

function getRecommendTarget(): { url: string; headers: Record<string, string> } {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const localFunctionUrl = import.meta.env.VITE_SUPABASE_RECOMMEND_URL;
  if (localFunctionUrl) {
    return { url: localFunctionUrl, headers: supabaseAnonKey ? { apikey: supabaseAnonKey } : {} };
  }
  if (!supabaseUrl) {
    throw new Error('VITE_SUPABASE_URL이 설정되지 않았습니다.');
  }
  return {
    url: `${supabaseUrl.replace(/\/$/, '')}/functions/v1/recommend`,
    headers: supabaseAnonKey ? { apikey: supabaseAnonKey } : {},
  };
}

/**
 * 서버 태그추출 응답을 통제 어휘로 한 번 더 정제한다(서버 정제와 합쳐 2중 방어).
 * 어휘 동기화가 어긋나거나 예기치 못한 값이 와도 검색 입력을 안전하게 유지한다.
 */
function sanitizeExtraction(data: unknown): IntentExtraction {
  const rec =
    data && typeof data === 'object' && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {};

  const intents = Array.isArray(rec.intents)
    ? rec.intents.filter((x): x is string => typeof x === 'string' && isIntentTag(x))
    : [];

  // hardConstraints/softIntentTags는 sanitizeTags로 키별 타입·어휘를 검증해 재사용한다.
  // 단순 캐스트가 아니라 sanitizeHardConstraints(숫자/열거형 검증)를 거치므로
  // 서버 sanitizeExtraction과 동일 수준의 2중 방어가 실제로 동작한다.
  const { hardConstraints, softIntentTags } = sanitizeTags(rec);

  return { intents, hardConstraints, softIntentTags };
}

/** Edge Function 태그추출 모드 호출: 자연어 → IntentExtraction (OpenAI, 키는 서버에만). */
async function extractTags(query: string): Promise<IntentExtraction> {
  const target = getRecommendTarget();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), recommendTimeoutMs);
  let response: Response;
  try {
    response = await fetch(target.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...target.headers,
      },
      signal: controller.signal,
      body: JSON.stringify({ mode: 'extract', query }),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('추천 요청 시간이 길어 중단했습니다. 잠시 후 다시 시도해 주세요.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message =
      body && typeof body === 'object' && 'error' in body && typeof (body as { error: unknown }).error === 'string'
        ? (body as { error: string }).error
        : '추천 요청에 실패했습니다.';
    throw new Error(message);
  }

  return sanitizeExtraction(await response.json());
}

/** 의도 확장 → 결정론 검색 → 점수순 상위 MAX_RESULTS개로 결과를 만든다. */
function runDeterministicSearch(intents: string[], explicit: ExtractedTags): RecommendResult {
  const expanded = expandIntents({ intents, explicit });
  const output = searchWithProfile(expanded, keyboards);
  return {
    summary: buildSummary(output, MAX_RESULTS),
    recommendations: toRecommendations(output, MAX_RESULTS),
  };
}

export async function recommend(input: RecommendInput): Promise<RecommendResult> {
  // guided: 선택 답변을 결정론으로 태그 변환 (서버/LLM 호출 0회)
  if (input.mode === 'guided') {
    const explicit = selectionOptionConverter(input.answers, input.budget);
    return runDeterministicSearch([], explicit);
  }

  // freeform: 서버에서 OpenAI 태그추출만, 검색·랭킹은 클라 결정론
  const extraction = await extractTags(input.query);
  return runDeterministicSearch(extraction.intents, {
    hardConstraints: extraction.hardConstraints,
    softIntentTags: extraction.softIntentTags,
  });
}
