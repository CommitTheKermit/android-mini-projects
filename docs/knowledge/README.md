# 레포 내장 지식 루프 (in-repo knowledge loop)

세션에서 쌓인 지식 후보를 모으고(extract) -> 사람이 검토해(review) -> 규칙/문서로 승격하는(promote) 루프를, **특정 AI 도구나 개인 머신(`~/.claude`)이 아니라 이 레포 안에 두기 위한 템플릿이자 가이드**다.

이 문서 하나만 보면 다른 개발자가 자기 환경(Claude Code / Codex / Cursor / 수동)에 똑같이 적용할 수 있도록 만드는 것이 목표다.

## 왜 레포 안에 두나

지식이 한 사람의 `~/.claude` 같은 개인 경로에만 쌓이면 두 가지가 깨진다.

- **도구 교체 호환성**: 추출/저장이 특정 도구의 개인 설정에 묶이면, 팀이 Codex나 Cursor로 바꾸는 순간 그동안 쌓인 지식과 루프가 따라오지 않는다.
- **사람 컨텍스트 비의존**: 지식이 개인 머신에만 있으면 그 사람이 빠졌을 때 인수인계가 끊긴다.

그래서 **저장소와 승격 워크플로는 레포에 커밋**해 누구나 클론만 하면 보게 하고, 도구에 종속되는 부분(세션 훅으로 추출기를 호출하는 방식)만 각자 환경에 맞게 꽂는다.

## 무엇인가 (3단계 루프)

1. **extract (자동)**: 세션이 끝날 때 훅이 대화에서 "다음에도 가치가 남을 지식 후보"를 0~3개 뽑아 `pending.md`에 적재한다. 자동 반영이 아니라 *후보 적재*까지만 한다 (잘못된 가설이 규칙을 오염시키는 것을 막기 위해).
2. **review (수동)**: 사람이 주기적으로 `pending.md`를 읽고 군집화해, 승격할지 폐기할지 판단한다.
3. **promote (수동)**: 승인된 후보만 아래 중 하나로 올린다.
   - 1~2줄로 압축되는 규칙/제약 -> `AGENTS.md`(또는 `CLAUDE.md`)
   - 길거나 구조적인 기술 명세(아키텍처/스키마/도메인) -> `docs/<주제>.md`, 그리고 `AGENTS.md`엔 "상세는 `docs/<주제>.md` 참조" 한 줄만
   - 규칙은 아니지만 보존 가치 있는 지식 -> `docs/knowledge/promoted/<주제>.md`
   - 일회성/검증 불가/이미 반영됨 -> 폐기

   처리한 후보는 `pending.md`에서 빼고 `archive.md`에 날짜·결과와 함께 남긴다.

**핵심 원칙**: 빈도만으로 승격하지 않는다. "반복됨 + 사람 교정 없이 통과 + 검증됨"을 만족할 때만 올린다.

## 폴더 구조

```
docs/knowledge/
  README.md            # 이 가이드
  pending.md           # 추출된 지식 후보 (훅이 append, 검토 후 비움)
  archive.md           # 처리 완료된 후보 이력
  promoted/            # 승격된 영구 지식 문서 (규칙이 아닌 보존형 지식)
  scripts/
    knowledge-extract.sh   # SessionEnd: 후보 추출 -> pending.md
    knowledge-nudge.sh     # SessionStart: 후보가 쌓이면 리뷰 권고 (선택)
```

## 적용 방법

### 0. 공통

스크립트는 저장 위치를 다음 우선순위로 정한다.

1. 환경변수 `KNOWLEDGE_DIR` 가 있으면 그 경로
2. 없으면 git 루트의 `docs/knowledge`
3. git 루트를 못 찾으면 현재 작업 디렉터리의 `docs/knowledge`

즉 이 레포에서는 별도 설정 없이 `docs/knowledge/`를 저장소로 쓴다. LLM 호출은 기본 `claude -p --model claude-haiku-4-5-20251001` 이며, 환경변수 `KNOWLEDGE_LLM_CMD` 로 다른 CLI(예: `codex exec`, `llm -m ...`)로 교체할 수 있다.

### A. Claude Code

프로젝트 `.claude/settings.json` 에 훅을 등록한다. (경로는 레포 루트 기준)

```json
{
  "hooks": {
    "SessionEnd": [
      { "hooks": [
        { "type": "command", "command": "bash \"$CLAUDE_PROJECT_DIR/docs/knowledge/scripts/knowledge-extract.sh\"" }
      ] }
    ],
    "SessionStart": [
      { "matcher": "startup|resume", "hooks": [
        { "type": "command", "command": "bash \"$CLAUDE_PROJECT_DIR/docs/knowledge/scripts/knowledge-nudge.sh\"" }
      ] }
    ]
  }
}
```

> **주의 - 중복 등록 금지**: 이미 `~/.claude` 에 전역 knowledge-loop 훅을 쓰고 있다면, 여기에 또 등록하면 한 세션에서 추출이 두 번 돈다(전역 -> `~/.claude`, 프로젝트 -> 레포). 둘 중 하나만 써야 한다. 그래서 **이 레포는 일부러 훅을 등록해 두지 않았다.** 전역 루프가 없는 사람만 위 설정을 추가하면 된다.

### B. 기타 도구 (Codex / Cursor 등)

도구가 "세션 종료" 훅을 지원하면 거기서 `knowledge-extract.sh` 를 호출하면 된다. 지원하지 않으면 작업을 마칠 때 수동으로 한 번 실행해도 동일하다.

스크립트의 stdin 은 transcript 파일 자체가 아니라, 그 경로를 가리키는 `{ "transcript_path": ..., "cwd": ..., "session_id": ... }` JSON 이다 (Claude Code SessionEnd 훅 입력 형식). 그래서 transcript 를 직접 파이프하지 말고 아래처럼 경로를 담은 JSON 을 넘긴다.

```bash
echo '{"transcript_path":"/경로/transcript.jsonl","cwd":"'"$PWD"'","session_id":"manual"}' \
  | KNOWLEDGE_LLM_CMD="codex exec" bash docs/knowledge/scripts/knowledge-extract.sh
```

다른 도구라면 위 형식에 맞춰 transcript 경로만 채워 넘겨주면 된다.

### C. 완전 수동

훅 없이도 운영된다. 가치 있는 결정을 내릴 때마다 `pending.md` 에 직접 한 줄 적고, 주기적으로 `review/promote` 절차만 따르면 된다. 자동 추출은 어디까지나 "사람이 적기를 잊는 것"을 보완하는 장치다.

## 원본/참고

이 템플릿은 개인 전역 설정에 있던 `knowledge-loop` 스킬(추출은 자동, 승격은 수동)을 도구·머신 비종속 형태로 레포에 옮겨 적은 것이다. 자동 반영을 금지하고 승격을 사람이 검토하는 설계 의도는 그대로 유지한다.
