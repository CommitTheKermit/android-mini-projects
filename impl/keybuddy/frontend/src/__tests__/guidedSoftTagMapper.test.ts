/**
 * 소프트 의도 태그 매핑 함수 단위 테스트 (Sub-AC 2-1-B)
 *
 * 검증 대상:
 * - mapPurposeToSoftTags: 사용 목적 -> 소프트 태그
 * - mapPortabilityToSoftTags: 휴대성 -> 소프트 태그
 * - mapSoundToSoftTags: 소리 -> 소프트 태그
 * - mapKeyForceToSoftTags: 키압 -> 소프트 태그
 * - mapKeyFeelToSoftTags: 키감 -> 소프트 태그
 * - mapLayoutToSoftTags: 크기 -> 소프트 태그
 * - mapConnectionToSoftTags: 연결방식 -> 소프트 태그
 * - mapBacklightToSoftTags: 백라이트 -> 소프트 태그
 * - mapEngravingToSoftTags: 각인 -> 소프트 태그
 * - guidedAnswersToSoftTags: 전체 통합 변환
 *
 * 모든 테스트는 LLM 호출 없이 동작한다 (순수 함수).
 */

import { describe, it, expect } from 'vitest';
import {
  mapPurposeToSoftTags,
  mapPortabilityToSoftTags,
  mapSoundToSoftTags,
  mapKeyForceToSoftTags,
  mapKeyFeelToSoftTags,
  mapLayoutToSoftTags,
  mapConnectionToSoftTags,
  mapBacklightToSoftTags,
  mapEngravingToSoftTags,
  guidedAnswersToSoftTags,
  PURPOSE_OPTIONS,
  PORTABILITY_OPTIONS,
  SOUND_OPTIONS,
  KEY_FORCE_OPTIONS,
  KEY_FEEL_OPTIONS,
  LAYOUT_OPTIONS,
  CONNECTION_OPTIONS,
  BACKLIGHT_OPTIONS,
  ENGRAVING_OPTIONS,
} from '../lib/guidedInputMapper';
import { SOFT_INTENT_VOCAB } from '../lib/tagSchema';

// ---------------------------------------------------------------------------
// 헬퍼: 반환된 태그가 모두 SOFT_INTENT_VOCAB에 속하는지 확인
// ---------------------------------------------------------------------------

function assertAllInVocab(tags: string[], desc: string) {
  const vocab = new Set(SOFT_INTENT_VOCAB);
  tags.forEach((tag) => {
    if (!vocab.has(tag as (typeof SOFT_INTENT_VOCAB)[number])) {
      throw new Error(`[${desc}] 태그 '${tag}'가 SOFT_INTENT_VOCAB에 없음`);
    }
  });
}

// ---------------------------------------------------------------------------
// mapPurposeToSoftTags - 사용 목적 단계
// ---------------------------------------------------------------------------

describe('mapPurposeToSoftTags', () => {
  it('사무용 -> [사무용]', () => {
    const result = mapPurposeToSoftTags(PURPOSE_OPTIONS.OFFICE);
    expect(result).toEqual(['사무용']);
  });

  it('게임용 -> [게이밍]', () => {
    const result = mapPurposeToSoftTags(PURPOSE_OPTIONS.GAMING);
    expect(result).toEqual(['게이밍']);
  });

  it('상관없음 -> []', () => {
    expect(mapPurposeToSoftTags(PURPOSE_OPTIONS.ANY)).toEqual([]);
  });

  it('알 수 없는 값 -> []', () => {
    expect(mapPurposeToSoftTags('코딩용')).toEqual([]);
    expect(mapPurposeToSoftTags('')).toEqual([]);
  });

  it('반환 태그가 모두 SOFT_INTENT_VOCAB에 속한다', () => {
    assertAllInVocab(mapPurposeToSoftTags(PURPOSE_OPTIONS.OFFICE), '사무용');
    assertAllInVocab(mapPurposeToSoftTags(PURPOSE_OPTIONS.GAMING), '게임용');
  });
});

// ---------------------------------------------------------------------------
// mapPortabilityToSoftTags - 휴대성 단계
// ---------------------------------------------------------------------------

describe('mapPortabilityToSoftTags', () => {
  it('자주 가지고 다닐래요 -> [휴대성, 가벼움]', () => {
    const result = mapPortabilityToSoftTags(PORTABILITY_OPTIONS.PORTABLE);
    expect(result).toContain('휴대성');
    expect(result).toContain('가벼움');
    expect(result).toHaveLength(2);
  });

  it('책상에 놓고 쓸 거예요 -> []', () => {
    expect(mapPortabilityToSoftTags(PORTABILITY_OPTIONS.DESK)).toEqual([]);
  });

  it('상관없음 -> []', () => {
    expect(mapPortabilityToSoftTags(PORTABILITY_OPTIONS.ANY)).toEqual([]);
  });

  it('알 수 없는 값 -> []', () => {
    expect(mapPortabilityToSoftTags('자주 이동')).toEqual([]);
    expect(mapPortabilityToSoftTags('')).toEqual([]);
  });

  it('반환 태그가 모두 SOFT_INTENT_VOCAB에 속한다', () => {
    assertAllInVocab(mapPortabilityToSoftTags(PORTABILITY_OPTIONS.PORTABLE), '휴대성');
  });
});

// ---------------------------------------------------------------------------
// mapSoundToSoftTags - 소리 단계
// ---------------------------------------------------------------------------

describe('mapSoundToSoftTags', () => {
  it('조용해야 해요 (매우 낮음) -> [조용함, 저소음]', () => {
    const result = mapSoundToSoftTags(SOUND_OPTIONS.VERY_QUIET);
    expect(result).toContain('조용함');
    expect(result).toContain('저소음');
    expect(result).toHaveLength(2);
  });

  it('조금 소리가 났으면 해요 (낮음) -> [저소음]', () => {
    const result = mapSoundToSoftTags(SOUND_OPTIONS.QUIET);
    expect(result).toEqual(['저소음']);
  });

  it('적당한 소리 (보통) -> []', () => {
    expect(mapSoundToSoftTags(SOUND_OPTIONS.NORMAL)).toEqual([]);
  });

  it('경쾌한 소리 (조금 큼) -> [경쾌함]', () => {
    const result = mapSoundToSoftTags(SOUND_OPTIONS.CRISPY);
    expect(result).toEqual(['경쾌함']);
  });

  it('타건감 위주 (시끄러워도 됨) -> [타건감, 고소음, 경쾌함]', () => {
    const result = mapSoundToSoftTags(SOUND_OPTIONS.LOUD);
    expect(result).toContain('타건감');
    expect(result).toContain('고소음');
    expect(result).toContain('경쾌함');
    expect(result).toHaveLength(3);
  });

  it('알 수 없는 값 -> []', () => {
    expect(mapSoundToSoftTags('엄청 큰 소리')).toEqual([]);
    expect(mapSoundToSoftTags('')).toEqual([]);
  });

  it('소리 단계의 모든 선택지가 반환하는 태그는 SOFT_INTENT_VOCAB에 속한다', () => {
    Object.values(SOUND_OPTIONS).forEach((opt) => {
      assertAllInVocab(mapSoundToSoftTags(opt), `소리:${opt}`);
    });
  });

  it('매우 조용함과 낮음은 저소음을 공유하지만 조용함은 매우 조용함에만 있다', () => {
    const veryQuiet = mapSoundToSoftTags(SOUND_OPTIONS.VERY_QUIET);
    const quiet = mapSoundToSoftTags(SOUND_OPTIONS.QUIET);
    expect(veryQuiet).toContain('저소음');
    expect(quiet).toContain('저소음');
    expect(veryQuiet).toContain('조용함');
    expect(quiet).not.toContain('조용함');
  });
});

// ---------------------------------------------------------------------------
// mapKeyForceToSoftTags - 키압 단계
// ---------------------------------------------------------------------------

describe('mapKeyForceToSoftTags', () => {
  it('가볍게 눌렸으면 좋겠어요 (35~45g) -> [저소음]', () => {
    const result = mapKeyForceToSoftTags(KEY_FORCE_OPTIONS.LIGHT);
    expect(result).toContain('저소음');
  });

  it('보편적인게 좋아요 (45~55g) -> []', () => {
    expect(mapKeyForceToSoftTags(KEY_FORCE_OPTIONS.MEDIUM)).toEqual([]);
  });

  it('묵직한게 좋아요 (60g 이상) -> [타건감]', () => {
    const result = mapKeyForceToSoftTags(KEY_FORCE_OPTIONS.HEAVY);
    expect(result).toContain('타건감');
  });

  it('잘 모르겠어요 -> []', () => {
    expect(mapKeyForceToSoftTags(KEY_FORCE_OPTIONS.UNKNOWN)).toEqual([]);
  });

  it('알 수 없는 값 -> []', () => {
    expect(mapKeyForceToSoftTags('50g')).toEqual([]);
    expect(mapKeyForceToSoftTags('')).toEqual([]);
  });

  it('키압 단계의 모든 선택지가 반환하는 태그는 SOFT_INTENT_VOCAB에 속한다', () => {
    Object.values(KEY_FORCE_OPTIONS).forEach((opt) => {
      assertAllInVocab(mapKeyForceToSoftTags(opt), `키압:${opt}`);
    });
  });
});

// ---------------------------------------------------------------------------
// mapKeyFeelToSoftTags - 키감 단계 (소프트 태그)
// ---------------------------------------------------------------------------

describe('mapKeyFeelToSoftTags', () => {
  it('또각또각 (택타일/클릭) -> [기계식, 타건감, 경쾌함]', () => {
    const result = mapKeyFeelToSoftTags(KEY_FEEL_OPTIONS.TACTILE);
    expect(result).toContain('기계식');
    expect(result).toContain('타건감');
    expect(result).toContain('경쾌함');
    expect(result).toHaveLength(3);
  });

  it('서걱서걱 (리니어) -> [기계식, 타건감]', () => {
    const result = mapKeyFeelToSoftTags(KEY_FEEL_OPTIONS.LINEAR);
    expect(result).toContain('기계식');
    expect(result).toContain('타건감');
    expect(result).toHaveLength(2);
  });

  it('보글보글 (무접점) -> [무접점, 타건감, 조용함]', () => {
    const result = mapKeyFeelToSoftTags(KEY_FEEL_OPTIONS.TOPRE);
    expect(result).toContain('무접점');
    expect(result).toContain('타건감');
    expect(result).toContain('조용함');
    expect(result).toHaveLength(3);
  });

  it('잘 모르겠어요 -> []', () => {
    expect(mapKeyFeelToSoftTags(KEY_FEEL_OPTIONS.UNKNOWN)).toEqual([]);
  });

  it('알 수 없는 값 -> []', () => {
    expect(mapKeyFeelToSoftTags('스프링 특수축')).toEqual([]);
    expect(mapKeyFeelToSoftTags('')).toEqual([]);
  });

  it('또각또각과 서걱서걱 모두 기계식과 타건감을 포함한다', () => {
    const tactile = mapKeyFeelToSoftTags(KEY_FEEL_OPTIONS.TACTILE);
    const linear = mapKeyFeelToSoftTags(KEY_FEEL_OPTIONS.LINEAR);
    expect(tactile).toContain('기계식');
    expect(tactile).toContain('타건감');
    expect(linear).toContain('기계식');
    expect(linear).toContain('타건감');
  });

  it('키감 단계의 모든 선택지가 반환하는 태그는 SOFT_INTENT_VOCAB에 속한다', () => {
    Object.values(KEY_FEEL_OPTIONS).forEach((opt) => {
      assertAllInVocab(mapKeyFeelToSoftTags(opt), `키감:${opt}`);
    });
  });
});

// ---------------------------------------------------------------------------
// mapLayoutToSoftTags - 크기 단계 (소프트 태그)
// ---------------------------------------------------------------------------

describe('mapLayoutToSoftTags', () => {
  it('풀배열 -> [풀배열]', () => {
    const result = mapLayoutToSoftTags(LAYOUT_OPTIONS.FULL);
    expect(result).toEqual(['풀배열']);
  });

  it('1800배열 -> [풀배열] (풀배열 콤팩트 변형)', () => {
    const result = mapLayoutToSoftTags(LAYOUT_OPTIONS.COMPACT_FULL);
    expect(result).toContain('풀배열');
  });

  it('텐키리스 -> [텐키리스, 휴대성]', () => {
    const result = mapLayoutToSoftTags(LAYOUT_OPTIONS.TKL);
    expect(result).toContain('텐키리스');
    expect(result).toContain('휴대성');
  });

  it('75%/65% -> [텐키리스, 휴대성]', () => {
    const result = mapLayoutToSoftTags(LAYOUT_OPTIONS.SEVENTY_FIVE);
    expect(result).toContain('텐키리스');
    expect(result).toContain('휴대성');
  });

  it('미니(60%) -> [미니, 휴대성]', () => {
    const result = mapLayoutToSoftTags(LAYOUT_OPTIONS.MINI);
    expect(result).toContain('미니');
    expect(result).toContain('휴대성');
  });

  it('알 수 없는 값 -> []', () => {
    expect(mapLayoutToSoftTags('96키')).toEqual([]);
    expect(mapLayoutToSoftTags('')).toEqual([]);
  });

  it('크기 단계의 모든 선택지가 반환하는 태그는 SOFT_INTENT_VOCAB에 속한다', () => {
    Object.values(LAYOUT_OPTIONS).forEach((opt) => {
      assertAllInVocab(mapLayoutToSoftTags(opt), `크기:${opt}`);
    });
  });
});

// ---------------------------------------------------------------------------
// mapConnectionToSoftTags - 연결방식 단계 (소프트 태그)
// ---------------------------------------------------------------------------

describe('mapConnectionToSoftTags', () => {
  it('유선 -> []', () => {
    expect(mapConnectionToSoftTags(CONNECTION_OPTIONS.WIRED)).toEqual([]);
  });

  it('무선 USB 동글 -> [무선]', () => {
    const result = mapConnectionToSoftTags(CONNECTION_OPTIONS.DONGLE);
    expect(result).toContain('무선');
    expect(result).not.toContain('멀티페어링');
  });

  it('블루투스 -> [무선, 멀티페어링]', () => {
    const result = mapConnectionToSoftTags(CONNECTION_OPTIONS.BLUETOOTH);
    expect(result).toContain('무선');
    expect(result).toContain('멀티페어링');
  });

  it('유/무선 모두 -> [무선]', () => {
    const result = mapConnectionToSoftTags(CONNECTION_OPTIONS.BOTH);
    expect(result).toContain('무선');
  });

  it('상관없음 -> []', () => {
    expect(mapConnectionToSoftTags(CONNECTION_OPTIONS.ANY)).toEqual([]);
  });

  it('알 수 없는 값 -> []', () => {
    expect(mapConnectionToSoftTags('위성통신')).toEqual([]);
    expect(mapConnectionToSoftTags('')).toEqual([]);
  });

  it('블루투스만 멀티페어링 태그를 생성한다', () => {
    expect(mapConnectionToSoftTags(CONNECTION_OPTIONS.BLUETOOTH)).toContain('멀티페어링');
    expect(mapConnectionToSoftTags(CONNECTION_OPTIONS.DONGLE)).not.toContain('멀티페어링');
    expect(mapConnectionToSoftTags(CONNECTION_OPTIONS.BOTH)).not.toContain('멀티페어링');
  });

  it('연결방식 단계의 모든 선택지가 반환하는 태그는 SOFT_INTENT_VOCAB에 속한다', () => {
    Object.values(CONNECTION_OPTIONS).forEach((opt) => {
      assertAllInVocab(mapConnectionToSoftTags(opt), `연결방식:${opt}`);
    });
  });
});

// ---------------------------------------------------------------------------
// mapBacklightToSoftTags - 백라이트 단계 (소프트 태그)
// ---------------------------------------------------------------------------

describe('mapBacklightToSoftTags', () => {
  it('화려한 RGB -> [RGB, 백라이트]', () => {
    const result = mapBacklightToSoftTags(BACKLIGHT_OPTIONS.RGB);
    expect(result).toContain('RGB');
    expect(result).toContain('백라이트');
    expect(result).toHaveLength(2);
  });

  it('은은한 단색 조명 -> [백라이트]', () => {
    const result = mapBacklightToSoftTags(BACKLIGHT_OPTIONS.MONO);
    expect(result).toEqual(['백라이트']);
    expect(result).not.toContain('RGB');
  });

  it('없어도 돼요 (배터리 절약) -> [백라이트없음]', () => {
    const result = mapBacklightToSoftTags(BACKLIGHT_OPTIONS.NONE);
    expect(result).toEqual(['백라이트없음']);
  });

  it('알 수 없는 값 -> []', () => {
    expect(mapBacklightToSoftTags('레이저')).toEqual([]);
    expect(mapBacklightToSoftTags('')).toEqual([]);
  });

  it('RGB와 단색은 모두 백라이트 태그를 포함한다', () => {
    expect(mapBacklightToSoftTags(BACKLIGHT_OPTIONS.RGB)).toContain('백라이트');
    expect(mapBacklightToSoftTags(BACKLIGHT_OPTIONS.MONO)).toContain('백라이트');
    expect(mapBacklightToSoftTags(BACKLIGHT_OPTIONS.NONE)).not.toContain('백라이트');
  });

  it('백라이트 단계의 모든 선택지가 반환하는 태그는 SOFT_INTENT_VOCAB에 속한다', () => {
    Object.values(BACKLIGHT_OPTIONS).forEach((opt) => {
      assertAllInVocab(mapBacklightToSoftTags(opt), `백라이트:${opt}`);
    });
  });
});

// ---------------------------------------------------------------------------
// mapEngravingToSoftTags - 각인 단계 (소프트 태그)
// ---------------------------------------------------------------------------

describe('mapEngravingToSoftTags', () => {
  it('한국어+영어 -> [한영각인]', () => {
    const result = mapEngravingToSoftTags(ENGRAVING_OPTIONS.BOTH);
    expect(result).toEqual(['한영각인']);
  });

  it('영어만 -> [영문각인]', () => {
    const result = mapEngravingToSoftTags(ENGRAVING_OPTIONS.ENGLISH_ONLY);
    expect(result).toEqual(['영문각인']);
  });

  it('한국어만 -> [] (한국어 단독 각인은 소프트 태그 없음)', () => {
    expect(mapEngravingToSoftTags(ENGRAVING_OPTIONS.KOREAN_ONLY)).toEqual([]);
  });

  it('상관없음 -> []', () => {
    expect(mapEngravingToSoftTags(ENGRAVING_OPTIONS.ANY)).toEqual([]);
  });

  it('알 수 없는 값 -> []', () => {
    expect(mapEngravingToSoftTags('무각인')).toEqual([]);
    expect(mapEngravingToSoftTags('')).toEqual([]);
  });

  it('각인 단계의 모든 선택지가 반환하는 태그는 SOFT_INTENT_VOCAB에 속한다', () => {
    Object.values(ENGRAVING_OPTIONS).forEach((opt) => {
      assertAllInVocab(mapEngravingToSoftTags(opt), `각인:${opt}`);
    });
  });
});

// ---------------------------------------------------------------------------
// guidedAnswersToSoftTags - 통합 변환
// ---------------------------------------------------------------------------

describe('guidedAnswersToSoftTags', () => {
  it('사무용 + 조용함 -> 사무용, 조용함, 저소음 포함', () => {
    const answers = {
      용도: '사무용',
      소리: '조용해야 해요 (매우 낮음)',
    };
    const result = guidedAnswersToSoftTags(answers);
    expect(result).toContain('사무용');
    expect(result).toContain('조용함');
    expect(result).toContain('저소음');
  });

  it('게임용 + RGB -> 게이밍, RGB, 백라이트 포함', () => {
    const answers = {
      용도: '게임용',
      백라이트: '화려한 RGB가 좋아요',
    };
    const result = guidedAnswersToSoftTags(answers);
    expect(result).toContain('게이밍');
    expect(result).toContain('RGB');
    expect(result).toContain('백라이트');
  });

  it('블루투스 + 미니 + 자주 이동 -> 무선, 멀티페어링, 미니, 휴대성, 가벼움 포함', () => {
    const answers = {
      연결방식: '블루투스',
      크기: 'F1~F12키도 없는 미니 (60%)',
      휴대성: '자주 가지고 다닐래요',
    };
    const result = guidedAnswersToSoftTags(answers);
    expect(result).toContain('무선');
    expect(result).toContain('멀티페어링');
    expect(result).toContain('미니');
    expect(result).toContain('휴대성');
    expect(result).toContain('가벼움');
  });

  it('또각또각 + 경쾌한 소리 -> 기계식, 타건감, 경쾌함 포함 (중복 제거)', () => {
    const answers = {
      키감: '또각또각 (걸림이 있는 느낌)',
      소리: '경쾌한 소리 (조금 큼)',
    };
    const result = guidedAnswersToSoftTags(answers);
    expect(result).toContain('기계식');
    expect(result).toContain('타건감');
    expect(result).toContain('경쾌함');
    // 경쾌함은 두 단계에서 공통으로 나오지만 중복 없이 1회만 존재해야 한다
    const count = result.filter((t) => t === '경쾌함').length;
    expect(count).toBe(1);
  });

  it('보글보글 + 매우 조용함 -> 무접점, 타건감, 조용함, 저소음 포함 (조용함 중복 없음)', () => {
    const answers = {
      키감: '보글보글 (독특한 무접점 느낌)',
      소리: '조용해야 해요 (매우 낮음)',
    };
    const result = guidedAnswersToSoftTags(answers);
    expect(result).toContain('무접점');
    expect(result).toContain('조용함');
    expect(result).toContain('저소음');
    // 조용함은 중복 없이 1회
    const count = result.filter((t) => t === '조용함').length;
    expect(count).toBe(1);
  });

  it('빈 answers -> []', () => {
    const result = guidedAnswersToSoftTags({});
    expect(result).toEqual([]);
  });

  it('상관없음/잘 모르겠어요만 있으면 [] 반환', () => {
    const answers = {
      용도: '상관없음',
      휴대성: '상관없음',
      소리: '적당한 소리 (보통)',
      키감: '잘 모르겠어요',
      키압: '잘 모르겠어요',
      연결방식: '상관없음',
      각인: '상관없음',
    };
    const result = guidedAnswersToSoftTags(answers);
    expect(result).toEqual([]);
  });

  it('결과 배열에 중복 태그가 없다', () => {
    const answers = {
      휴대성: '자주 가지고 다닐래요',
      크기: '숫자 패드가 없음 (텐키리스)',
      소리: '조용해야 해요 (매우 낮음)',
      키감: '보글보글 (독특한 무접점 느낌)',
    };
    const result = guidedAnswersToSoftTags(answers);
    const unique = new Set(result);
    expect(result).toHaveLength(unique.size);
  });

  it('반환된 모든 태그가 SOFT_INTENT_VOCAB에 속한다', () => {
    const answers = {
      용도: '게임용',
      휴대성: '자주 가지고 다닐래요',
      소리: '타건감 위주 (시끄러워도 됨)',
      키감: '또각또각 (걸림이 있는 느낌)',
      키압: '묵직한게 좋아요 (60g 이상)',
      크기: 'F1~F12키도 없는 미니 (60%)',
      연결방식: '블루투스',
      백라이트: '화려한 RGB가 좋아요',
      각인: '영어만 적혀있길 바라요',
    };
    const result = guidedAnswersToSoftTags(answers);
    assertAllInVocab(result, '전체 answers 통합');
    expect(result.length).toBeGreaterThan(0);
  });

  it('하드 제약과 별개로 소프트 태그가 생성된다 (키감)', () => {
    // 키감: 또각또각은 하드 제약(switch_type: 기계식)도 생성하지만
    // 소프트 태그에서도 기계식, 타건감, 경쾌함을 생성해야 한다
    const answers = { 키감: '또각또각 (걸림이 있는 느낌)' };
    const softTags = guidedAnswersToSoftTags(answers);
    expect(softTags).toContain('기계식');
    expect(softTags).toContain('타건감');
    expect(softTags).toContain('경쾌함');
  });

  it('1800배열은 풀배열 소프트 태그를 생성한다 (하드 제약이 없는 크기)', () => {
    const answers = { 크기: '숫자 패드가 있지만 콤팩트함 (1800배열)' };
    const result = guidedAnswersToSoftTags(answers);
    expect(result).toContain('풀배열');
  });

  it('75%/65%는 텐키리스 소프트 태그를 생성한다 (하드 제약이 없는 크기)', () => {
    const answers = { 크기: '숫자 패드도, 일부 특수키도 없음 (75%/65%)' };
    const result = guidedAnswersToSoftTags(answers);
    expect(result).toContain('텐키리스');
  });
});

// ---------------------------------------------------------------------------
// 결정론성: 동일 입력 -> 동일 출력
// ---------------------------------------------------------------------------

describe('소프트 태그 매핑 결정론성', () => {
  it('동일 answers에 대해 항상 동일한 SoftIntentTag[]를 반환한다', () => {
    const answers = {
      용도: '사무용',
      소리: '조용해야 해요 (매우 낮음)',
      키감: '보글보글 (독특한 무접점 느낌)',
      연결방식: '블루투스',
    };
    const r1 = guidedAnswersToSoftTags(answers);
    const r2 = guidedAnswersToSoftTags(answers);
    const r3 = guidedAnswersToSoftTags(answers);
    expect(r1).toEqual(r2);
    expect(r2).toEqual(r3);
  });

  it('각 매핑 함수는 순수 함수 - 외부 상태에 의존하지 않는다', () => {
    const a1 = mapSoundToSoftTags(SOUND_OPTIONS.VERY_QUIET);
    const a2 = mapSoundToSoftTags(SOUND_OPTIONS.VERY_QUIET);
    expect(a1).toEqual(a2);

    const b1 = mapKeyFeelToSoftTags(KEY_FEEL_OPTIONS.TACTILE);
    const b2 = mapKeyFeelToSoftTags(KEY_FEEL_OPTIONS.TACTILE);
    expect(b1).toEqual(b2);
  });
});

// ---------------------------------------------------------------------------
// 소프트 태그 vs 하드 제약 독립성: LLM 호출 없이 동작
// ---------------------------------------------------------------------------

describe('LLM 호출 없이 동작 (결정론 검증)', () => {
  it('mapPurposeToSoftTags는 동기 순수 함수다 (Promise 반환 없음)', () => {
    const result = mapPurposeToSoftTags('사무용');
    expect(result).not.toBeInstanceOf(Promise);
    expect(Array.isArray(result)).toBe(true);
  });

  it('mapSoundToSoftTags는 동기 순수 함수다', () => {
    const result = mapSoundToSoftTags(SOUND_OPTIONS.LOUD);
    expect(result).not.toBeInstanceOf(Promise);
    expect(Array.isArray(result)).toBe(true);
  });

  it('guidedAnswersToSoftTags는 동기 순수 함수다', () => {
    const result = guidedAnswersToSoftTags({ 용도: '사무용' });
    expect(result).not.toBeInstanceOf(Promise);
    expect(Array.isArray(result)).toBe(true);
  });
});
