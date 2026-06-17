/**
 * Sub-AC 2-1-C: 디스패처 함수 단위 테스트
 *
 * dispatchStepToTagSet(stepIndex, value) 와 dispatchStepIdToTagSet(stepId, value)에 대해
 * 10단계 전체 입력 시나리오에서 올바른 TagSet이 결정론적으로 반환되는지 검증한다.
 *
 * 검증 기준:
 * - 각 단계의 유효 선택지 -> 기대 hard / soft 태그 포함 여부
 * - 예산 단계(7)는 { min, max } 입력
 * - 알 수 없는 단계 / 잘못된 value 타입 -> { hard: {}, soft: [] }
 * - 동일 입력에 대해 항상 동일 출력 (결정론성)
 * - LLM 호출 없이 동기 순수 함수
 */

import { describe, it, expect } from 'vitest';
import {
  dispatchStepToTagSet,
  dispatchStepIdToTagSet,
  STEP_ID_TO_INDEX,
  PURPOSE_OPTIONS,
  PORTABILITY_OPTIONS,
  SOUND_OPTIONS,
  KEY_FEEL_OPTIONS,
  KEY_FORCE_OPTIONS,
  CONNECTION_OPTIONS,
  LAYOUT_OPTIONS,
  ENGRAVING_OPTIONS,
  BACKLIGHT_OPTIONS,
} from '../lib/guidedInputMapper';

// ---------------------------------------------------------------------------
// 헬퍼
// ---------------------------------------------------------------------------

function expectEmptyTagSet(result: ReturnType<typeof dispatchStepToTagSet>) {
  expect(result.hard).toEqual({});
  expect(result.soft).toEqual([]);
}

// ---------------------------------------------------------------------------
// Step 0: 용도 (소프트 전용)
// ---------------------------------------------------------------------------

describe('dispatchStepToTagSet - Step 0 (용도)', () => {
  it('사무용 -> soft: [사무용], hard: {}', () => {
    const r = dispatchStepToTagSet(0, PURPOSE_OPTIONS.OFFICE);
    expect(r.hard).toEqual({});
    expect(r.soft).toContain('사무용');
  });

  it('게임용 -> soft: [게이밍], hard: {}', () => {
    const r = dispatchStepToTagSet(0, PURPOSE_OPTIONS.GAMING);
    expect(r.hard).toEqual({});
    expect(r.soft).toContain('게이밍');
  });

  it('상관없음 -> hard: {}, soft: []', () => {
    const r = dispatchStepToTagSet(0, PURPOSE_OPTIONS.ANY);
    expect(r.hard).toEqual({});
    expect(r.soft).toEqual([]);
  });

  it('range 타입 value -> 타입 불일치 -> { hard: {}, soft: [] }', () => {
    expectEmptyTagSet(dispatchStepToTagSet(0, { min: 0, max: 100_000 }));
  });
});

// ---------------------------------------------------------------------------
// Step 1: 휴대성 (소프트 전용)
// ---------------------------------------------------------------------------

describe('dispatchStepToTagSet - Step 1 (휴대성)', () => {
  it('자주 가지고 다닐래요 -> soft: [휴대성, 가벼움], hard: {}', () => {
    const r = dispatchStepToTagSet(1, PORTABILITY_OPTIONS.PORTABLE);
    expect(r.hard).toEqual({});
    expect(r.soft).toContain('휴대성');
    expect(r.soft).toContain('가벼움');
  });

  it('책상에 놓고 쓸 거예요 -> hard: {}, soft: []', () => {
    const r = dispatchStepToTagSet(1, PORTABILITY_OPTIONS.DESK);
    expect(r.hard).toEqual({});
    expect(r.soft).toEqual([]);
  });

  it('상관없음 -> hard: {}, soft: []', () => {
    expectEmptyTagSet(dispatchStepToTagSet(1, PORTABILITY_OPTIONS.ANY));
  });

  it('range 타입 value -> { hard: {}, soft: [] }', () => {
    expectEmptyTagSet(dispatchStepToTagSet(1, { min: 0, max: 500_000 }));
  });
});

// ---------------------------------------------------------------------------
// Step 2: 소리 (소프트 전용)
// ---------------------------------------------------------------------------

describe('dispatchStepToTagSet - Step 2 (소리)', () => {
  it('조용해야 해요 (매우 낮음) -> soft: [조용함, 저소음], hard: {}', () => {
    const r = dispatchStepToTagSet(2, SOUND_OPTIONS.VERY_QUIET);
    expect(r.hard).toEqual({});
    expect(r.soft).toContain('조용함');
    expect(r.soft).toContain('저소음');
  });

  it('조금 소리가 났으면 해요 (낮음) -> soft: [저소음], hard: {}', () => {
    const r = dispatchStepToTagSet(2, SOUND_OPTIONS.QUIET);
    expect(r.hard).toEqual({});
    expect(r.soft).toContain('저소음');
    expect(r.soft).not.toContain('조용함');
  });

  it('적당한 소리 (보통) -> hard: {}, soft: []', () => {
    const r = dispatchStepToTagSet(2, SOUND_OPTIONS.NORMAL);
    expectEmptyTagSet(r);
  });

  it('경쾌한 소리 (조금 큼) -> soft: [경쾌함], hard: {}', () => {
    const r = dispatchStepToTagSet(2, SOUND_OPTIONS.CRISPY);
    expect(r.hard).toEqual({});
    expect(r.soft).toContain('경쾌함');
  });

  it('타건감 위주 (시끄러워도 됨) -> soft: [타건감, 고소음, 경쾌함], hard: {}', () => {
    const r = dispatchStepToTagSet(2, SOUND_OPTIONS.LOUD);
    expect(r.hard).toEqual({});
    expect(r.soft).toContain('타건감');
    expect(r.soft).toContain('고소음');
    expect(r.soft).toContain('경쾌함');
  });

  it('range 타입 value -> { hard: {}, soft: [] }', () => {
    expectEmptyTagSet(dispatchStepToTagSet(2, { min: 0, max: 100_000 }));
  });
});

// ---------------------------------------------------------------------------
// Step 3: 키감 (하드 + 소프트)
// ---------------------------------------------------------------------------

describe('dispatchStepToTagSet - Step 3 (키감)', () => {
  it('또각또각 -> hard: {switch_type:기계식}, soft: [기계식, 타건감, 경쾌함]', () => {
    const r = dispatchStepToTagSet(3, KEY_FEEL_OPTIONS.TACTILE);
    expect(r.hard.switch_type).toBe('기계식');
    expect(r.soft).toContain('기계식');
    expect(r.soft).toContain('타건감');
    expect(r.soft).toContain('경쾌함');
  });

  it('서걱서걱 -> hard: {switch_type:기계식}, soft: [기계식, 타건감]', () => {
    const r = dispatchStepToTagSet(3, KEY_FEEL_OPTIONS.LINEAR);
    expect(r.hard.switch_type).toBe('기계식');
    expect(r.soft).toContain('기계식');
    expect(r.soft).toContain('타건감');
    expect(r.soft).not.toContain('경쾌함');
  });

  it('보글보글 -> hard: {switch_type:무접점}, soft: [무접점, 타건감, 조용함]', () => {
    const r = dispatchStepToTagSet(3, KEY_FEEL_OPTIONS.TOPRE);
    expect(r.hard.switch_type).toBe('무접점');
    expect(r.soft).toContain('무접점');
    expect(r.soft).toContain('타건감');
    expect(r.soft).toContain('조용함');
  });

  it('잘 모르겠어요 -> hard: {}, soft: []', () => {
    const r = dispatchStepToTagSet(3, KEY_FEEL_OPTIONS.UNKNOWN);
    expectEmptyTagSet(r);
  });

  it('range 타입 value -> { hard: {}, soft: [] }', () => {
    expectEmptyTagSet(dispatchStepToTagSet(3, { min: 0, max: 200_000 }));
  });
});

// ---------------------------------------------------------------------------
// Step 4: 키압 (소프트 전용)
// ---------------------------------------------------------------------------

describe('dispatchStepToTagSet - Step 4 (키압)', () => {
  it('가볍게 눌렸으면 좋겠어요 (35~45g) -> soft: [저소음], hard: {}', () => {
    const r = dispatchStepToTagSet(4, KEY_FORCE_OPTIONS.LIGHT);
    expect(r.hard).toEqual({});
    expect(r.soft).toContain('저소음');
  });

  it('보편적인게 좋아요 (45~55g) -> hard: {}, soft: []', () => {
    expectEmptyTagSet(dispatchStepToTagSet(4, KEY_FORCE_OPTIONS.MEDIUM));
  });

  it('묵직한게 좋아요 (60g 이상) -> soft: [타건감], hard: {}', () => {
    const r = dispatchStepToTagSet(4, KEY_FORCE_OPTIONS.HEAVY);
    expect(r.hard).toEqual({});
    expect(r.soft).toContain('타건감');
  });

  it('잘 모르겠어요 -> hard: {}, soft: []', () => {
    expectEmptyTagSet(dispatchStepToTagSet(4, KEY_FORCE_OPTIONS.UNKNOWN));
  });

  it('range 타입 value -> { hard: {}, soft: [] }', () => {
    expectEmptyTagSet(dispatchStepToTagSet(4, { min: 0, max: 300_000 }));
  });
});

// ---------------------------------------------------------------------------
// Step 5: 연결방식 (하드 + 소프트)
// ---------------------------------------------------------------------------

describe('dispatchStepToTagSet - Step 5 (연결방식)', () => {
  it('유선 -> hard: {connection:유선}, soft: []', () => {
    const r = dispatchStepToTagSet(5, CONNECTION_OPTIONS.WIRED);
    expect(r.hard.connection).toBe('유선');
    expect(r.soft).toEqual([]);
  });

  it('무선 USB 동글 -> hard: {connection:무선, wireless_type:전용동글(리시버)}, soft: [무선]', () => {
    const r = dispatchStepToTagSet(5, CONNECTION_OPTIONS.DONGLE);
    expect(r.hard.connection).toBe('무선');
    expect(r.hard.wireless_type).toBe('전용동글(리시버)');
    expect(r.soft).toContain('무선');
    expect(r.soft).not.toContain('멀티페어링');
  });

  it('블루투스 -> hard: {connection:무선, wireless_type:블루투스}, soft: [무선, 멀티페어링]', () => {
    const r = dispatchStepToTagSet(5, CONNECTION_OPTIONS.BLUETOOTH);
    expect(r.hard.connection).toBe('무선');
    expect(r.hard.wireless_type).toBe('블루투스');
    expect(r.soft).toContain('무선');
    expect(r.soft).toContain('멀티페어링');
  });

  it('유/무선 모두 -> hard: {connection:유선+무선}, soft: [무선]', () => {
    const r = dispatchStepToTagSet(5, CONNECTION_OPTIONS.BOTH);
    expect(r.hard.connection).toBe('유선+무선');
    expect(r.soft).toContain('무선');
  });

  it('상관없음 -> hard: {}, soft: []', () => {
    expectEmptyTagSet(dispatchStepToTagSet(5, CONNECTION_OPTIONS.ANY));
  });

  it('range 타입 value -> { hard: {}, soft: [] }', () => {
    expectEmptyTagSet(dispatchStepToTagSet(5, { min: 0, max: 100_000 }));
  });
});

// ---------------------------------------------------------------------------
// Step 6: 크기 (하드 + 소프트)
// ---------------------------------------------------------------------------

describe('dispatchStepToTagSet - Step 6 (크기)', () => {
  it('풀배열 -> hard: {layout:풀배열}, soft: [풀배열]', () => {
    const r = dispatchStepToTagSet(6, LAYOUT_OPTIONS.FULL);
    expect(r.hard.layout).toBe('풀배열');
    expect(r.soft).toContain('풀배열');
  });

  it('1800배열 -> hard: {} (스키마 매핑 없음), soft: [풀배열]', () => {
    const r = dispatchStepToTagSet(6, LAYOUT_OPTIONS.COMPACT_FULL);
    expect(r.hard.layout).toBeUndefined();
    expect(r.soft).toContain('풀배열');
  });

  it('텐키리스 -> hard: {layout:텐키리스}, soft: [텐키리스, 휴대성]', () => {
    const r = dispatchStepToTagSet(6, LAYOUT_OPTIONS.TKL);
    expect(r.hard.layout).toBe('텐키리스');
    expect(r.soft).toContain('텐키리스');
    expect(r.soft).toContain('휴대성');
  });

  it('75%/65% -> hard: {} (스키마 매핑 없음), soft: [텐키리스, 휴대성]', () => {
    for (const layout of [LAYOUT_OPTIONS.SEVENTY_FIVE, LAYOUT_OPTIONS.SIXTY_FIVE]) {
      const r = dispatchStepToTagSet(6, layout);
      expect(r.hard.layout).toBeUndefined();
      expect(r.soft).toContain('텐키리스');
      expect(r.soft).toContain('휴대성');
    }
  });

  it('미니(60%) -> hard: {layout:미니}, soft: [미니, 휴대성]', () => {
    const r = dispatchStepToTagSet(6, LAYOUT_OPTIONS.MINI);
    expect(r.hard.layout).toBe('미니');
    expect(r.soft).toContain('미니');
    expect(r.soft).toContain('휴대성');
  });

  it('range 타입 value -> { hard: {}, soft: [] }', () => {
    expectEmptyTagSet(dispatchStepToTagSet(6, { min: 0, max: 100_000 }));
  });
});

// ---------------------------------------------------------------------------
// Step 7: 예산 (하드 전용 - { min, max } 입력)
// ---------------------------------------------------------------------------

describe('dispatchStepToTagSet - Step 7 (예산)', () => {
  it('min=0, max=1_000_000 -> hard: {}, soft: [] (제약 없음)', () => {
    const r = dispatchStepToTagSet(7, { min: 0, max: 1_000_000 });
    expect(r.hard).toEqual({});
    expect(r.soft).toEqual([]);
  });

  it('min=50_000, max=200_000 -> hard: {price_min:50000, price_max:200000}, soft: []', () => {
    const r = dispatchStepToTagSet(7, { min: 50_000, max: 200_000 });
    expect(r.hard.price_min).toBe(50_000);
    expect(r.hard.price_max).toBe(200_000);
    expect(r.soft).toEqual([]);
  });

  it('min=0, max=100_000 -> hard: {price_max:100000}, soft: []', () => {
    const r = dispatchStepToTagSet(7, { min: 0, max: 100_000 });
    expect(r.hard.price_max).toBe(100_000);
    expect(r.hard.price_min).toBeUndefined();
    expect(r.soft).toEqual([]);
  });

  it('min=30_000, max=1_000_000 -> hard: {price_min:30000}, soft: []', () => {
    const r = dispatchStepToTagSet(7, { min: 30_000, max: 1_000_000 });
    expect(r.hard.price_min).toBe(30_000);
    expect(r.hard.price_max).toBeUndefined();
    expect(r.soft).toEqual([]);
  });

  it('string 타입 value -> { hard: {}, soft: [] } (타입 불일치)', () => {
    expectEmptyTagSet(dispatchStepToTagSet(7, '100000'));
  });

  it('string 빈 값 -> { hard: {}, soft: [] }', () => {
    expectEmptyTagSet(dispatchStepToTagSet(7, ''));
  });
});

// ---------------------------------------------------------------------------
// Step 8: 각인 (하드 + 소프트)
// ---------------------------------------------------------------------------

describe('dispatchStepToTagSet - Step 8 (각인)', () => {
  it('한국어+영어 -> hard: {engraving:한/영 정각}, soft: [한영각인]', () => {
    const r = dispatchStepToTagSet(8, ENGRAVING_OPTIONS.BOTH);
    expect(r.hard.engraving).toBe('한/영 정각');
    expect(r.soft).toContain('한영각인');
  });

  it('영어만 -> hard: {engraving:영문 정각}, soft: [영문각인]', () => {
    const r = dispatchStepToTagSet(8, ENGRAVING_OPTIONS.ENGLISH_ONLY);
    expect(r.hard.engraving).toBe('영문 정각');
    expect(r.soft).toContain('영문각인');
  });

  it('한국어만 -> hard: {}, soft: []', () => {
    expectEmptyTagSet(dispatchStepToTagSet(8, ENGRAVING_OPTIONS.KOREAN_ONLY));
  });

  it('상관없음 -> hard: {}, soft: []', () => {
    expectEmptyTagSet(dispatchStepToTagSet(8, ENGRAVING_OPTIONS.ANY));
  });

  it('range 타입 value -> { hard: {}, soft: [] }', () => {
    expectEmptyTagSet(dispatchStepToTagSet(8, { min: 0, max: 100_000 }));
  });
});

// ---------------------------------------------------------------------------
// Step 9: 백라이트 (하드 + 소프트)
// ---------------------------------------------------------------------------

describe('dispatchStepToTagSet - Step 9 (백라이트)', () => {
  it('화려한 RGB -> hard: {backlight:RGB 백라이트}, soft: [RGB, 백라이트]', () => {
    const r = dispatchStepToTagSet(9, BACKLIGHT_OPTIONS.RGB);
    expect(r.hard.backlight).toBe('RGB 백라이트');
    expect(r.soft).toContain('RGB');
    expect(r.soft).toContain('백라이트');
  });

  it('은은한 단색 조명 -> hard: {backlight:단색 백라이트}, soft: [백라이트]', () => {
    const r = dispatchStepToTagSet(9, BACKLIGHT_OPTIONS.MONO);
    expect(r.hard.backlight).toBe('단색 백라이트');
    expect(r.soft).toContain('백라이트');
    expect(r.soft).not.toContain('RGB');
  });

  it('없어도 돼요 (배터리 절약) -> hard: {backlight:없음}, soft: [백라이트없음]', () => {
    const r = dispatchStepToTagSet(9, BACKLIGHT_OPTIONS.NONE);
    expect(r.hard.backlight).toBe('없음');
    expect(r.soft).toContain('백라이트없음');
    expect(r.soft).not.toContain('백라이트');
  });

  it('range 타입 value -> { hard: {}, soft: [] }', () => {
    expectEmptyTagSet(dispatchStepToTagSet(9, { min: 0, max: 100_000 }));
  });
});

// ---------------------------------------------------------------------------
// 에지 케이스: 알 수 없는 단계 번호
// ---------------------------------------------------------------------------

describe('dispatchStepToTagSet - 알 수 없는 단계', () => {
  it('stepIndex -1 -> { hard: {}, soft: [] }', () => {
    expectEmptyTagSet(dispatchStepToTagSet(-1, '사무용'));
  });

  it('stepIndex 10 -> { hard: {}, soft: [] }', () => {
    expectEmptyTagSet(dispatchStepToTagSet(10, '사무용'));
  });

  it('stepIndex 999 -> { hard: {}, soft: [] }', () => {
    expectEmptyTagSet(dispatchStepToTagSet(999, ''));
  });
});

// ---------------------------------------------------------------------------
// dispatchStepIdToTagSet - ID 기반 디스패처
// ---------------------------------------------------------------------------

describe('dispatchStepIdToTagSet', () => {
  it('STEP_ID_TO_INDEX 테이블에 10단계 전부 있다', () => {
    const expectedIds = ['용도', '휴대성', '소리', '키감', '키압', '연결방식', '크기', '예산', '각인', '백라이트'];
    for (const id of expectedIds) {
      expect(STEP_ID_TO_INDEX[id]).toBeDefined();
    }
    expect(Object.keys(STEP_ID_TO_INDEX)).toHaveLength(10);
  });

  it('용도 -> 사무용 -> soft: [사무용]', () => {
    const r = dispatchStepIdToTagSet('용도', '사무용');
    expect(r.soft).toContain('사무용');
    expect(r.hard).toEqual({});
  });

  it('연결방식 -> 블루투스 -> hard.connection = 무선, soft에 멀티페어링', () => {
    const r = dispatchStepIdToTagSet('연결방식', CONNECTION_OPTIONS.BLUETOOTH);
    expect(r.hard.connection).toBe('무선');
    expect(r.soft).toContain('멀티페어링');
  });

  it('예산 -> { min:0, max:100000 } -> hard.price_max = 100000', () => {
    const r = dispatchStepIdToTagSet('예산', { min: 0, max: 100_000 });
    expect(r.hard.price_max).toBe(100_000);
    expect(r.soft).toEqual([]);
  });

  it('알 수 없는 ID -> { hard: {}, soft: [] }', () => {
    expectEmptyTagSet(dispatchStepIdToTagSet('미지의단계', '값'));
    expectEmptyTagSet(dispatchStepIdToTagSet('', '값'));
  });

  it('dispatchStepIdToTagSet과 dispatchStepToTagSet은 동일 결과를 반환한다', () => {
    const byId = dispatchStepIdToTagSet('키감', KEY_FEEL_OPTIONS.TACTILE);
    const byIdx = dispatchStepToTagSet(3, KEY_FEEL_OPTIONS.TACTILE);
    expect(byId).toEqual(byIdx);
  });
});

// ---------------------------------------------------------------------------
// 10단계 전체 통합 시나리오: 각 단계에서 올바른 TagSet 반환
// ---------------------------------------------------------------------------

describe('10단계 전체 통합 시나리오', () => {
  const FULL_SCENARIO: Array<{
    step: number;
    id: string;
    value: string | { min: number; max: number };
    expectedHardKeys: string[];
    expectedSoftTags: string[];
  }> = [
    {
      step: 0, id: '용도', value: '사무용',
      expectedHardKeys: [], expectedSoftTags: ['사무용'],
    },
    {
      step: 1, id: '휴대성', value: '자주 가지고 다닐래요',
      expectedHardKeys: [], expectedSoftTags: ['휴대성', '가벼움'],
    },
    {
      step: 2, id: '소리', value: '조용해야 해요 (매우 낮음)',
      expectedHardKeys: [], expectedSoftTags: ['조용함', '저소음'],
    },
    {
      step: 3, id: '키감', value: '또각또각 (걸림이 있는 느낌)',
      expectedHardKeys: ['switch_type'], expectedSoftTags: ['기계식', '타건감', '경쾌함'],
    },
    {
      step: 4, id: '키압', value: '가볍게 눌렸으면 좋겠어요 (35~45g)',
      expectedHardKeys: [], expectedSoftTags: ['저소음'],
    },
    {
      step: 5, id: '연결방식', value: '블루투스',
      expectedHardKeys: ['connection', 'wireless_type'], expectedSoftTags: ['무선', '멀티페어링'],
    },
    {
      step: 6, id: '크기', value: '숫자 패드가 없음 (텐키리스)',
      expectedHardKeys: ['layout'], expectedSoftTags: ['텐키리스', '휴대성'],
    },
    {
      step: 7, id: '예산', value: { min: 50_000, max: 200_000 },
      expectedHardKeys: ['price_min', 'price_max'], expectedSoftTags: [],
    },
    {
      step: 8, id: '각인', value: '한국어, 영어가 모두 필요해요',
      expectedHardKeys: ['engraving'], expectedSoftTags: ['한영각인'],
    },
    {
      step: 9, id: '백라이트', value: '화려한 RGB가 좋아요',
      expectedHardKeys: ['backlight'], expectedSoftTags: ['RGB', '백라이트'],
    },
  ];

  FULL_SCENARIO.forEach(({ step, id, value, expectedHardKeys, expectedSoftTags }) => {
    it(`Step ${step} (${id}): 기대 hard 키 및 soft 태그 포함`, () => {
      const r = dispatchStepToTagSet(step, value);

      for (const key of expectedHardKeys) {
        expect(r.hard).toHaveProperty(key);
      }
      for (const tag of expectedSoftTags) {
        expect(r.soft).toContain(tag);
      }
    });
  });

  it('dispatchStepIdToTagSet도 동일한 10단계 결과를 반환한다', () => {
    for (const scenario of FULL_SCENARIO) {
      const byIdx = dispatchStepToTagSet(scenario.step, scenario.value);
      const byId = dispatchStepIdToTagSet(scenario.id, scenario.value);
      expect(byId).toEqual(byIdx);
    }
  });
});

// ---------------------------------------------------------------------------
// 결정론성: 동일 입력 -> 항상 동일 출력
// ---------------------------------------------------------------------------

describe('결정론성 검증', () => {
  it('dispatchStepToTagSet은 동일 입력에 항상 동일 TagSet을 반환한다', () => {
    const r1 = dispatchStepToTagSet(5, CONNECTION_OPTIONS.BLUETOOTH);
    const r2 = dispatchStepToTagSet(5, CONNECTION_OPTIONS.BLUETOOTH);
    const r3 = dispatchStepToTagSet(5, CONNECTION_OPTIONS.BLUETOOTH);
    expect(r1).toEqual(r2);
    expect(r2).toEqual(r3);
  });

  it('dispatchStepIdToTagSet은 동일 입력에 항상 동일 TagSet을 반환한다', () => {
    const r1 = dispatchStepIdToTagSet('키감', KEY_FEEL_OPTIONS.TOPRE);
    const r2 = dispatchStepIdToTagSet('키감', KEY_FEEL_OPTIONS.TOPRE);
    expect(r1).toEqual(r2);
  });

  it('예산 step은 동일 range에 항상 동일 hard 제약을 반환한다', () => {
    const r1 = dispatchStepToTagSet(7, { min: 30_000, max: 150_000 });
    const r2 = dispatchStepToTagSet(7, { min: 30_000, max: 150_000 });
    expect(r1).toEqual(r2);
  });
});

// ---------------------------------------------------------------------------
// LLM 호출 없이 동기 순수 함수
// ---------------------------------------------------------------------------

describe('LLM 호출 없이 동기 순수 함수', () => {
  it('dispatchStepToTagSet은 Promise를 반환하지 않는다', () => {
    const result = dispatchStepToTagSet(0, '사무용');
    expect(result).not.toBeInstanceOf(Promise);
    expect(typeof result).toBe('object');
    expect(Array.isArray(result.soft)).toBe(true);
  });

  it('dispatchStepIdToTagSet은 Promise를 반환하지 않는다', () => {
    const result = dispatchStepIdToTagSet('연결방식', '블루투스');
    expect(result).not.toBeInstanceOf(Promise);
    expect(typeof result.hard).toBe('object');
  });

  it('10단계 전부 동기 반환', () => {
    const steps: Array<[number, string | { min: number; max: number }]> = [
      [0, '사무용'],
      [1, '자주 가지고 다닐래요'],
      [2, '조용해야 해요 (매우 낮음)'],
      [3, '또각또각 (걸림이 있는 느낌)'],
      [4, '가볍게 눌렸으면 좋겠어요 (35~45g)'],
      [5, '블루투스'],
      [6, '숫자 패드가 없음 (텐키리스)'],
      [7, { min: 50_000, max: 200_000 }],
      [8, '한국어, 영어가 모두 필요해요'],
      [9, '화려한 RGB가 좋아요'],
    ];

    for (const [step, value] of steps) {
      const r = dispatchStepToTagSet(step, value);
      expect(r).not.toBeInstanceOf(Promise);
      expect(Array.isArray(r.soft)).toBe(true);
      expect(typeof r.hard).toBe('object');
    }
  });
});
