# AGENTS.md

이 파일은 이 저장소에서 작업하는 모든 AI 코딩 에이전트(Claude Code, Codex, Cursor 등)와 사람 메인테이너의 단일 진실 공급원(SSOT)이다. 특정 도구에 종속되지 않도록 작성한다. `CLAUDE.md`는 이 파일을 가리키는 심볼릭 링크이므로 둘 중 무엇을 편집해도 같은 내용이 갱신된다.

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

## 아키텍처: 두 개의 추천 경로

keybuddy의 핵심은 **추천 엔진이 두 갈래로 존재**한다는 점이다. 혼동하지 말 것.

1. **현재 UI에 연결된 경로 (production)**: `App.tsx` → `lib/recommend.ts`(HTTP fetch) → Supabase Edge Function `recommend/index.ts`. Edge Function이 키워드 스코어링(`scoreKeyboard`)으로 후보를 40개 이하로 압축한 뒤 **OpenAI**(`gpt-5.4`)에 넘겨 추천 사유를 생성한다. `OPENAI_API_KEY`는 브라우저에 절대 내려가지 않고 Supabase secret에만 존재한다 (`recommend.ts`는 `apikey` 헤더만 보냄).

2. **결정론적 의도 하네스 (lib/, 테스트로만 검증됨 - 아직 UI 미연결)**: `extractRawTags.ts`(유일한 LLM 호출, `claude-sonnet-4-6`로 자연어→의도+명시제약 번역) → `intentProfile.ts`(의도를 차원별 태그로 정적 확장) → `intentSearch.ts`/`searchEngine.ts`(하드필터 + 소프트 스코어링 + 무결과 시 제약 완화). 설계 의도는 `docs/tag-extraction-flow.md` 참고. **"LLM은 번역만, 태그 확장·검색은 전부 결정론"**이 핵심 불변식이며, 같은 입력→같은 출력을 보장한다.

`docs/tag-extraction-flow.md`는 경로 2를 "현재 흐름"으로 서술하지만 실제 `recommend.ts`는 경로 1(Edge Function)을 호출한다. 경로 2는 구축·테스트 완료됐으나 아직 `recommend.ts`에 배선되지 않았다 - 이 갭이 TODO의 "키보드 에이전트 직접 설계" 작업 대상이다.

### lib/ 파이프라인 핵심 모듈 (경로 2)

- `extractRawTags.ts` - 자연어 → `ExtractedTags { hardConstraints, softIntentTags }` (LLM 1회)
- `tagSchema.ts` - 소프트 의도 태그 어휘(controlled vocabulary)와 검증
- `softTagRules.ts` - 소프트 태그 → 키보드 매칭 술어(규칙 맵)
- `intentProfile.ts` - 고수준 의도(사무용/게이밍/휴대용)를 차원별 요구로 확장. 강도는 `필수`(하드 승격)/`선호`(소프트 점수)/`상관없음`. 명시 제약이 의도보다 우선.
- `hardFilter.ts` - 하드 제약 위반 키보드 제외 (위반 0건 보장)
- `softScorer.ts` - 소프트 태그 매칭 점수 → 랭킹
- `searchEngine.ts`/`intentSearch.ts` - 무결과 시 제약을 우선순위 역순으로 1개씩 완화 후 재검색(`HARD_CONSTRAINT_RELAXATION_ORDER`). `searchKeyboards`는 LEGACY, `searchWithProfile`이 신규 진입점.

## 데이터 파이프라인

`crawl.py`는 다나와 **목록 페이지만** 조회한다(상세 페이지 요청 안 함, `DELAY_SEC` 레이트리밋 준수). 한 상품에 스위치 옵션이 여럿이면 제품-스위치 조합별 레코드로 펼치고 최종 **600개**로 제한(`TARGET_RECORDS`). 스위치 이름은 `src/data/switch_aliases.json` 규칙으로만 매칭하고, 매칭 실패는 추론하지 않고 `output/unmatched_switches.json`에 격리한다.

카탈로그 `keyboards.json`은 **두 군데에 사본**으로 존재한다(프론트 표시용 + Edge Function 후보용). 반드시 `npm run sync:data`로 함께 갱신해야 둘이 엇갈리지 않는다.

## 버전 관리

앱 버전의 단일 소스는 `frontend/package.json`의 `version`이다. `npm run build`/`deploy:function`이 `sync:function-version`으로 이 값을 Edge Function의 `version.ts`에 주입하며, Edge Function은 `GET /recommend`, 응답 `meta.version`, `X-Keybuddy-Version` 헤더로 노출한다. 배포 전 `npm version patch|minor|major --no-git-tag-version`으로 SemVer 증가.

## 테스트 규약

`src/__tests__/`에 36개 vitest 스위트가 있다. 특징적인 패턴:

- **`*LlmNoCall.test.ts`** - 결정론 경로가 실제로 LLM을 호출하지 않음을 강제하는 불변식 테스트. lib/ 검색 로직 수정 시 이 보증을 깨지 말 것.
- **`*.goldset.test.ts`** - 정답셋 기반 정확도 회귀 테스트(하드제약/소프트의도 정확도).
- **`*Parity.test.ts`** - 두 경로/구현 간 동작 일치 검증.

## Git 작업 규칙

- `ellipsis` 브랜치에 직접 커밋하지 말 것. `ellipsis`는 `origin/ellipsis`와 동일하게 유지한다.
- 작업은 항상 새 브랜치에서 진행한다 (`feat/...`, `fix/...`).

## 리뷰 기준 (`REVIEW.md`)

`Important`는 동작을 막는 결함(로직 오류·보안·데이터 유출·크래시)에만 사용하고 스타일 제안은 최대 `Nit`. 생성 산출물(`impl/output/**`, `src/data/keyboards.json`)과 `node_modules`는 리뷰 대상에서 제외한다.
