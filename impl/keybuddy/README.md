# keybuddy

다나와 크롤러(`output/keyboards.json`)를 입력으로, 자연어 / 단계별 질문에 맞춰
키보드를 추천해 주는 웹 서비스.

추천은 **태그 파이프라인 + 의도 하네싱** 구조입니다. LLM은 자연어를 "의도 + 명시 제약"으로
번역만 하고, 태그로 펼쳐 검색하는 단계는 전부 결정론(LLM 호출 0회)입니다.

## 추천 동작 방식 (요약)

```
자연어 → ① extractIntentInput [LLM]  → {의도, 명시 제약}
       → ② expandIntents [결정론]    → 의도를 차원별 프로파일로 펼침
                                        (필수=하드 / 선호=소프트, 명시 우선)
       → ③ searchWithProfile [결정론] → 하드 필터 + 소프트 점수 + 무결과 완화
```

- 예: `"게임용 RGB 텐키리스"` → 의도 `게이밍`이 `기계식`을 **필수(하드)로 승격** → 멤브레인 게이밍은 배제.
- 단계별 질문 경로는 LLM 호출 없이 완전히 결정론적으로 동작합니다(오프라인 가능).

📖 자세한 플로우: [`docs/tag-extraction-flow.md`](docs/tag-extraction-flow.md)
전/후 정성 비교: [`intent-harness-before-after.md`](intent-harness-before-after.md)

## 구조

```
keybuddy/
  frontend/          Vite + React + TS + Tailwind (단일 프론트, 서버 없음)
    src/
      App.tsx                 화면(홈 / 단계별 질문 / 결과)
      lib/
        extractRawTags.ts     ① LLM 추출 (의도 + 명시 제약 분리)
        intentProfile.ts      ② 의도 어휘·정적 프로파일 문서·확장
        intentSearch.ts       ③ 의도 확장 검색(필수 하드 승격 + 완화)
        softTagRules.ts       태그 → 속성 술어 정적 규칙표
        softScorer.ts         소프트 점수·랭킹
        searchEngine.ts       하드 필터·완화 순서 코어
        guidedInputMapper.ts  단계선택 → 태그/의도 변환
        recommend.ts          전체 오케스트레이션
      data/keyboards.json     크롤링 데이터 사본(추천 후보)
      types.ts
  docs/tag-extraction-flow.md 자연어 → 태그 추출 상세 문서
```

별도 백엔드 없이 프론트에서 Claude를 직접 호출합니다(`dangerouslyAllowBrowser`).
검색/스코어링/결과 생성에는 LLM을 쓰지 않으므로 같은 입력 → 같은 결과가 보장됩니다.

## 실행

```bash
cd impl/keybuddy/frontend
cp .env.local.example .env.local   # VITE_ANTHROPIC_API_KEY 채우기
npm install
npm run dev      # 개발 서버 (브라우저 콘솔에 의도/태그 추출 로그 출력)
npm test         # 단위 테스트
npm run build    # 타입체크 + 프로덕션 빌드
```

## 키 보호 주의

`.env.local`은 git 커밋만 막아줄 뿐, `VITE_` 변수는 빌드 번들에 인라인되어
브라우저에서 노출됩니다. **내 컴퓨터에서 나만 쓰는 로컬 용도로만** 사용하세요.
공개 배포가 필요하면 키를 쥐는 작은 프록시(서버)로 전환해야 합니다.

## 데이터 갱신

상위 크롤러(`impl/crawl.py`)를 다시 돌린 뒤 결과를 복사합니다. (아래는 `impl/` 기준)

```bash
python3 crawl.py
cp output/keyboards.json keybuddy/frontend/src/data/keyboards.json
```
