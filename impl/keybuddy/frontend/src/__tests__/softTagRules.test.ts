/**
 * softTagRules 단위 테스트
 *
 * 검증 대상:
 * 1. 정적 규칙표(SOFT_TAG_RULE_TABLE) 구조 무결성
 * 2. checkRuleTableCompleteness - 태그 완전성 검사 함수
 *    - 완전한 규칙표: 누락 태그 0건
 *    - 불완전한 규칙표: 누락 태그 목록 반환
 *    - 빈 규칙표: 전체 vocab 반환
 */

import { describe, it, expect } from 'vitest';
import {
  SOFT_TAG_RULE_TABLE,
  checkRuleTableCompleteness,
  type SoftTagRuleEntry,
  type AttributePredicate,
} from '../lib/softTagRules';
import { SOFT_INTENT_VOCAB, type SoftIntentTag } from '../lib/tagSchema';

// ---------------------------------------------------------------------------
// 규칙표 구조 무결성 검사
// ---------------------------------------------------------------------------

describe('SOFT_TAG_RULE_TABLE 구조', () => {
  it('SOFT_INTENT_VOCAB과 동일한 태그 개수를 커버한다', () => {
    const coveredTags = new Set(SOFT_TAG_RULE_TABLE.map((e) => e.tag));
    expect(coveredTags.size).toBe(SOFT_INTENT_VOCAB.length);
  });

  it('모든 태그가 SOFT_INTENT_VOCAB에 속하는 유효한 식별자다', () => {
    const vocab = new Set(SOFT_INTENT_VOCAB);
    SOFT_TAG_RULE_TABLE.forEach((entry) => {
      expect(vocab.has(entry.tag)).toBe(true);
    });
  });

  it('각 규칙 엔트리는 최소 1개의 술어를 가진다', () => {
    SOFT_TAG_RULE_TABLE.forEach((entry) => {
      expect(entry.predicates.length).toBeGreaterThan(0);
    });
  });

  it('중복 태그 엔트리가 없다', () => {
    const tags = SOFT_TAG_RULE_TABLE.map((e) => e.tag);
    expect(new Set(tags).size).toBe(tags.length);
  });

  it('모든 술어의 field는 유효한 키보드 필드명이다', () => {
    const validFields: AttributePredicate['field'][] = [
      'switch_type',
      'connection',
      'layout',
      'backlight',
      'engraving',
      'wireless_type',
      'price',
      'weight_g',
    ];
    const validFieldSet = new Set(validFields);

    SOFT_TAG_RULE_TABLE.forEach((entry) => {
      entry.predicates.forEach((pred) => {
        expect(validFieldSet.has(pred.field)).toBe(true);
      });
    });
  });

  it('숫자 필드(price, weight_g) 술어의 value는 number 타입이다', () => {
    SOFT_TAG_RULE_TABLE.forEach((entry) => {
      entry.predicates.forEach((pred) => {
        if (pred.field === 'price' || pred.field === 'weight_g') {
          expect(typeof pred.value).toBe('number');
        }
      });
    });
  });

  it('문자열 필드 술어의 value는 string 타입이다', () => {
    const stringFields = ['switch_type', 'connection', 'layout', 'backlight', 'engraving', 'wireless_type'];
    SOFT_TAG_RULE_TABLE.forEach((entry) => {
      entry.predicates.forEach((pred) => {
        if (stringFields.includes(pred.field)) {
          expect(typeof pred.value).toBe('string');
        }
      });
    });
  });
});

// ---------------------------------------------------------------------------
// 핵심 검증: 정적 규칙표가 모든 SOFT_INTENT_VOCAB 태그를 커버한다
// ---------------------------------------------------------------------------

describe('checkRuleTableCompleteness - 현재 정적 규칙표 완전성', () => {
  it('SOFT_TAG_RULE_TABLE은 SOFT_INTENT_VOCAB의 모든 태그를 커버한다 (누락 0건)', () => {
    const missing = checkRuleTableCompleteness();
    expect(missing).toHaveLength(0);
    expect(missing).toEqual([]);
  });

  it('각 SOFT_INTENT_VOCAB 태그에 규칙 엔트리가 존재한다', () => {
    const tagSet = new Set(SOFT_TAG_RULE_TABLE.map((e) => e.tag));
    SOFT_INTENT_VOCAB.forEach((tag) => {
      expect(tagSet.has(tag)).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// 누락 태그 감지 - 불완전한 규칙표 시나리오
// ---------------------------------------------------------------------------

describe('checkRuleTableCompleteness - 누락 태그 반환', () => {
  it('빈 규칙표이면 SOFT_INTENT_VOCAB 전체를 누락으로 반환한다', () => {
    const missing = checkRuleTableCompleteness(SOFT_INTENT_VOCAB, []);
    expect(missing).toHaveLength(SOFT_INTENT_VOCAB.length);
    SOFT_INTENT_VOCAB.forEach((tag) => {
      expect(missing).toContain(tag);
    });
  });

  it('규칙표에서 조용함이 빠지면 누락 목록에 조용함이 포함된다', () => {
    const tableWithout: SoftTagRuleEntry[] = SOFT_TAG_RULE_TABLE.filter(
      (e) => e.tag !== '조용함',
    );
    const missing = checkRuleTableCompleteness(SOFT_INTENT_VOCAB, tableWithout);
    expect(missing).toContain('조용함');
    expect(missing).toHaveLength(1);
  });

  it('규칙표에서 게이밍과 RGB가 빠지면 두 태그가 누락 목록에 포함된다', () => {
    const tableWithout: SoftTagRuleEntry[] = SOFT_TAG_RULE_TABLE.filter(
      (e) => e.tag !== '게이밍' && e.tag !== 'RGB',
    );
    const missing = checkRuleTableCompleteness(SOFT_INTENT_VOCAB, tableWithout);
    expect(missing).toContain('게이밍');
    expect(missing).toContain('RGB');
    expect(missing).toHaveLength(2);
  });

  it('규칙표에서 가성비, 무선, 멀티페어링이 빠지면 세 태그가 누락 목록에 포함된다', () => {
    const removedTags: SoftIntentTag[] = ['가성비', '무선', '멀티페어링'];
    const tableWithout: SoftTagRuleEntry[] = SOFT_TAG_RULE_TABLE.filter(
      (e) => !removedTags.includes(e.tag),
    );
    const missing = checkRuleTableCompleteness(SOFT_INTENT_VOCAB, tableWithout);
    removedTags.forEach((tag) => {
      expect(missing).toContain(tag);
    });
    expect(missing).toHaveLength(3);
  });

  it('predicates가 빈 배열인 엔트리는 커버되지 않은 것으로 처리한다', () => {
    // predicates: [] 이면 술어 매핑 항목이 없으므로 누락으로 간주
    const tableWithEmpty: SoftTagRuleEntry[] = [
      ...SOFT_TAG_RULE_TABLE.filter((e) => e.tag !== '타건감'),
      { tag: '타건감', predicates: [] }, // 빈 술어 - 누락 취급
    ];
    const missing = checkRuleTableCompleteness(SOFT_INTENT_VOCAB, tableWithEmpty);
    expect(missing).toContain('타건감');
  });

  it('커스텀 vocab 부분 집합에 대해 해당 태그들만 검사한다', () => {
    const partialVocab: SoftIntentTag[] = ['조용함', '게이밍', '무선'];
    const tableWithoutGame: SoftTagRuleEntry[] = SOFT_TAG_RULE_TABLE.filter(
      (e) => e.tag !== '게이밍',
    );
    const missing = checkRuleTableCompleteness(partialVocab, tableWithoutGame);
    expect(missing).toContain('게이밍');
    expect(missing).not.toContain('조용함');
    expect(missing).not.toContain('무선');
    expect(missing).toHaveLength(1);
  });

  it('규칙표에 없는 태그 중 정확한 식별자를 반환한다 (오탈자 없음)', () => {
    const tableWithout: SoftTagRuleEntry[] = SOFT_TAG_RULE_TABLE.filter(
      (e) => e.tag !== '한영각인' && e.tag !== '영문각인',
    );
    const missing = checkRuleTableCompleteness(SOFT_INTENT_VOCAB, tableWithout);

    // 반환된 값이 SOFT_INTENT_VOCAB의 실제 식별자와 일치하는지 확인
    missing.forEach((tag) => {
      expect(SOFT_INTENT_VOCAB as readonly string[]).toContain(tag);
    });
    expect(missing).toContain('한영각인');
    expect(missing).toContain('영문각인');
  });
});

// ---------------------------------------------------------------------------
// 경계 케이스
// ---------------------------------------------------------------------------

describe('checkRuleTableCompleteness - 경계 케이스', () => {
  it('vocab이 빈 배열이면 항상 빈 배열을 반환한다', () => {
    const missing = checkRuleTableCompleteness([], SOFT_TAG_RULE_TABLE);
    expect(missing).toHaveLength(0);
  });

  it('규칙표에 중복 태그 엔트리가 있어도 정상 동작한다', () => {
    const tableWithDup: SoftTagRuleEntry[] = [
      ...SOFT_TAG_RULE_TABLE,
      { tag: '조용함', predicates: [{ field: 'switch_type', op: 'contains', value: '무접점' }] },
    ];
    const missing = checkRuleTableCompleteness(SOFT_INTENT_VOCAB, tableWithDup);
    // 중복이 있어도 커버되었으므로 누락 없음
    expect(missing).toHaveLength(0);
  });

  it('반환 배열의 순서는 vocab 순서와 일치한다', () => {
    const removedTags: SoftIntentTag[] = ['조용함', '게이밍', '미니'];
    const tableWithout: SoftTagRuleEntry[] = SOFT_TAG_RULE_TABLE.filter(
      (e) => !removedTags.includes(e.tag),
    );
    const missing = checkRuleTableCompleteness(SOFT_INTENT_VOCAB, tableWithout);

    // SOFT_INTENT_VOCAB 순서 기준으로 정렬되어 있어야 함
    const expectedOrder = SOFT_INTENT_VOCAB.filter((t) => removedTags.includes(t));
    expect(missing).toEqual(expectedOrder);
  });
});
