/**
 * softScorer: 소프트 의도 태그 기반 결정론 스코어링 함수
 *
 * 입력: 키보드 목록 + SoftIntentTag[] (의도 태그 집합)
 * 출력: 키보드별 점수 벡터 (KeyboardScore[])
 *
 * 알고리즘:
 * - 각 키보드에 대해 소프트 태그별로 SOFT_TAG_RULE_TABLE의 술어를 평가한다.
 * - 술어 중 하나라도 만족하면 해당 태그 점수 +1 (OR 조건).
 * - 최종 점수 = 매칭된 태그 수.
 *
 * LLM 호출 없이 순수 함수로 동작한다. 동일 입력 -> 동일 출력 보장.
 */

import type { Keyboard } from '../types';
import { SOFT_TAG_RULE_TABLE, type AttributePredicate } from './softTagRules';
import type { SoftIntentTag } from './tagSchema';

// ---------------------------------------------------------------------------
// 결과 타입
// ---------------------------------------------------------------------------

/** 키보드 1건의 스코어 정보 */
export interface KeyboardScore {
  /** keyboards 배열에서의 인덱스 */
  keyboardIndex: number;
  /** 매칭된 소프트 태그 수 (점수) */
  score: number;
  /** 매칭된 소프트 태그 목록 (매칭 근거) */
  matchedTags: SoftIntentTag[];
}

// ---------------------------------------------------------------------------
// 내부 평가 함수
// ---------------------------------------------------------------------------

/**
 * 단일 속성 술어를 키보드에 대해 평가한다.
 *
 * op별 의미:
 * - eq      : 정확히 일치
 * - contains: 문자열 포함 (substring)
 * - lte     : 숫자 이하
 * - gte     : 숫자 이상
 */
function evaluatePredicate(keyboard: Keyboard, pred: AttributePredicate): boolean {
  switch (pred.field) {
    case 'switch_type':
    case 'connection':
    case 'layout':
    case 'backlight':
    case 'engraving':
    case 'wireless_type': {
      const fieldVal: string = keyboard[pred.field];
      if (pred.op === 'eq') return fieldVal === (pred.value as string);
      if (pred.op === 'contains')
        return typeof fieldVal === 'string' && fieldVal.includes(pred.value as string);
      return false;
    }
    case 'price':
    case 'weight_g': {
      const numVal: number = keyboard[pred.field];
      if (pred.op === 'lte') return numVal <= (pred.value as number);
      if (pred.op === 'gte') return numVal >= (pred.value as number);
      return false;
    }
    default:
      return false;
  }
}

/**
 * 키보드가 소프트 태그의 술어 조건을 만족하는지 확인한다.
 *
 * SOFT_TAG_RULE_TABLE에서 태그에 해당하는 엔트리를 찾아
 * predicates 중 하나라도 만족하면 true(OR 조건).
 * 태그가 규칙표에 없거나 술어가 빈 배열이면 false.
 */
function matchesSoftTag(keyboard: Keyboard, tag: SoftIntentTag): boolean {
  const rule = SOFT_TAG_RULE_TABLE.find((r) => r.tag === tag);
  if (!rule || rule.predicates.length === 0) return false;
  return rule.predicates.some((pred) => evaluatePredicate(keyboard, pred));
}

// ---------------------------------------------------------------------------
// 공개 API
// ---------------------------------------------------------------------------

/**
 * 단일 키보드에 대해 소프트 의도 태그 중 매칭되는 태그 배열을 반환한다.
 *
 * 결과 객체의 matchedTags 필드 계산에 쓰이며, 동일 입력에 항상 동일 출력을 보장한다.
 * 입력 softTags 순서를 보존하여 반환하므로 정렬이 결정론적이다.
 *
 * @param keyboard - 평가 대상 단일 키보드
 * @param softTags - 쿼리 소프트 의도 태그 집합 (SOFT_INTENT_VOCAB 내 값)
 * @returns softTags 중 keyboard 속성에 매칭되는 태그 배열 (입력 순서 보존)
 *
 * 특성:
 * - 동일 입력 -> 동일 출력 (결정론)
 * - LLM 호출 없이 순수 함수로 동작
 * - softTags 순서를 보존하므로 결과 순서도 결정론적
 */
export function getMatchedSoftTags(keyboard: Keyboard, softTags: SoftIntentTag[]): SoftIntentTag[] {
  return softTags.filter((tag) => matchesSoftTag(keyboard, tag));
}

/**
 * 키보드 목록을 소프트 의도 태그 집합으로 스코어링한다.
 *
 * @param keyboards - 스코어링 대상 키보드 목록
 * @param softTags  - 소프트 의도 태그 집합 (SOFT_INTENT_VOCAB 내 값)
 * @returns 키보드별 점수 벡터 (keyboards 인덱스 순서 보존)
 *
 * 특성:
 * - 동일 입력 -> 동일 출력 (결정론)
 * - LLM 호출 없이 순수 함수로 동작
 * - softTags 순서에 관계없이 동일 집합이면 동일 점수
 */
export function scoreBySoftTags(
  keyboards: Keyboard[],
  softTags: SoftIntentTag[],
): KeyboardScore[] {
  if (softTags.length === 0) {
    return keyboards.map((_, index) => ({
      keyboardIndex: index,
      score: 0,
      matchedTags: [],
    }));
  }

  return keyboards.map((kb, index) => {
    const matchedTags: SoftIntentTag[] = [];
    for (const tag of softTags) {
      if (matchesSoftTag(kb, tag)) {
        matchedTags.push(tag);
      }
    }
    return {
      keyboardIndex: index,
      score: matchedTags.length,
      matchedTags,
    };
  });
}

/**
 * 점수 벡터로부터 순위 배열을 도출한다.
 *
 * - 점수 내림차순 정렬
 * - 동점이면 keyboardIndex 오름차순 (안정 정렬)
 *
 * @returns keyboardIndex의 순위 배열 (0번 원소가 1위 키보드 인덱스)
 */
export function deriveRankOrder(scoreVector: KeyboardScore[]): number[] {
  return [...scoreVector]
    .sort((a, b) => b.score - a.score || a.keyboardIndex - b.keyboardIndex)
    .map((s) => s.keyboardIndex);
}
