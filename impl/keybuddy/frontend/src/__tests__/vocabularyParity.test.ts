/**
 * 어휘 동기화 parity 테스트
 *
 * Edge Function의 통제 어휘 사본(supabase/functions/recommend/vocabulary.ts)은
 * 프론트 원본(lib/tagSchema.ts, lib/intentProfile.ts)을 수동 복제한 것이다.
 * keyboards.json은 npm run sync:data로 강제 동기화되지만 이 어휘는 강제 수단이 없어,
 * 한쪽만 바뀌면 추출 프롬프트/서버 정제와 클라이언트 검색 어휘가 어긋난다.
 * 이 테스트가 그 드리프트를 CI에서 잡는다(둘 중 하나를 고치면 빨간불).
 */

import { describe, it, expect } from 'vitest';
import {
  INTENT_VOCABULARY as FN_INTENT_VOCABULARY,
  SOFT_INTENT_VOCAB as FN_SOFT_INTENT_VOCAB,
  HARD_NUMERIC_KEYS as FN_HARD_NUMERIC_KEYS,
  HARD_CONSTRAINT_ENUMS as FN_HARD_CONSTRAINT_ENUMS,
} from '../../../supabase/functions/recommend/vocabulary';
import { INTENT_VOCABULARY as FE_INTENT_VOCABULARY } from '../lib/intentProfile';
import {
  SOFT_INTENT_VOCAB as FE_SOFT_INTENT_VOCAB,
  HARD_NUMERIC_KEYS as FE_HARD_NUMERIC_KEYS,
  HARD_CONSTRAINT_ENUMS as FE_HARD_CONSTRAINT_ENUMS,
} from '../lib/tagSchema';

/** readonly 튜플 객체를 일반 배열 맵으로 정규화해 깊은 비교가 가능하게 한다. */
function normalizeEnums(
  enums: Record<string, readonly string[]>,
): Record<string, string[]> {
  return Object.fromEntries(Object.entries(enums).map(([key, values]) => [key, [...values]]));
}

describe('Edge Function vocabulary.ts ↔ 프론트 어휘 parity', () => {
  it('INTENT_VOCABULARY가 intentProfile.ts와 동일하다', () => {
    expect([...FN_INTENT_VOCABULARY]).toEqual([...FE_INTENT_VOCABULARY]);
  });

  it('SOFT_INTENT_VOCAB가 tagSchema.ts와 동일하다', () => {
    expect([...FN_SOFT_INTENT_VOCAB]).toEqual([...FE_SOFT_INTENT_VOCAB]);
  });

  it('HARD_NUMERIC_KEYS가 tagSchema.ts와 동일하다', () => {
    expect([...FN_HARD_NUMERIC_KEYS]).toEqual([...FE_HARD_NUMERIC_KEYS]);
  });

  it('HARD_CONSTRAINT_ENUMS의 키와 허용값이 tagSchema.ts와 동일하다', () => {
    expect(normalizeEnums(FN_HARD_CONSTRAINT_ENUMS)).toEqual(
      normalizeEnums(FE_HARD_CONSTRAINT_ENUMS),
    );
  });
});
