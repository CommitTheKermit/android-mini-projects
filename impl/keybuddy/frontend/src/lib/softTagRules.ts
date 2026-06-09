/**
 * 소프트태그 -> 속성 술어 정적 규칙표
 *
 * 빌드 시 LLM이 1회 생성한 정적 산출물 (저장소 체크인).
 * 쿼리 시점에 이 규칙표로 속성 술어를 확장하며, 런타임 LLM 호출 없이 결정론 검색에 사용한다.
 *
 * 술어 구조:
 *   - field: Keyboard 레코드의 필드명 (또는 파생 필드 key_force_grams)
 *   - op: eq(동일) | contains(포함) | lte(이하) | gte(이상)
 *   - value: 비교 대상 값
 *
 * 각 태그에 predicates가 하나 이상 있어야 한다.
 * 같은 태그 내 predicates는 OR(하나라도 일치하면 점수 부여) 조건이다.
 */

import { SOFT_INTENT_VOCAB, type SoftIntentTag } from './tagSchema';

// ---------------------------------------------------------------------------
// 술어 타입 정의
// ---------------------------------------------------------------------------

export type AttributePredicate =
  | { field: 'switch_type'; op: 'eq' | 'contains'; value: string }
  | { field: 'connection'; op: 'eq' | 'contains'; value: string }
  | { field: 'layout'; op: 'eq'; value: string }
  | { field: 'backlight'; op: 'eq' | 'contains'; value: string }
  | { field: 'engraving'; op: 'eq' | 'contains'; value: string }
  | { field: 'wireless_type'; op: 'eq' | 'contains'; value: string }
  | { field: 'price'; op: 'lte' | 'gte'; value: number }
  | { field: 'weight_g'; op: 'lte' | 'gte'; value: number };

export interface SoftTagRuleEntry {
  /** SOFT_INTENT_VOCAB에 속한 태그 식별자 */
  tag: SoftIntentTag;
  /**
   * 이 태그와 매칭되는 키보드 속성 술어 목록.
   * predicates 중 하나라도 만족하면 해당 태그의 점수를 부여한다 (OR 조건).
   * 최소 1개 이상이어야 한다.
   */
  predicates: AttributePredicate[];
}

// ---------------------------------------------------------------------------
// 정적 규칙표 (LLM 1회 생성 산출물)
// ---------------------------------------------------------------------------

/**
 * SOFT_TAG_RULE_TABLE: 소프트 의도 태그를 키보드 속성 술어로 매핑하는 정적 규칙표.
 *
 * 생성 근거:
 * - 조용함/저소음: 무접점, 펜타그래프, 멤브레인 스위치 계열은 타이핑 소음이 낮다
 * - 고소음/경쾌함: 기계식 스위치는 타이핑 소음과 경쾌한 타건감을 제공한다
 * - 사무용: 소음이 적은 스위치(무접점/펜타그래프/멤브레인) 또는 유선 연결이 업무에 적합하다
 * - 게이밍: 기계식 스위치 또는 RGB 백라이트는 게이밍 특성을 나타낸다
 * - 휴대성: 텐키리스/미니 레이아웃, 무선/유무선 연결, 800g 이하 무게
 * - 가벼움: 800g 이하 무게
 * - 무거움: 900g 이상 무게 (단단한 빌드감 선호)
 * - 타건감: 기계식 또는 무접점 자석/광축 스위치는 독특한 타건감을 제공한다
 * - RGB: RGB 백라이트 탑재 모델
 * - 백라이트: 백라이트 계열(RGB/레인보우/단색) 탑재 모델
 * - 백라이트없음: 백라이트가 없는 모델 (집중, 심플 선호)
 * - 무선: 무선 또는 유무선 지원 모델
 * - 멀티페어링: 블루투스를 통한 다중 기기 연결 지원
 * - 가성비: 가격 10만원 이하 모델
 * - 기계식: 기계식 스위치
 * - 무접점: 무접점(자석/광축) 스위치 계열
 * - 펜타그래프: 펜타그래프 스위치
 * - 한영각인: 한/영 정각 키캡
 * - 영문각인: 영문 정각 또는 레이저각인 키캡
 * - 풀배열: 풀배열(104/108키) 레이아웃
 * - 텐키리스: 텐키리스(87/96키 등 숫자패드 없음) 레이아웃
 * - 미니: 미니(60%/65% 등 소형) 레이아웃
 */
export const SOFT_TAG_RULE_TABLE: SoftTagRuleEntry[] = [
  {
    tag: '조용함',
    predicates: [
      { field: 'switch_type', op: 'contains', value: '무접점' },
      { field: 'switch_type', op: 'eq', value: '펜타그래프' },
      { field: 'switch_type', op: 'eq', value: '멤브레인' },
    ],
  },
  {
    tag: '저소음',
    predicates: [
      { field: 'switch_type', op: 'contains', value: '무접점' },
      { field: 'switch_type', op: 'eq', value: '펜타그래프' },
      { field: 'switch_type', op: 'eq', value: '멤브레인' },
    ],
  },
  {
    tag: '고소음',
    predicates: [
      { field: 'switch_type', op: 'eq', value: '기계식' },
    ],
  },
  {
    tag: '경쾌함',
    predicates: [
      { field: 'switch_type', op: 'eq', value: '기계식' },
    ],
  },
  {
    tag: '사무용',
    predicates: [
      { field: 'switch_type', op: 'contains', value: '무접점' },
      { field: 'switch_type', op: 'eq', value: '펜타그래프' },
      { field: 'switch_type', op: 'eq', value: '멤브레인' },
      { field: 'connection', op: 'eq', value: '유선' },
    ],
  },
  {
    tag: '게이밍',
    predicates: [
      { field: 'switch_type', op: 'eq', value: '기계식' },
      { field: 'backlight', op: 'contains', value: 'RGB' },
    ],
  },
  {
    tag: '휴대성',
    predicates: [
      { field: 'layout', op: 'eq', value: '텐키리스' },
      { field: 'layout', op: 'eq', value: '미니' },
      { field: 'connection', op: 'eq', value: '무선' },
      { field: 'connection', op: 'eq', value: '유선+무선' },
      { field: 'weight_g', op: 'lte', value: 800 },
    ],
  },
  {
    tag: '가벼움',
    predicates: [
      { field: 'weight_g', op: 'lte', value: 800 },
    ],
  },
  {
    tag: '무거움',
    predicates: [
      { field: 'weight_g', op: 'gte', value: 900 },
    ],
  },
  {
    tag: '타건감',
    predicates: [
      { field: 'switch_type', op: 'eq', value: '기계식' },
      { field: 'switch_type', op: 'contains', value: '무접점 자석축' },
      { field: 'switch_type', op: 'contains', value: '무접점 광축' },
    ],
  },
  {
    tag: 'RGB',
    predicates: [
      { field: 'backlight', op: 'contains', value: 'RGB' },
    ],
  },
  {
    tag: '백라이트',
    predicates: [
      { field: 'backlight', op: 'contains', value: '백라이트' },
    ],
  },
  {
    tag: '백라이트없음',
    predicates: [
      { field: 'backlight', op: 'eq', value: '없음' },
    ],
  },
  {
    tag: '무선',
    predicates: [
      { field: 'connection', op: 'eq', value: '무선' },
      { field: 'connection', op: 'eq', value: '유선+무선' },
    ],
  },
  {
    tag: '멀티페어링',
    predicates: [
      { field: 'wireless_type', op: 'contains', value: '블루투스' },
    ],
  },
  {
    tag: '가성비',
    predicates: [
      { field: 'price', op: 'lte', value: 100000 },
    ],
  },
  {
    tag: '기계식',
    predicates: [
      { field: 'switch_type', op: 'eq', value: '기계식' },
    ],
  },
  {
    tag: '무접점',
    predicates: [
      { field: 'switch_type', op: 'contains', value: '무접점' },
    ],
  },
  {
    tag: '펜타그래프',
    predicates: [
      { field: 'switch_type', op: 'eq', value: '펜타그래프' },
    ],
  },
  {
    tag: '한영각인',
    predicates: [
      { field: 'engraving', op: 'eq', value: '한/영 정각' },
    ],
  },
  {
    tag: '영문각인',
    predicates: [
      { field: 'engraving', op: 'eq', value: '영문 정각' },
      { field: 'engraving', op: 'eq', value: '레이저각인 키캡' },
    ],
  },
  {
    tag: '풀배열',
    predicates: [
      { field: 'layout', op: 'eq', value: '풀배열' },
    ],
  },
  {
    tag: '텐키리스',
    predicates: [
      { field: 'layout', op: 'eq', value: '텐키리스' },
    ],
  },
  {
    tag: '미니',
    predicates: [
      { field: 'layout', op: 'eq', value: '미니' },
    ],
  },
];

// ---------------------------------------------------------------------------
// 맵(Map) 형태 뷰 - soft-tag -> 속성 술어 배열
// ---------------------------------------------------------------------------

/**
 * SOFT_TAG_RULE_MAP: 소프트 의도 태그를 키, 속성 술어 배열을 값으로 하는 맵 뷰.
 *
 * SOFT_TAG_RULE_TABLE(배열)과 동일한 정보를 Record 형태로 제공한다.
 * 각 값(AttributePredicate[])은 {field, op, value} 구조의 술어 객체 배열이며,
 * 이는 개념적으로 {attribute, operator, value} 형태에 대응한다.
 *   - field  = attribute (비교 대상 키보드 속성명)
 *   - op     = operator  (eq | contains | lte | gte)
 *   - value  = value     (비교 값)
 */
export const SOFT_TAG_RULE_MAP: Readonly<Record<SoftIntentTag, AttributePredicate[]>> =
  Object.fromEntries(
    SOFT_TAG_RULE_TABLE.map((entry) => [entry.tag, entry.predicates]),
  ) as Record<SoftIntentTag, AttributePredicate[]>;

// ---------------------------------------------------------------------------
// 완전성 검사
// ---------------------------------------------------------------------------

/**
 * 태그 스키마에 정의된 모든 소프트 태그 식별자가
 * 규칙표에 최소 하나의 속성 술어 매핑 항목을 가지는지 확인한다.
 *
 * @param vocab - 검사할 소프트 태그 어휘 목록 (기본: SOFT_INTENT_VOCAB)
 * @param ruleTable - 검사 대상 규칙표 (기본: SOFT_TAG_RULE_TABLE)
 * @returns 규칙표에 매핑이 없는 태그 목록 (모두 커버되면 빈 배열)
 */
export function checkRuleTableCompleteness(
  vocab: readonly SoftIntentTag[] = SOFT_INTENT_VOCAB,
  ruleTable: SoftTagRuleEntry[] = SOFT_TAG_RULE_TABLE,
): SoftIntentTag[] {
  // 규칙표에 최소 1개의 술어를 가진 태그 집합
  const coveredTags = new Set(
    ruleTable
      .filter((entry) => entry.predicates.length > 0)
      .map((entry) => entry.tag),
  );

  return vocab.filter((tag) => !coveredTags.has(tag));
}
