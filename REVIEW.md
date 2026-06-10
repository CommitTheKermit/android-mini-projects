# 리뷰 지침

리뷰 코멘트와 요약은 모두 한국어로 작성한다.

## Important의 기준
Important는 동작을 막는 결함에만 사용한다: 로직 오류, 보안 문제, 데이터 유출, 크래시.
스타일/리팩터링 제안은 최대 Nit으로 분류한다.

## Nit 상한
한 번의 리뷰에서 Nit은 최대 5개까지만 보고한다. 그 이상이면 "외 N건 유사" 로 묶는다.

## 경로별 중점
- `impl/keybuddy/frontend/**/*.{ts,tsx}` (React + TypeScript):
  불필요한 리렌더, any 남용, 에러 처리 누락, 의도 추출/추천 로직의 경계 조건.
- `impl/**/*.py` (Python 크롤러):
  네트워크 예외 처리, 파싱 실패 대응, 하드코딩된 셀렉터/경로, 레이트리밋 미준수.

## 보고하지 않을 것
- 생성 산출물: `impl/output/**`, `impl/keybuddy/frontend/src/data/keyboards.json`
- `**/node_modules/**`, `*.lock`
- 린트/포매팅 등 CI가 이미 강제하는 항목
