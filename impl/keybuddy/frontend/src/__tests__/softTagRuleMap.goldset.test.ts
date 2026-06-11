/**
 * 정적 규칙표(soft-tag -> 속성 술어 맵) 구조 검증 골드셋 (Sub-AC 2a)
 *
 * SOFT_TAG_RULE_MAP 모듈을 로드했을 때 골드셋에 포함된 소프트 태그가
 * 모두 키로 존재하고, 각 값이 {attribute(field), operator(op), value} 형태의
 * 올바른 술어 객체 배열임을 확인한다.
 *
 * 검증 차원:
 * 1. 골드셋 태그 10개가 SOFT_TAG_RULE_MAP의 키로 모두 존재
 * 2. 각 값이 배열이며 최소 1개 이상의 술어를 포함
 * 3. 각 술어 객체가 {field, op, value} 구조(개념적 {attribute, operator, value})를 가짐
 * 4. field는 허용된 키보드 속성명 집합에 속함
 * 5. op는 허용된 연산자(eq | contains | lte | gte) 집합에 속함
 * 6. value는 field에 따라 올바른 타입(string | number)을 가짐
 * 7. SOFT_INTENT_VOCAB 전체가 SOFT_TAG_RULE_MAP의 키로 존재 (완전성)
 */

import { describe, it, expect } from 'vitest';
import { SOFT_TAG_RULE_MAP } from '../lib/softTagRules';
import type { AttributePredicate } from '../lib/softTagRules';
import { SOFT_INTENT_VOCAB } from '../lib/tagSchema';
import type { SoftIntentTag } from '../lib/tagSchema';

// ---------------------------------------------------------------------------
// 상수 정의
// ---------------------------------------------------------------------------

/** 허용된 키보드 속성 필드명 집합 */
const VALID_FIELDS: ReadonlySet<AttributePredicate['field']> = new Set([
  'switch_type',
  'connection',
  'layout',
  'backlight',
  'engraving',
  'wireless_type',
  'price',
  'weight_g',
] as AttributePredicate['field'][]);

/** 허용된 술어 연산자 집합 */
const VALID_OPERATORS: ReadonlySet<string> = new Set(['eq', 'contains', 'lte', 'gte']);

/** 숫자 값을 사용하는 필드 집합 */
const NUMERIC_FIELDS: ReadonlySet<string> = new Set(['price', 'weight_g']);

// ---------------------------------------------------------------------------
// 골드셋 - 반드시 규칙표 키로 존재해야 하는 소프트 태그 10개
// ---------------------------------------------------------------------------

/**
 * 대표적인 use-case를 커버하는 소프트 태그 골드셋.
 *
 * - 소리 관련: 조용함, 고소음
 * - 용도 관련: 사무용, 게이밍
 * - 물리 특성: 휴대성, 가벼움
 * - 스위치 계열: 기계식, 무접점
 * - 가격/연결: 가성비, 무선
 */
const SOFT_TAG_GOLD_SET: SoftIntentTag[] = [
  '조용함',
  '고소음',
  '사무용',
  '게이밍',
  '휴대성',
  '가벼움',
  '기계식',
  '무접점',
  '가성비',
  '무선',
];

// ---------------------------------------------------------------------------
// 단위 검증 헬퍼
// ---------------------------------------------------------------------------

/**
 * AttributePredicate 객체가 올바른 {field, op, value} 구조인지 검증한다.
 * field: 허용 필드명, op: 허용 연산자, value: 필드에 따른 올바른 타입
 */
function assertPredicateShape(pred: unknown, context: string): void {
  expect(pred, `${context}: null/undefined 아님`).toBeDefined();
  expect(typeof pred, `${context}: object 타입`).toBe('object');
  expect(pred).not.toBeNull();

  const p = pred as Record<string, unknown>;

  // field (attribute) 검증
  expect(typeof p['field'], `${context}: field는 string`).toBe('string');
  expect(
    VALID_FIELDS.has(p['field'] as AttributePredicate['field']),
    `${context}: field "${String(p['field'])}"는 허용된 키보드 속성명`,
  ).toBe(true);

  // op (operator) 검증
  expect(typeof p['op'], `${context}: op는 string`).toBe('string');
  expect(
    VALID_OPERATORS.has(p['op'] as string),
    `${context}: op "${String(p['op'])}"는 허용된 연산자(eq|contains|lte|gte)`,
  ).toBe(true);

  // value 타입 검증
  if (NUMERIC_FIELDS.has(p['field'] as string)) {
    expect(typeof p['value'], `${context}: 숫자 필드의 value는 number`).toBe('number');
  } else {
    expect(typeof p['value'], `${context}: 문자열 필드의 value는 string`).toBe('string');
  }
}

// ---------------------------------------------------------------------------
// 골드셋 - 태그 키 존재 검증
// ---------------------------------------------------------------------------

describe('SOFT_TAG_RULE_MAP - 골드셋 태그 키 존재 (Sub-AC 2a)', () => {
  it('SOFT_TAG_RULE_MAP이 Record 형태로 로드된다', () => {
    expect(SOFT_TAG_RULE_MAP).toBeDefined();
    expect(typeof SOFT_TAG_RULE_MAP).toBe('object');
    expect(SOFT_TAG_RULE_MAP).not.toBeNull();
  });

  for (const tag of SOFT_TAG_GOLD_SET) {
    it(`골드셋 태그 "${tag}"가 SOFT_TAG_RULE_MAP의 키로 존재한다`, () => {
      expect(
        tag in SOFT_TAG_RULE_MAP,
        `"${tag}"는 SOFT_TAG_RULE_MAP의 키여야 한다`,
      ).toBe(true);
    });
  }

  it('골드셋 10개 태그 전체가 한번에 키로 존재한다', () => {
    const missingTags = SOFT_TAG_GOLD_SET.filter((tag) => !(tag in SOFT_TAG_RULE_MAP));
    expect(missingTags).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 골드셋 - 각 값이 올바른 술어 배열인지 구조 검증
// ---------------------------------------------------------------------------

describe('SOFT_TAG_RULE_MAP - 골드셋 태그의 술어 배열 구조 검증 (Sub-AC 2a)', () => {
  for (const tag of SOFT_TAG_GOLD_SET) {
    describe(`태그 "${tag}"의 술어 배열`, () => {
      it('값이 배열이다', () => {
        expect(Array.isArray(SOFT_TAG_RULE_MAP[tag])).toBe(true);
      });

      it('배열에 최소 1개 이상의 술어가 있다', () => {
        expect(SOFT_TAG_RULE_MAP[tag].length).toBeGreaterThan(0);
      });

      it('모든 술어가 {field, op, value} 구조(개념적: {attribute, operator, value})를 가진다', () => {
        SOFT_TAG_RULE_MAP[tag].forEach((pred, idx) => {
          assertPredicateShape(pred, `"${tag}"[${idx}]`);
        });
      });
    });
  }
});

// ---------------------------------------------------------------------------
// 골드셋 - 태그별 기대 매핑 내용 검증
// ---------------------------------------------------------------------------

describe('SOFT_TAG_RULE_MAP - 골드셋 태그의 기대 매핑 내용', () => {
  it('"조용함" -> switch_type 필드의 무접점/펜타그래프/멤브레인 술어가 존재한다', () => {
    const preds = SOFT_TAG_RULE_MAP['조용함'];
    const switchPreds = preds.filter((p) => p.field === 'switch_type');
    expect(switchPreds.length).toBeGreaterThan(0);
    // 최소 무접점 관련 술어 1개 이상
    const hasQuiet = switchPreds.some(
      (p) =>
        (p.op === 'contains' || p.op === 'eq') &&
        (p.value === '무접점' || p.value === '펜타그래프' || p.value === '멤브레인'),
    );
    expect(hasQuiet).toBe(true);
  });

  it('"게이밍" -> switch_type(기계식) 또는 backlight(RGB) 술어가 존재한다', () => {
    const preds = SOFT_TAG_RULE_MAP['게이밍'];
    const hasMechanical = preds.some((p) => p.field === 'switch_type' && p.value === '기계식');
    const hasRgb = preds.some((p) => p.field === 'backlight');
    expect(hasMechanical || hasRgb).toBe(true);
  });

  it('"무선" -> connection 필드의 무선/유선+무선 술어가 존재한다', () => {
    const preds = SOFT_TAG_RULE_MAP['무선'];
    const connPreds = preds.filter((p) => p.field === 'connection');
    expect(connPreds.length).toBeGreaterThan(0);
    const hasWireless = connPreds.some(
      (p) => p.value === '무선' || p.value === '유선+무선',
    );
    expect(hasWireless).toBe(true);
  });

  it('"가성비" -> price 필드의 lte 술어가 존재하고 value는 양수 number다', () => {
    const preds = SOFT_TAG_RULE_MAP['가성비'];
    const pricePred = preds.find((p) => p.field === 'price' && p.op === 'lte');
    expect(pricePred).toBeDefined();
    expect(typeof pricePred!.value).toBe('number');
    expect(pricePred!.value as number).toBeGreaterThan(0);
  });

  it('"가벼움" -> weight_g 필드의 lte 술어가 존재하고 value는 양수 number다', () => {
    const preds = SOFT_TAG_RULE_MAP['가벼움'];
    const weightPred = preds.find((p) => p.field === 'weight_g' && p.op === 'lte');
    expect(weightPred).toBeDefined();
    expect(typeof weightPred!.value).toBe('number');
    expect(weightPred!.value as number).toBeGreaterThan(0);
  });

  it('"기계식" -> switch_type 필드의 eq 술어가 존재한다', () => {
    const preds = SOFT_TAG_RULE_MAP['기계식'];
    const mechPred = preds.find((p) => p.field === 'switch_type' && p.op === 'eq' && p.value === '기계식');
    expect(mechPred).toBeDefined();
  });

  it('"무접점" -> switch_type 필드의 contains 술어가 존재한다', () => {
    const preds = SOFT_TAG_RULE_MAP['무접점'];
    const hallPred = preds.find((p) => p.field === 'switch_type' && p.op === 'contains');
    expect(hallPred).toBeDefined();
  });

  it('"사무용" -> 소음이 적은 switch_type 또는 유선 connection 술어가 존재한다', () => {
    const preds = SOFT_TAG_RULE_MAP['사무용'];
    const hasQuietSwitch = preds.some((p) => p.field === 'switch_type');
    const hasWiredConn = preds.some((p) => p.field === 'connection');
    expect(hasQuietSwitch || hasWiredConn).toBe(true);
  });

  it('"휴대성" -> layout(텐키리스/미니) 또는 connection(무선) 또는 weight_g(lte) 술어가 존재한다', () => {
    const preds = SOFT_TAG_RULE_MAP['휴대성'];
    const hasLayout = preds.some((p) => p.field === 'layout');
    const hasWireless = preds.some((p) => p.field === 'connection');
    const hasWeight = preds.some((p) => p.field === 'weight_g');
    expect(hasLayout || hasWireless || hasWeight).toBe(true);
  });

  it('"고소음" -> switch_type 필드의 기계식 eq 술어가 존재한다', () => {
    const preds = SOFT_TAG_RULE_MAP['고소음'];
    const loudPred = preds.find((p) => p.field === 'switch_type' && p.value === '기계식');
    expect(loudPred).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 완전성 - SOFT_INTENT_VOCAB 전체가 키로 존재
// ---------------------------------------------------------------------------

describe('SOFT_TAG_RULE_MAP - SOFT_INTENT_VOCAB 완전성 검증', () => {
  it('SOFT_INTENT_VOCAB의 모든 태그가 SOFT_TAG_RULE_MAP에 키로 존재한다', () => {
    const missingTags = (SOFT_INTENT_VOCAB as readonly string[]).filter(
      (tag) => !(tag in SOFT_TAG_RULE_MAP),
    );
    expect(missingTags).toEqual([]);
  });

  it('SOFT_TAG_RULE_MAP의 키 수는 SOFT_INTENT_VOCAB의 크기와 같다', () => {
    const mapKeyCount = Object.keys(SOFT_TAG_RULE_MAP).length;
    expect(mapKeyCount).toBe(SOFT_INTENT_VOCAB.length);
  });
});

// ---------------------------------------------------------------------------
// 전체 규칙표 구조 - 모든 태그의 모든 술어가 {field, op, value} 구조를 가짐
// ---------------------------------------------------------------------------

describe('SOFT_TAG_RULE_MAP - 전체 규칙표 술어 구조 무결성', () => {
  it('모든 태그의 모든 술어가 올바른 {field, op, value} 구조를 가진다', () => {
    for (const tag of Object.keys(SOFT_TAG_RULE_MAP) as SoftIntentTag[]) {
      const preds = SOFT_TAG_RULE_MAP[tag];
      expect(Array.isArray(preds), `"${tag}"의 값은 배열`).toBe(true);
      expect(preds.length, `"${tag}"의 술어 수는 1 이상`).toBeGreaterThan(0);

      preds.forEach((pred, idx) => {
        assertPredicateShape(pred, `"${tag}"[${idx}]`);
      });
    }
  });

  it('중복 키 없이 모든 태그가 고유한 키로 매핑된다', () => {
    const keys = Object.keys(SOFT_TAG_RULE_MAP);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
