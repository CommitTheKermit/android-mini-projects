# keybuddy

다나와 크롤러(`output/keyboards.json`, 100개)를 입력으로, 자연어/단계별 질문에 맞춰
키보드를 추천해 주는 웹 서비스입니다.

브라우저에서 OpenAI API를 직접 호출하지 않고, Supabase Edge Function이 서버사이드에서
OpenAI를 호출합니다. 비용을 줄이기 위해 Edge Function에서 먼저 후보를 25개 이하로
압축한 뒤 저가 모델에 넘깁니다.

## 구조

```text
keybuddy/
  frontend/                         Vite + React + TS + Tailwind
    src/
      App.tsx                       화면(홈 / 단계별 질문 / 결과)
      lib/recommend.ts              Supabase Edge Function 호출
      data/keyboards.json           크롤링 데이터 사본(프론트 표시용)
      types.ts

  supabase/
    .gitignore                      로컬 secret 파일 제외
    functions/
      recommend/
        index.ts                    OpenAI 호출 + 후보 압축 + 결과 매핑
        keyboards.json              추천 후보 카탈로그
```

## 요청 흐름

```text
React 브라우저
  -> Supabase Edge Function /recommend
  -> OPENAI_API_KEY secret 읽기
  -> 후보 25개 이하로 압축
  -> OpenAI 저가 모델 호출
  -> catalog index 기반 추천 JSON 반환
  -> 프론트가 결과 렌더링
```

브라우저에는 `OPENAI_API_KEY`가 내려가지 않습니다.

## 로컬 준비

### 1. 프론트 설정

```bash
cd keybuddy/frontend
cp .env.local.example .env.local
npm install
```

`.env.local`에는 Supabase 프로젝트의 공개 설정값을 채웁니다.

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

로컬 Edge Function을 직접 붙일 때만 아래 값을 추가합니다.

```env
VITE_SUPABASE_RECOMMEND_URL=http://127.0.0.1:54321/functions/v1/recommend
```

### 2. Supabase CLI 설정

```bash
npm install -g supabase
supabase login
```

프로젝트 연결:

```bash
cd keybuddy
supabase link --project-ref your-project-ref
```

`project-ref`는 Supabase 프로젝트 URL의 앞부분입니다.

```text
https://abcdefghijk.supabase.co
        ^^^^^^^^^^^
```

### 3. OpenAI secret 등록

OpenAI API 키는 프론트 `.env.local`에 쓰지 않습니다.

```bash
cd keybuddy
supabase secrets set OPENAI_API_KEY=sk-...
```

선택적으로 모델을 바꿀 수 있습니다. 기본값은 비용을 낮추기 위해 `gpt-4.1-nano`입니다.

```bash
supabase secrets set OPENAI_MODEL=gpt-4.1-nano
```

## 로컬 실행

프론트:

```bash
cd keybuddy/frontend
npm run dev
```

Edge Function 로컬 실행:

```bash
cd keybuddy
supabase functions serve recommend --env-file supabase/functions/.env.local
```

로컬 테스트용 `supabase/functions/.env.local` 예시:

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1-nano
```

이 파일은 `keybuddy/supabase/.gitignore`로 제외됩니다.

## 배포

프론트 빌드:

```bash
cd keybuddy/frontend
npm run build
```

Edge Function 배포:

```bash
cd keybuddy
supabase functions deploy recommend
```

프론트 정적 배포는 Supabase Hosting이 아니라 Vercel, Netlify, GitHub Pages 같은 정적
호스팅을 사용하면 됩니다. Supabase는 추천 API 역할만 담당합니다.

## 데이터 갱신

상위 크롤러를 다시 돌린 뒤 결과를 프론트와 Supabase 함수 양쪽에 복사합니다.

```bash
python3 crawl.py
cp output/keyboards.json keybuddy/frontend/src/data/keyboards.json
cp output/keyboards.json keybuddy/supabase/functions/recommend/keyboards.json
```

## 보안/비용 메모

- 프론트에 `VITE_OPENAI_API_KEY` 같은 값을 두지 않습니다.
- `VITE_` 환경변수는 브라우저 번들에 포함됩니다.
- `OPENAI_API_KEY`는 Supabase secret으로만 저장합니다.
- 기본 모델은 저비용 목적의 `gpt-4.1-nano`입니다.
- Edge Function은 LLM 호출 전에 후보를 25개 이하로 줄여 입력 토큰을 줄입니다.
- 공개 서비스로 운영할 때는 로그인, rate limit, 캐싱을 추가하는 것이 좋습니다.
