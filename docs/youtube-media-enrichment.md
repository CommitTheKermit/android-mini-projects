# YouTube 타건 영상 링크 보강

이 문서는 다나와 키보드 목록 크롤러가 수집한 제품-스위치 레코드에 YouTube 타건 영상
링크를 보강하는 설계와 운영 규칙을 정리한다.

## 원칙

- YouTube 링크는 공식 YouTube Data API로만 수집한다.
- YouTube 검색 HTML을 직접 파싱하거나 스크래핑으로 쿼터를 우회하지 않는다.
- 다나와 크롤링은 기존처럼 목록 페이지만 조회한다. YouTube 보강은 다나와 수집 이후의
  별도 enrichment 단계다.
- `keyboards.json`에는 재생에 필요한 최소 필드만 넣는다.

## 데이터 계약

`impl/output/keyboards.json`의 각 레코드에는 기존 UI 계약을 유지해 아래 필드만 반영한다.

```json
{
  "media_url": "https://www.youtube.com/watch?v=VIDEO_ID",
  "media_url_is_placeholder": false
}
```

링크를 찾지 못했거나 아직 검색하지 않은 경우:

```json
{
  "media_url": null,
  "media_url_is_placeholder": true
}
```

영상 제목, 채널명, 점수, 검색어, 실패 이유 같은 감사 정보는 `keyboards.json`에 넣지
않고 별도 파일에 둔다.

## 파일 역할

- `impl/output/youtube_media_cache.json`: 누적 캐시. 다음 실행에서 먼저 읽어
  `keyboards.json`에 다시 반영한다.
- `impl/output/youtube_media_report.json`: 최근 실행 리포트. 성공, 실패, 스킵, 쿼터 제한,
  오류를 확인한다.
- `impl/output/keyboards.json`: 앱이 사용할 원본 카탈로그. YouTube 보강 후 저장된다.
- `impl/keybuddy/frontend/src/data/keyboards.json`: 프론트 표시용 사본.
- `impl/keybuddy/supabase/functions/recommend/keyboards.json`: Edge Function 추천 후보용 사본.

## 검색 키

검색어는 제품명과 스위치명을 조합한다.

```text
상품명 + raw_switch_name
```

`raw_switch_name`이 없으면 `switch_name`을 사용한다. 둘 다 없으면 YouTube 검색을 건너뛰고
placeholder 상태를 유지한다.

캐시 키는 `product_code`가 있으면 우선 사용한다.

```text
product_code:<product_code>::switch:<switch_label>
```

`product_code`가 없을 때만 정규화된 `product_name + switch_label`로 fallback한다.

## 실행

기본 크롤링은 YouTube API를 호출하지 않는다.

```bash
cd impl
python3 crawl.py
```

YouTube 링크를 새로 수집하려면 API 키와 limit을 지정한다.

```bash
cd impl
YOUTUBE_API_KEY=<key> python3 crawl.py --with-youtube --youtube-limit 90
```

새 검색 없이 기존 캐시만 현재 `keyboards.json`에 다시 입히려면:

```bash
cd impl
python3 crawl.py --with-youtube --youtube-limit 0
```

기존 캐시를 무시하고 다시 검색하려면:

```bash
cd impl
YOUTUBE_API_KEY=<key> python3 crawl.py --with-youtube --youtube-refresh --youtube-limit 90
```

## 이어서 수집되는 방식

매 실행은 다음 순서로 동작한다.

1. 다나와 목록에서 새 `collected` 레코드를 만든다.
2. `youtube_media_cache.json`을 읽는다.
3. 캐시에 있는 항목은 API 호출 없이 `media_url`을 바로 반영한다.
4. 캐시에 없는 항목만 `--youtube-limit` 범위 안에서 새로 검색한다.
5. 새 검색 결과를 캐시에 추가한다.
6. 캐시 반영분과 새 수집분이 합쳐진 상태로 `impl/output/keyboards.json`을 저장한다.

즉 `keyboards.json`을 이어붙이는 방식이 아니라, 매번 새 다나와 결과에 누적 캐시를 다시
입히는 방식이다. 다나와 상품명이나 옵션명이 바뀌어도 `product_code` 기반 캐시 키가
있으면 기존 링크를 재사용할 수 있다.

## 동기화

`impl/output/keyboards.json`을 갱신한 뒤에는 반드시 프론트와 Edge Function 사본을 함께
동기화한다.

```bash
cd impl/keybuddy/frontend
npm run sync:data
```

이 명령은 아래 두 파일을 함께 갱신한다.

```text
src/data/keyboards.json
../supabase/functions/recommend/keyboards.json
```

둘 중 하나만 갱신하면 프론트 표시와 추천 후보 데이터가 어긋날 수 있다.

## 검증

최소 검증:

```bash
impl/.venv/bin/python -m unittest discover -s impl -p 'test*.py'
```

데이터 동기화 확인:

```bash
cmp -s impl/output/keyboards.json impl/keybuddy/frontend/src/data/keyboards.json
cmp -s impl/output/keyboards.json impl/keybuddy/supabase/functions/recommend/keyboards.json
```

UI 검증:

- `media_url`이 있는 추천 카드에서 영상 버튼이 표시되는지 확인한다.
- 버튼 클릭 시 새 탭에서 YouTube 영상 페이지가 열리는지 확인한다.
- `media_url`이 없는 항목은 준비 중 상태로 표시되는지 확인한다.

## 주의

- API 키는 문서, 커밋, 프론트 `.env.local`에 남기지 않는다.
- `YOUTUBE_API_KEY`는 크롤러 실행 환경 변수로만 주입한다.
- YouTube API 쿼터를 고려해 기본 운영 limit은 하루 90건 정도로 둔다.
- 403 오류가 나면 쿼터 초과나 API key 제한 설정을 먼저 확인한다.
