# Supabase Edge Function 버전 관리 메모

## 프로젝트 메모리 작성 위치

현재 이 프로젝트의 배포/버전 관리 메모는 아래 파일에 작성했습니다.

- `impl/keybuddy/README.md`
  - `## 배포` 섹션에 앱 버전 단일 소스, 버전 증가 방식, Supabase Edge Function 배포 및 버전 확인 방법을 반영했습니다.
- `impl/keybuddy/docs/deployment-version-management.md`
  - 이 파일입니다. 어떤 내용을 어디에 기록했는지와 코드 변경 이유를 별도로 정리합니다.

대화에서 언급된 Firebase 프로젝트 `socratic-learn-web` 관련 배포 절차는 이 저장소의 실제 배포 대상이 아니므로 그대로 적용하지 않았습니다. 대신 해당 프로젝트의 원칙 중 “배포할 때마다 SemVer 기준으로 단일 버전을 올린다”는 부분만 Supabase Edge Function 구조에 맞게 적용했습니다.

## 코드 변경이 필요했던 이유

기존 상태에서는 `frontend/package.json`에만 앱 버전(`0.1.0`)이 있었고, Supabase Edge Function 배포물에는 어떤 앱 버전이 올라가 있는지 확인할 방법이 없었습니다.

Supabase Edge Function은 Firebase Functions처럼 별도 릴리즈 커밋이나 배포 메타가 자동으로 앱 응답에 드러나지 않습니다. 그래서 배포 후 운영 환경에서 아래 질문에 답하기 어려웠습니다.

- 현재 배포된 `recommend` Edge Function이 어떤 앱 버전인지
- 프론트와 Edge Function이 같은 버전 기준으로 배포되었는지
- 장애나 회귀가 발생했을 때 어떤 버전의 함수 응답인지

이를 해결하기 위해 Edge Function이 앱 버전을 응답에 노출하도록 변경했습니다.

## 적용한 방식

앱 버전의 단일 소스는 계속 `impl/keybuddy/frontend/package.json`입니다.

프론트 빌드 시 아래 스크립트가 실행됩니다.

```bash
npm run sync:function-version
```

이 스크립트는 `frontend/package.json`의 `version` 값을 읽어서 아래 파일을 생성/갱신합니다.

```text
impl/keybuddy/supabase/functions/recommend/version.ts
```

Edge Function은 이 파일의 `appVersion`을 import해서 사용합니다.

## 버전 확인 방법

배포된 Edge Function은 OpenAI 호출 없이 `GET` 요청만으로 버전을 확인할 수 있습니다.

```bash
curl https://kzgrduvwwoflybrqayyk.supabase.co/functions/v1/recommend
```

예상 응답 형식:

```json
{
  "name": "recommend",
  "version": "0.1.0"
}
```

추천 `POST` 응답에도 아래 메타가 포함됩니다.

```json
{
  "summary": "...",
  "recommendations": [],
  "meta": {
    "version": "0.1.0"
  }
}
```

응답 헤더에도 같은 버전이 포함됩니다.

```text
X-Keybuddy-Version: 0.1.0
```

## 이 방식의 장점

- 버전의 원본은 `frontend/package.json` 한 곳으로 유지됩니다.
- Edge Function 배포 번들 내부에 `version.ts`가 포함되므로, 배포 시 상위 디렉터리 파일 import 문제를 피할 수 있습니다.
- 배포 후 `GET /functions/v1/recommend`만으로 현재 함수 버전을 확인할 수 있습니다.
- 기존 추천 API 계약은 유지하면서 `meta.version`만 선택 필드로 추가하므로 프론트 호환성이 깨지지 않습니다.

## 배포 시 주의사항

배포 전 변경 성격에 맞춰 SemVer 기준으로 버전을 올립니다.

```bash
cd impl/keybuddy/frontend
npm version patch --no-git-tag-version
```

- 호환되는 버그 수정: `patch`
- 호환되는 기능 추가: `minor`
- 호환 깨짐: `major`

그 다음 프론트 빌드를 실행하면 Edge Function 버전 파일이 자동 갱신됩니다.

```bash
npm run build
```

Edge Function을 배포할 때는 빌드를 먼저 강제하는 래퍼를 사용합니다.

```bash
SUPABASE_PROJECT_REF=your-project-ref npm run deploy:function
```

이 래퍼는 `npm run build`를 먼저 실행한 뒤 `supabase functions deploy recommend`를
호출하므로, `package.json`의 버전과 `supabase/functions/recommend/version.ts`의 버전이
어긋난 상태로 배포될 가능성을 줄입니다.

프로덕션 오배포를 피하기 위해 `SUPABASE_PROJECT_REF`는 필수입니다. 현재 프로젝트에
배포할 때는 아래처럼 명시합니다.

```bash
SUPABASE_PROJECT_REF=kzgrduvwwoflybrqayyk npm run deploy:function
```

Supabase Edge Function 배포는 사용자가 명시적으로 요청할 때만 수행합니다.
