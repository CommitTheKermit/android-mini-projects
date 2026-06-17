/**
 * recommend: 의도 하네스(결정론) 추천 진입점
 *
 * - freeform(자연어): Edge Function에서 OpenAI로 {intents, hardConstraints, softIntentTags}
 *   태그추출만 받고(LLM 키는 서버 secret에만), 검색·랭킹은 클라이언트 결정론 파이프라인이 수행.
 * - guided(단계선택): selectionOptionConverter로 답변을 태그로 직접 변환(LLM 0회).
 *
 * freeform은 의미 있는 추출 신호가 있을 때만 expandIntents → searchWithProfile로 검색한다.
 * guided는 사용자가 고른 모든 선택지를 만족하는 상품만 별도 strict filter로 검색한다.
 */

import catalog from '../data/keyboards.json';
import type { Keyboard, RecommendInput, RecommendResult } from '../types';
import { sanitizeTags, type ExtractedTags, type IntentExtraction } from './extractRawTags';
import { expandIntents, isIntentTag } from './intentProfile';
import { searchWithProfile } from './intentSearch';
import { EMPTY_RESULT_SUMMARY, toRecommendations, buildSummary } from './searchResultComposition';
import { selectionOptionConverter } from './guidedInputMapper';
import type { SearchOutput, SearchResultItem } from './searchEngine';
import { deriveRankOrder, getMatchedSoftTags, scoreBySoftTags } from './softScorer';

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

function emptySearchResult(): RecommendResult {
  return {
    summary: EMPTY_RESULT_SUMMARY,
    recommendations: [],
  };
}

function hasMeaningfulHardConstraints(extraction: IntentExtraction): boolean {
  return Object.values(extraction.hardConstraints).some((value) => {
    if (typeof value === 'number') {
      return value > 0;
    }
    return typeof value === 'string' && value.trim().length > 0;
  });
}

function hasSearchSignal(extraction: IntentExtraction): boolean {
  return (
    extraction.intents.length > 0 ||
    hasMeaningfulHardConstraints(extraction) ||
    extraction.softIntentTags.length > 0
  );
}

function hasBroadKeyboardIntent(query: string): boolean {
  return /키보드|키캡|스위치|타건|배열|풀배열|텐키리스|무접점|기계식|펜타그래프|축|백라이트|rgb|유선|무선|블루투스|게이밍|사무/i.test(
    query,
  );
}

function hasRawExtractionSignal(data: unknown): boolean {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return false;
  }

  const record = data as Record<string, unknown>;
  const hardConstraints = record.hardConstraints;
  const hasRawHardConstraint =
    !!hardConstraints &&
    typeof hardConstraints === 'object' &&
    !Array.isArray(hardConstraints) &&
    Object.values(hardConstraints).some((value) => {
      if (typeof value === 'number') {
        return value > 0;
      }
      return typeof value === 'string' && value.trim().length > 0;
    });

  return (
    (Array.isArray(record.intents) && record.intents.length > 0) ||
    (Array.isArray(record.softIntentTags) && record.softIntentTags.length > 0) ||
    hasRawHardConstraint
  );
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

  const data = await response.json();
  const extraction = sanitizeExtraction(data);
  if (hasRawExtractionSignal(data) && !hasSearchSignal(extraction)) {
    console.warn('[keybuddy] 태그 추출 응답이 클라이언트 스키마 정제 후 비었습니다.', data);
  }
  return extraction;
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

function keyboardText(keyboard: Keyboard): string {
  return [
    keyboard.product_name,
    keyboard.brand,
    keyboard.switch_type,
    keyboard.connection,
    keyboard.layout,
    keyboard.key_force,
    keyboard.wireless_type,
    keyboard.engraving,
    keyboard.backlight,
    keyboard.raw_switch_name ?? '',
    keyboard.switch_name ?? '',
  ].join(' ');
}

function parseKeyForce(force: string): number | null {
  const match = force.match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

function hasWiredSupport(keyboard: Keyboard): boolean {
  return /유선/.test(keyboard.connection) || /유선/.test(keyboard.wireless_type);
}

function hasWirelessSupport(keyboard: Keyboard): boolean {
  return /무선|블루투스|동글|리시버|2\.4GHz/i.test(`${keyboard.connection} ${keyboard.wireless_type}`);
}

function matchesPurpose(keyboard: Keyboard, answer: string): boolean {
  const text = keyboardText(keyboard);
  if (answer === '사무용') {
    return /무접점|펜타그래프|저소음|멤브레인/.test(text) && !/청축/.test(text);
  }
  if (answer === '게임용') {
    return /기계식|광축|자석축/.test(text);
  }
  return true;
}

function matchesPortability(keyboard: Keyboard, answer: string): boolean {
  if (answer !== '자주 가지고 다닐래요') {
    return true;
  }

  const text = keyboardText(keyboard);
  const hasCompactLayout = /텐키리스|미니|75%|75배열|65%|65배열|60%|60배열|87키|84키|68키|61키/.test(text);
  const hasPortableWeight = typeof keyboard.weight_g === 'number' && keyboard.weight_g > 0 && keyboard.weight_g <= 900;

  return hasWirelessSupport(keyboard) && (hasCompactLayout || hasPortableWeight);
}

function matchesSound(keyboard: Keyboard, answer: string): boolean {
  const text = keyboardText(keyboard);
  if (/매우 낮음|낮음/.test(answer)) {
    return /무접점|펜타그래프|저소음|멤브레인/.test(text) && !/청축/.test(text);
  }
  if (/조금 큼|시끄러워도 됨/.test(answer)) {
    return /기계식|광축|자석축|청축|갈축|적축/.test(text);
  }
  return true;
}

function matchesKeyFeel(keyboard: Keyboard, answer: string): boolean {
  const text = keyboardText(keyboard);
  if (/또각또각|서걱서걱/.test(answer)) return /기계식/.test(text);
  if (/보글보글/.test(answer)) return /무접점/.test(text);
  return true;
}

function matchesKeyForce(keyboard: Keyboard, answer: string): boolean {
  const force = parseKeyForce(keyboard.key_force);
  if (/35~45g/.test(answer)) return force !== null && force >= 35 && force <= 45;
  if (/45~55g/.test(answer)) return force !== null && force >= 45 && force <= 55;
  if (/60g 이상/.test(answer)) return force !== null && force >= 60;
  return true;
}

function matchesConnection(keyboard: Keyboard, answer: string): boolean {
  const text = `${keyboard.connection} ${keyboard.wireless_type}`;
  if (answer === '유선') return hasWiredSupport(keyboard);
  if (answer === '무선 USB 동글') return /동글|리시버|2\.4GHz/i.test(text);
  if (answer === '블루투스') return /블루투스/.test(text);
  if (answer === '유/무선 모두') return hasWiredSupport(keyboard) && hasWirelessSupport(keyboard);
  return true;
}

function matchesLayout(keyboard: Keyboard, answer: string): boolean {
  const text = keyboardText(keyboard);
  if (/풀배열/.test(answer)) return /풀배열|104키|108키/.test(text);
  if (/1800/.test(answer)) return /1800|96키|98키|99키|100키/.test(text);
  if (/텐키리스/.test(answer)) return /텐키리스|87키|TKL/i.test(text);
  if (/75%/.test(answer)) return /75%|75배열|84키/.test(text);
  if (/65%/.test(answer)) return /65%|65배열|68키/.test(text);
  if (/60%/.test(answer)) return /미니|60%|60배열|61키/.test(text);
  return true;
}

function matchesEngraving(keyboard: Keyboard, answer: string): boolean {
  const engraving = keyboard.engraving;
  if (answer === '한국어, 영어가 모두 필요해요') return /한\/영|한영|한국어.*영어|영어.*한국어/.test(engraving);
  if (answer === '영어만 적혀있길 바라요') return /영문/.test(engraving) && !/한\/영|한영/.test(engraving);
  if (answer === '한국어만 적혀있길 바라요') return /한글|한국어/.test(engraving) && !/영문|영어|한\/영|한영/.test(engraving);
  return true;
}

function matchesBacklight(keyboard: Keyboard, answer: string): boolean {
  const backlight = keyboard.backlight;
  if (answer === '화려한 RGB가 좋아요') return /RGB/.test(backlight);
  if (answer === '은은한 단색 조명이 좋아요') return /단색/.test(backlight);
  if (answer === '없어도 돼요 (배터리 절약)') return /없음|정보없음/.test(backlight);
  return true;
}

function matchesGuidedAnswers(
  keyboard: Keyboard,
  answers: Record<string, string>,
  budget: { min: number; max: number },
): boolean {
  if (keyboard.price < budget.min || keyboard.price > budget.max) {
    return false;
  }

  return (
    matchesPurpose(keyboard, answers['용도'] ?? '') &&
    matchesPortability(keyboard, answers['휴대성'] ?? '') &&
    matchesSound(keyboard, answers['소리'] ?? '') &&
    matchesKeyFeel(keyboard, answers['키감'] ?? '') &&
    matchesKeyForce(keyboard, answers['키압'] ?? '') &&
    matchesConnection(keyboard, answers['연결방식'] ?? '') &&
    matchesLayout(keyboard, answers['크기'] ?? '') &&
    matchesEngraving(keyboard, answers['각인'] ?? '') &&
    matchesBacklight(keyboard, answers['백라이트'] ?? '')
  );
}

function runGuidedStrictSearch(
  answers: Record<string, string>,
  budget: { min: number; max: number },
): RecommendResult {
  const explicit = selectionOptionConverter(answers, budget);
  const filtered = keyboards.filter((keyboard) => matchesGuidedAnswers(keyboard, answers, budget));
  const scoreVector = scoreBySoftTags(filtered, explicit.softIntentTags);
  const rankOrder = deriveRankOrder(scoreVector);
  const catalogIndex = new Map<Keyboard, number>(keyboards.map((keyboard, index) => [keyboard, index]));

  const results: SearchResultItem[] = rankOrder.map((filteredIndex) => {
    const keyboard = filtered[filteredIndex];
    const { score } = scoreVector[filteredIndex];
    const matchedTags = getMatchedSoftTags(keyboard, explicit.softIntentTags);
    return {
      keyboard,
      keyboardIndex: catalogIndex.get(keyboard) ?? -1,
      score,
      matchedTags,
      satisfiesHardConstraints: true,
      isFallback: false,
      relaxedConstraints: [],
      relaxationStepCount: 0,
    };
  });

  const output: SearchOutput = {
    results,
    isFallback: false,
    relaxedConstraints: [],
    relaxationStepCount: 0,
  };

  return {
    summary: buildSummary(output, MAX_RESULTS),
    recommendations: toRecommendations(output, MAX_RESULTS),
  };
}

export async function recommend(input: RecommendInput): Promise<RecommendResult> {
  // guided: 선택 답변을 결정론으로 태그 변환 (서버/LLM 호출 0회)
  if (input.mode === 'guided') {
    return runGuidedStrictSearch(input.answers, input.budget);
  }

  // freeform: 서버에서 OpenAI 태그추출만, 검색·랭킹은 클라 결정론
  const extraction = await extractTags(input.query);
  if (!hasSearchSignal(extraction)) {
    if (hasBroadKeyboardIntent(input.query)) {
      return runDeterministicSearch([], { hardConstraints: {}, softIntentTags: [] });
    }
    return emptySearchResult();
  }

  return runDeterministicSearch(extraction.intents, {
    hardConstraints: extraction.hardConstraints,
    softIntentTags: extraction.softIntentTags,
  });
}
