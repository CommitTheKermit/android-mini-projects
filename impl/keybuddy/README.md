# keybuddy

다나와 크롤러(`output/keyboards.json`, 100개)를 입력으로, 자연어/단계별 질문에 맞춰
키보드를 추천해 주는 웹 서비스. 추천은 Claude API(LLM)로 수행합니다.

## 구조

```
keybuddy/
  frontend/        Vite + React + TS + Tailwind (단일 프론트, 서버 없음)
    src/
      App.tsx          화면(홈 / 단계별 질문 / 결과)
      lib/recommend.ts Claude 호출 + 카탈로그 프롬프트 캐싱 + 구조화 출력
      data/keyboards.json  크롤링 데이터 사본(추천 후보)
      types.ts
```

별도 백엔드 없이 프론트에서 Claude를 직접 호출합니다(`dangerouslyAllowBrowser`).
LLM은 `data/keyboards.json`의 인덱스만 골라 반환하고, 가격/이미지 등 실제 값은
프론트가 카탈로그에서 채웁니다(환각 방지). 제품별 추천 사유/태그는 LLM이 생성합니다.

## 실행

```bash
cd impl/keybuddy/frontend
cp .env.local.example .env.local   # VITE_ANTHROPIC_API_KEY 채우기
npm install
npm run dev
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
