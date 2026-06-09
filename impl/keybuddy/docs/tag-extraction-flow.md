# 자연어 → 태그 추출 플로우

keybuddy 추천은 **2단계 분리** 구조입니다.

- **LLM은 자연어를 "의도 + 명시 제약"으로 번역만** 합니다.
- 그걸 **태그로 펼치고 검색하는 건 전부 결정론**입니다 (LLM 호출 0회).

이 분리 덕분에 "조용함이 어떤 축이냐" 같은 도메인 판단을 LLM에 맡기지 않고 우리가 통제하며,
검색 결과를 재현 가능하게(같은 입력 → 같은 출력) 만듭니다.

---

## 전체 경로

```
HomeView "분석하기"
  → recommend({mode:'freeform', query})          src/lib/recommend.ts
    → ① extractIntentInput(query)   [LLM 유일]    src/lib/extractRawTags.ts
    → ② expandIntents({intents, explicit})        src/lib/intentProfile.ts
    → ③ searchWithProfile(expanded, catalog)      src/lib/intentSearch.ts
    → buildSummary + toRecommendations → ResultView
```

아래는 실제 입력 **`"게임용 RGB 화려한 텐키리스 키보드"`** 로 추적한 예시입니다.

---

## ① LLM 추출 — 자연어를 "의도 + 명시 제약"으로 (`extractIntentInput`)

여기까지만 LLM(`claude-sonnet-4-6`)을 사용합니다.

프롬프트(`INTENT_SYSTEM_PROMPT`)는 LLM에게 3가지를 **분리**해서 뽑게 합니다 (어휘 목록은 코드에서 자동 주입):

- `intents`: 통제된 의도 어휘 `["사무용","게이밍","휴대용"]` (= `INTENT_VOCABULARY`) 에서만
- `hardConstraints`: 사용자가 콕 집은 구체 제약 (예산/배열/스위치/연결/백라이트 …)
- `softIntentTags`: 사용자가 직접 언급한 속성 선호 (`SOFT_INTENT_VOCAB` 24개 중)

**LLM 원문 응답 예시**

```json
{"intents": ["게이밍"],
 "hardConstraints": {"layout": "텐키리스", "backlight": "RGB 백라이트"},
 "softIntentTags": ["게이밍", "RGB", "텐키리스"]}
```

**정제(`parseIntentInput`)** — LLM 출력을 신뢰하지 않는다는 전제로 3중 방어:

1. `extractJsonObject` — ` ```json ``` ` 코드펜스나 앞뒤 설명이 섞여 와도 첫 `{` ~ 마지막 `}` 만 추출 (빈 태그로 떨어지던 버그 방지)
2. `JSON.parse` 실패 시 빈 결과로 안전 폴백
3. 어휘/스키마 밖 값 폐기
   - `sanitizeIntents` → `isIntentTag`로 `INTENT_VOCABULARY` 밖 제거
   - `sanitizeHardConstraints` → `HARD_CONSTRAINT_KEYS` + 열거형/숫자 타입 검증
   - `sanitizeSoftIntentTags` → `SOFT_INTENT_VOCAB` 밖 제거

**결과**: `{ intents:['게이밍'], hardConstraints:{layout:'텐키리스', backlight:'RGB 백라이트'}, softIntentTags:['게이밍','RGB','텐키리스'] }`

---

## ② 결정론 확장 — 의도를 차원별 프로파일로 펼침 (`expandIntents`)

여기부터 LLM 없음. `recommend`가 `explicit = {hardConstraints, softIntentTags}` 로 묶어 의도와 함께 넘깁니다.

### a. 사용자가 명시한 차원 파악 (`dimensionsOfExplicit`)

명시 하드 키와 소프트 태그를 속성 차원으로 환산해 모읍니다.

- `layout:텐키리스` → 차원 `배열`
- `backlight:RGB 백라이트` → 차원 `백라이트`
- soft `RGB` → `백라이트`, `텐키리스` → `배열`
- → **명시 차원 = {배열, 백라이트}** (`게이밍` 소프트는 의도라 차원 매핑 없음)

### b. 의도 프로파일 펼치기 (정적 문서 `INTENT_PROFILE_TABLE`)

`게이밍` 프로파일:

```
게이밍 → 스위치:   필수, 기계식
       → 백라이트: 선호, RGB
       → 소음:     상관없음
```

각 요구를 강도(`Strength` = `필수` / `선호` / `상관없음`)대로 처리하되 **명시 우선**:

- `스위치=필수(기계식)` → 스위치는 명시 안 됨 → **requiredTags(하드 승격)에 추가** ✅
- `백라이트=선호(RGB)` → 백라이트는 **이미 명시됨(RGB 하드)** → **건너뜀** (명시 우선)
- `소음=상관없음` → 아무것도 안 함

### c. 정리

requiredTags에 들어간 태그는 soft에서 제거, 중복 제거.

**결과 `ExpandedTags`**

```
hardConstraints: {layout:'텐키리스', backlight:'RGB 백라이트'}   ← 명시 그대로
requiredTags:    ['기계식']                                      ← 의도가 하드로 승격
softIntentTags:  ['게이밍','RGB','텐키리스']                      ← 선호(점수)
```

> 다중 의도면 프로파일을 **합집합**, 어휘 밖 의도는 무시합니다.

---

## ③ 결정론 검색 (`searchWithProfile`)

세 종류 제약을 적용합니다.

- **하드 필터(위반 제외)** = 명시 하드(`layout`, `backlight`) + **필수 승격 태그(`기계식`)**
  - 필수 태그는 `SOFT_TAG_RULE_TABLE`의 술어로 검사 (`기계식` → `switch_type === '기계식'`). `getMatchedSoftTags` 재사용
- **소프트 점수(랭킹)** = `softIntentTags` 겹칠수록 상위 (`scoreBySoftTags` → `deriveRankOrder`)
- **무결과 완화** = 결과 0이면 `[의도 파생 필수 태그 … → 명시 하드 키 …]` 순서로 1개씩 완화.
  의도 파생을 명시보다 **먼저** 버립니다 (명시 우선 철학).

**결과**: 기계식 ∧ 텐키리스 ∧ RGB백라이트 = 80건(600개 카탈로그 중), 상위는 점수 3 `[게이밍,RGB,텐키리스]`.
멤브레인/펜타그래프 게이밍 키보드는 **아예 배제**됩니다 (`기계식` 필수).

---

## LLM 경계 요약

| 단계 | LLM | 결정론 |
|---|:---:|:---:|
| 자연어 → 의도+명시 (`extractIntentInput`) | ✅ 유일 호출 | |
| 의도 → 프로파일 확장 (`expandIntents`) | | ✅ |
| 하드 필터·소프트 점수·완화 (`searchWithProfile`) | | ✅ (호출 0회 카운트 검증됨) |
| 매칭 근거·요약 생성 | | ✅ |

---

## 단계선택(가이드) 경로는 LLM 0회

`recommend`에서 freeform 대신 guided면: `selectionOptionConverter`(규칙 변환)로 명시 제약을,
`guidedIntents`(용도→의도, 휴대성→휴대용)로 의도를 뽑아 **②③ 동일 경로**를 탑니다. 완전 오프라인.

---

## 직접 보는 법 (개발 모드)

`npm run dev` → 브라우저 콘솔에서 `[keybuddy] 의도 하네싱 결과` 그룹:

- `의도(intents)` / `명시 제약` / `확장 하드 제약` / `필수 승격 태그(하드)` / `선호 태그(소프트)` / 상위 5개 테이블

LLM 원본은 `[keybuddy] 의도/제약 추출 원문` 으로 함께 찍힙니다.
이 로그는 `import.meta.env.DEV` 가드라 **프로덕션 빌드에는 포함되지 않습니다**.

---

## 설계상 주의 — "조용한 사무용" (방향 인식 강화)

명시 소프트가 의도 필수와 **같은 차원**일 때, 무조건 양보하지 않고 **방향(극성)으로 판단**합니다
(`intentProfile.ts`의 `TAG_POLARITY`, 현재 소음 축만 정의).

- `"조용한 사무실"` → 명시 `조용함`(정숙) + 사무용 `저소음=필수`(정숙) = **같은 방향**
  → 양보가 아니라 **저소음을 하드로 강화** → 기계식(시끄러움)은 결과에서 **완전히 배제**. ✅
- `"경쾌한 사무용"` → 명시 `경쾌함`(소란)이 `저소음`(정숙)과 **충돌**
  → 의도 필수를 양보, 명시 소프트 점수만 반영(사용자 명시 우선).

극성이 정의되지 않은 차원의 명시 소프트(예: 백라이트의 `RGB`)는 기존대로 의도 선호를 **덮어씁니다**.
또한 추출 프롬프트에서 소음 축 상반 태그(조용함/저소음 ↔ 고소음/경쾌함)의 동시 추출을 금지해
LLM이 정숙 요구를 `경쾌함`으로 잘못 섞는 것을 1차로 차단합니다.

---

## 관련 파일

| 파일 | 역할 |
|---|---|
| `src/lib/extractRawTags.ts` | ① LLM 추출 (`extractIntentInput`, `parseIntentInput`, 정제) |
| `src/lib/intentProfile.ts` | ② 의도 어휘·정적 프로파일 문서·`expandIntents` |
| `src/lib/intentSearch.ts` | ③ `searchWithProfile` (필수 하드 승격 + 통합 완화) |
| `src/lib/softTagRules.ts` | 태그 → 속성 술어 정적 규칙표 (필수/선호 공통 사용) |
| `src/lib/softScorer.ts` | 소프트 점수·랭킹·술어 평가 |
| `src/lib/searchEngine.ts` | 하드 필터·완화 순서 등 코어(미수정, 조합만) |
| `src/lib/recommend.ts` | 전체 오케스트레이션 + 개발 콘솔 로그 |

검증/비교: [`../intent-harness-before-after.md`](../intent-harness-before-after.md) (전/후 정성 리포트)
