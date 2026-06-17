# AGENTS.md

이 파일은 이 저장소에서 작업하는 모든 AI 코딩 에이전트(Claude Code, Codex, Cursor 등)와 사람 메인테이너의 단일 진실 공급원(SSOT)이다. 특정 도구에 종속되지 않도록 작성한다. `CLAUDE.md`는 이 파일을 가리키는 심볼릭 링크이므로 둘 중 무엇을 편집해도 같은 내용이 갱신된다.

> **주의:** `CLAUDE.md`는 `AGENTS.md`를 가리키는 심볼릭 링크다. 별도 사본이 아니므로 한쪽만 따로 편집하지 말 것. 새 에이전트 지원을 추가할 때도 사본을 만들지 말고 링크만 건다(예: `ln -s AGENTS.md GEMINI.md`).
>
> **OS별 동작 차이:**
> - **macOS/Linux**: Git이 심볼릭 링크를 그대로 체크아웃한다. 추가 설정 없이 동작하므로 별도 조치가 필요 없다. (현재 팀 기본 환경)
> - **Windows**: Git이 심볼릭 링크를 만들려면 ① 개발자 모드 활성화 또는 관리자 권한과 ② `git config core.symlinks true`가 모두 필요하다. 둘 중 하나라도 없으면 링크가 내용 대신 대상 경로(`AGENTS.md`)만 담긴 한 줄짜리 일반 텍스트 파일로 풀려, 그 파일을 여는 에이전트가 지침 전체를 읽지 못한다. 이 경우 위 설정을 켠 뒤 재클론하거나 `git checkout -- CLAUDE.md`로 다시 받는다.

## 저장소 개요

`android-mini-projects`라는 이름이지만 현재 유일한 활성 프로젝트는 **keybuddy**(키보드 추천 웹 서비스)이며 Android 코드는 없다. 자연어/단계별 질문으로 사용자에게 맞는 키보드를 추천한다.

- `impl/keybuddy/` - 실제 제품 (프론트 + Supabase Edge Function)
- `impl/crawl.py` - 다나와 목록 크롤러 (데이터 소스 생성)
- `impl/output/` - 크롤러 산출물 (`keyboards.json` 등, 생성물)
- `report/`, `README.md` - 기획/주차별 리포트 (제품 가설·문제정의)
- `impl/keybuddy/*.yaml`, `*.md` - 의도 하네스 Seed 명세 및 before/after 분석

루트 `README.md`는 제품 기획서, `impl/keybuddy/README.md`는 실행·배포 운영 매뉴얼이다.

## 주요 명령어

모든 프론트 명령은 `impl/keybuddy/frontend/`에서 실행한다. 루트에서 실행하면 `Missing script` 오류가 난다.

```bash
cd impl/keybuddy/frontend
npm install
npm run dev          # Vite 개발 서버 (localhost:5173)
npm test             # vitest run (전체)
npm test -- src/__tests__/intentSearch.test.ts   # 단일 파일
npx vitest run -t "완화"                          # 이름 패턴으로 단일 테스트
npm run typecheck            # tsc --noEmit (프론트)
npm run typecheck:function   # Edge Function 타입체크
npm run build        # sync:function-version + typecheck + vite build
```

Edge Function (Deno, `impl/keybuddy/`에서):

```bash
supabase functions serve recommend --env-file supabase/functions/.env.local   # 로컬 실행
cd frontend && SUPABASE_PROJECT_REF=<ref> npm run deploy:function              # 배포
```

데이터 갱신 (크롤러 재실행 후 양쪽 카탈로그 동기화):

```bash
cd impl && python3 crawl.py
cd keybuddy/frontend && npm run sync:data   # output/keyboards.json -> 프론트 + Edge Function 사본
```

## 아키텍처: 추천 경로 (현행 + 레거시)

> **2026-06 갱신**: 결정론 의도 하네스가 UI에 배선됐다. 현행 프로덕션은 "Edge Function 태그추출(OpenAI) + 클라이언트 결정론 검색" 하이브리드이고, 과거의 "Edge Function 전체 추천 생성"과 "클라이언트 claude 태그추출"은 코드만 남은 레거시다. 혼동하지 말 것.

**현행 프로덕션 경로 (UI 연결)**: `App.tsx` → `lib/recommend.ts`

- **freeform(자연어)**: `recommend.ts`가 `{mode:'extract'}`로 Edge Function `recommend/index.ts`를 호출하면, Edge Function이 **OpenAI**(`gpt-5.4`, `OPENAI_MODEL`로 override)로 자연어를 `{intents, hardConstraints, softIntentTags}`로 **태그추출만** 한다. 이후 클라이언트가 `expandIntents`(intentProfile) → `searchWithProfile`(intentSearch)로 **결정론 검색**하고 점수순 상위 3개로 압축한다.
- **guided(단계선택)**: 네트워크 0회. `selectionOptionConverter`가 답변을 태그로 변환한 뒤 위와 동일한 결정론 검색을 탄다.
- `OPENAI_API_KEY`는 브라우저에 절대 내려가지 않고 Supabase secret에만 존재한다(`recommend.ts`는 `apikey` 헤더만 보냄). 양쪽 모두 **"LLM은 번역(또는 0회)만, 태그 확장·검색·랭킹은 전부 결정론"**이라는 불변식을 지켜 같은 입력→같은 출력을 보장한다.

**레거시 (코드만 존재, 현 UI 미사용)**:

- Edge Function 전체 추천 생성 모드: `scoreKeyboard`로 후보를 압축한 뒤 `gpt-5.4`가 후보 중 직접 선택·사유 생성 → `composeRecommendations`. `index.ts`에 남아있으나 현재 UI는 호출하지 않는다(해당 분기 주석 "현재 UI는 미사용" 참조).
- 클라이언트 `extractRawTags.ts`의 LLM 호출(`claude-sonnet-4-6`, `dangerouslyAllowBrowser`). 프로덕션 추출은 Edge Function extract(OpenAI)가 담당하므로 이 함수들은 현재 직접 호출되지 않는다(타입·테스트용).

`docs/tag-extraction-flow.md`는 이 결정론 하네스의 설계를 서술한다(문서는 클라이언트 claude 추출 기준으로 작성됐고, 실제 프로덕션 추출은 Edge Function의 OpenAI extract가 대체한다). 과거 이 문서가 가리키던 "미연결" 갭은 해소됐다.

### lib/ 결정론 파이프라인 핵심 모듈 (현행 검색 경로)

- `extractRawTags.ts` - 태그 정제(`sanitizeTags`)와 타입 정의. 브라우저 LLM 추출 함수(`extractRawTags`/`extractIntentInput`, `claude-sonnet-4-6`)도 있으나 현행 프로덕션은 Edge Function extract를 쓰므로 미사용(테스트용)
- `tagSchema.ts` - 소프트 의도 태그 어휘(controlled vocabulary)와 검증
- `softTagRules.ts` - 소프트 태그 → 키보드 매칭 술어(규칙 맵)
- `intentProfile.ts` - 고수준 의도(사무용/게이밍/휴대용)를 차원별 요구로 확장. 강도는 `필수`(하드 승격)/`선호`(소프트 점수)/`상관없음`. 명시 제약이 의도보다 우선.
- `hardFilter.ts` - 하드 제약 위반 키보드 제외 (위반 0건 보장)
- `softScorer.ts` - 소프트 태그 매칭 점수 → 랭킹
- `searchEngine.ts`/`intentSearch.ts` - 무결과 시 제약을 우선순위 역순으로 1개씩 완화 후 재검색(`HARD_CONSTRAINT_RELAXATION_ORDER`). `searchKeyboards`는 LEGACY, `searchWithProfile`이 신규 진입점.

### 이벤트 수집 (구매 클릭 / 추천 별점)

추천 가설 검증용 데이터를 모으기 위해 두 가지 사용자 행동을 Supabase에 적재한다(커머스 아님, 실결제 없음).

- `lib/session.ts` - 로그인 없는 익명 세션 식별자(localStorage UUID). 추천 -> 구매 클릭 -> 별점 흐름을 느슨하게 묶는다. PII 아님.
- `lib/events.ts` - `purchase_click`('구매하기' 버튼 클릭, payload `{product_code}`)과 `rating`(추천 전체 별점, payload `{rating}`)을 anon key로 PostgREST `/rest/v1/events`에 직접 insert. **best-effort**라 설정 누락/네트워크 실패는 삼키고 `false`만 반환해 UX를 막지 않는다.
- 스키마: `supabase/migrations/20260617000000_create_events.sql` - 단일 `events`(id, event_type, session_id, payload jsonb, created_at) + **insert-only RLS**(anon은 insert만, select/update/delete는 정책 부재로 기본 거부).
- 검증: `__tests__/events.test.ts`가 payload 형태와 PostgREST 요청/실패 동작을 단위검증. 실제 적재는 라이브 Supabase에서 수동 확인(아래 README 참고).

## 데이터 파이프라인

`crawl.py`는 다나와 **목록 페이지만** 조회한다(상세 페이지 요청 안 함, `DELAY_SEC` 레이트리밋 준수). 한 상품에 스위치 옵션이 여럿이면 제품-스위치 조합별 레코드로 펼치고 최종 **600개**로 제한(`TARGET_RECORDS`). 스위치 이름은 `src/data/switch_aliases.json` 규칙으로만 매칭하고, 매칭 실패는 추론하지 않고 `output/unmatched_switches.json`에 격리한다.

카탈로그 `keyboards.json`은 **두 군데에 사본**으로 존재한다(프론트 표시용 + Edge Function 후보용). 반드시 `npm run sync:data`로 함께 갱신해야 둘이 엇갈리지 않는다.

## 버전 관리

앱 버전의 단일 소스는 `frontend/package.json`의 `version`이다. `npm run build`/`deploy:function`이 `sync:function-version`으로 이 값을 Edge Function의 `version.ts`에 주입하며, Edge Function은 `GET /recommend`, 응답 `meta.version`, `X-Keybuddy-Version` 헤더로 노출한다. 배포 전 `npm version patch|minor|major --no-git-tag-version`으로 SemVer 증가.

## 테스트 규약

`src/__tests__/`에 40개 vitest 스위트가 있다. 특징적인 패턴:

- **`*LlmNoCall.test.ts`** - 결정론 경로가 실제로 LLM을 호출하지 않음을 강제하는 불변식 테스트. lib/ 검색 로직 수정 시 이 보증을 깨지 말 것.
- **`*.goldset.test.ts`** - 정답셋 기반 정확도 회귀 테스트(하드제약/소프트의도 정확도).
- **`*Parity.test.ts`** - 두 경로/구현 간 동작 일치 검증.

## Git 작업 규칙

- `ellipsis` 브랜치에 직접 커밋하지 말 것. `ellipsis`는 `origin/ellipsis`와 동일하게 유지한다.
- 작업은 항상 새 브랜치에서 진행한다 (`feat/...`, `fix/...`).

## 리뷰 기준 (`REVIEW.md`)

`Important`는 동작을 막는 결함(로직 오류·보안·데이터 유출·크래시)에만 사용하고 스타일 제안은 최대 `Nit`. 생성 산출물(`impl/output/**`, `src/data/keyboards.json`)과 `node_modules`는 리뷰 대상에서 제외한다.
