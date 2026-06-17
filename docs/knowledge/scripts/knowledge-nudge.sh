#!/bin/bash
# 세션 시작 훅(선택): pending 지식 후보가 일정량 쌓이면 승격 리뷰를 권한다.
# 쿨다운(기본 3일)으로 매 세션 반복 안내를 막는다. 승격(수동)이 잊혀 후보만 쌓이는 것을 방지.
#
# 저장 위치 우선순위: $KNOWLEDGE_DIR > <git 루트>/docs/knowledge > <cwd>/docs/knowledge
# 출력 형식: 기본은 평문 한 줄. $KNOWLEDGE_NUDGE_FORMAT=claude-json 이면
#           Claude Code SessionStart additionalContext JSON 으로 출력한다.

if [ -n "$KNOWLEDGE_DIR" ]; then
  KNOW_DIR="$KNOWLEDGE_DIR"
else
  repo_root=$(git rev-parse --show-toplevel 2>/dev/null)
  KNOW_DIR="${repo_root:-$PWD}/docs/knowledge"
fi
PENDING="$KNOW_DIR/pending.md"
STAMP="$KNOW_DIR/.nudge-stamp"
THRESHOLD="${KNOWLEDGE_NUDGE_THRESHOLD:-8}"   # pending 누적 세션(## 헤더) 수 임계값
COOLDOWN="${KNOWLEDGE_NUDGE_COOLDOWN:-259200}" # 재안내 쿨다운 3일(초)

[ -f "$PENDING" ] || exit 0

sessions=$(grep -c '^## ' "$PENDING" 2>/dev/null)
sessions=${sessions:-0}
[ "$sessions" -ge "$THRESHOLD" ] || exit 0

now=$(date +%s)
if [ -f "$STAMP" ]; then
  last=$(cat "$STAMP" 2>/dev/null)
  last=${last:-0}
  [ $(( now - last )) -ge "$COOLDOWN" ] || exit 0
fi
echo "$now" > "$STAMP"

ctx="지식 후보가 ${sessions}개 세션 분량 쌓였습니다. 시간 날 때 docs/knowledge/README.md 의 승격 워크플로로 리뷰를 권장합니다(마지막 안내 후 3일+ 경과). 후보 파일: ${PENDING}"

if [ "$KNOWLEDGE_NUDGE_FORMAT" = "claude-json" ]; then
  # SessionStart additionalContext 로 주입. 경로에 따옴표/역슬래시가 있어도
  # JSON 이 깨지지 않도록 jq 로 인코딩한다(extract 와 동일하게 jq 의존).
  jq -cn --arg ctx "$ctx" '{hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:$ctx}}'
else
  printf '%s\n' "$ctx"
fi

exit 0
