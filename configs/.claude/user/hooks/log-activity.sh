#!/usr/bin/env bash
# log-activity.sh
# Append one JSONL event to ~/.claude/workflow-docs/activity.jsonl per Claude
# Code hook event. Used by the workflow-visualizer "Live agents" pane.
#
# Wired into settings.json under PreToolUse / PostToolUse / SubagentStart /
# SubagentStop / UserPromptSubmit. Claude Code passes the event payload as
# JSON on stdin.
#
# Always exit 0 — must never block the parent tool call.

set -u

DOCS_DIR="${CLAUDE_WORKFLOW_DOCS_DIR:-$HOME/.claude/workflow-docs}"

# Per-project log so different repos don't pollute each other's Live agents pane.
PROJ_BASENAME="$(basename "$PWD" | tr -c 'a-zA-Z0-9._-' '-' | sed 's/--*/-/g' | sed 's/^-//;s/-$//')"
[ -z "$PROJ_BASENAME" ] && PROJ_BASENAME="project"
PROJ_HASH_SHORT="$(printf '%s' "$PWD" | shasum 2>/dev/null | awk '{print substr($1, 1, 8)}')"
[ -z "$PROJ_HASH_SHORT" ] && PROJ_HASH_SHORT="$(printf '%s' "$PWD" | md5sum 2>/dev/null | awk '{print substr($1, 1, 8)}')"
[ -z "$PROJ_HASH_SHORT" ] && PROJ_HASH_SHORT="default"
PROJECT_SLUG="${PROJ_BASENAME}-${PROJ_HASH_SHORT}"

LOG_DIR="$DOCS_DIR/projects/$PROJECT_SLUG"
LOG="$LOG_DIR/activity.jsonl"
mkdir -p "$LOG_DIR" 2>/dev/null || exit 0

EVENT="${1:-unknown}"
PAYLOAD="$(cat 2>/dev/null || true)"

# ---------- field extraction (jq if present, fallback to sed) ----------
extract() {
  local key="$1"
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$PAYLOAD" | jq -r --arg k "$key" 'getpath($k | split(".")) // empty' 2>/dev/null
  else
    local leaf="${key##*.}"
    printf '%s' "$PAYLOAD" | sed -n 's/.*"'"$leaf"'"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1
  fi
}

TOOL="$(extract tool_name)"
SUBAGENT="$(extract subagent_type)"
FILE_PATH="$(extract tool_input.file_path)"
[ -z "$FILE_PATH" ] && FILE_PATH="$(extract tool_input.path)"
URL="$(extract tool_input.url)"
CMD="$(extract tool_input.command)"
DESC="$(extract tool_input.description)"
PROMPT_TOOL="$(extract tool_input.prompt)"   # Task tool's prompt
PROMPT_USER="$(extract prompt)"               # UserPromptSubmit top-level prompt
PATTERN="$(extract tool_input.pattern)"
TASK_AGENT="$(extract tool_input.subagent_type)"
SESSION="$(extract session_id)"

# ---------- target + goal selection ----------
TARGET=""
GOAL=""
[ -n "$FILE_PATH" ] && TARGET="$FILE_PATH"
[ -z "$TARGET" ] && [ -n "$URL" ]     && TARGET="$URL"
[ -z "$TARGET" ] && [ -n "$CMD" ]     && TARGET="$(printf '%s' "$CMD" | head -c 200)"
[ -z "$TARGET" ] && [ -n "$PATTERN" ] && TARGET="$PATTERN"
[ -z "$TARGET" ] && [ -n "$DESC" ]    && TARGET="$DESC"
[ -z "$TARGET" ] && [ -n "$PROMPT_TOOL" ]  && TARGET="$(printf '%s' "$PROMPT_TOOL" | head -c 200)"

AGENT="main"
[ -n "$SUBAGENT" ] && AGENT="$SUBAGENT"

# ---------- timestamp (BSD date has no %N) ----------
if command -v python3 >/dev/null 2>&1; then
  TS="$(python3 -c 'import datetime; print(datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="milliseconds").replace("+00:00","Z"))')"
else
  TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
fi

# ---------- json-safe escape (always via python3) ----------
escape() {
  if command -v python3 >/dev/null 2>&1; then
    python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$1"
  else
    printf '"%s"' "$(printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')"
  fi
}

append_line() {
  printf '%s\n' "$1" >> "$LOG" 2>/dev/null || true
}

# ---------- snapshot tasks.json on TodoWrite ----------
# TodoWrite carries the full todos array — capture it so the Kanban board has
# up-to-date task state without any additional polling mechanism.
if [ "$EVENT" = "pre-tool-use" ] && [ "$TOOL" = "TodoWrite" ]; then
  TASKS_FILE="$LOG_DIR/tasks.json"
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$PAYLOAD" | jq -c '.tool_input.todos // []' > "$TASKS_FILE" 2>/dev/null || true
  elif command -v python3 >/dev/null 2>&1; then
    printf '%s' "$PAYLOAD" | python3 -c "
import sys, json, io
raw = sys.stdin.read()
try:
    d = json.loads(raw) if raw else {}
    todos = (d.get('tool_input') or {}).get('todos') or []
    with io.open('$TASKS_FILE', 'w') as f: json.dump(todos, f)
except Exception: pass
" 2>/dev/null || true
  fi
fi

# Also listen for TaskCreate / TaskUpdate (MCP task tools that some setups use)
if [ "$EVENT" = "pre-tool-use" ] && { [ "$TOOL" = "TaskCreate" ] || [ "$TOOL" = "TaskUpdate" ]; }; then
  # Append a task-change marker so the Kanban knows to re-check task files.
  TS_TASK="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf '{"ts":"%s","event":"task-change","tool":"%s"}\n' "$TS_TASK" "$TOOL" >> "$LOG_DIR/activity.jsonl" 2>/dev/null || true
fi

# ---------- emit the primary event ----------
TS_JSON="\"$TS\""
EVENT_JSON="$(escape "$EVENT")"
AGENT_JSON="$(escape "$AGENT")"
TOOL_JSON="$(escape "${TOOL:-}")"
TARGET_JSON="$(escape "$TARGET")"
SESSION_JSON="$(escape "${SESSION:-}")"

LINE="{\"ts\":$TS_JSON,\"event\":$EVENT_JSON,\"agent\":$AGENT_JSON,\"tool\":$TOOL_JSON,\"target\":$TARGET_JSON,\"session\":$SESSION_JSON"

# UserPromptSubmit: include the prompt as the goal so the Agents pane can show
# "main"'s current goal.
if [ "$EVENT" = "user-prompt" ] && [ -n "$PROMPT_USER" ]; then
  PROMPT_SHORT="$(printf '%s' "$PROMPT_USER" | head -c 400)"
  GOAL_JSON="$(escape "$PROMPT_SHORT")"
  LINE="$LINE,\"goal\":$GOAL_JSON"
  # If there was no target derived from tool input (there usually isn't for a
  # raw user prompt), fall back to a short slug for the activity feed.
  if [ -z "$TARGET" ]; then
    NEW_TARGET="$(printf '%s' "$PROMPT_USER" | head -c 80)"
    LINE="$(printf '%s' "$LINE" | sed 's/"target":""/"target":'"$(escape "$NEW_TARGET")"'/')"
  fi
fi

LINE="$LINE}"
append_line "$LINE"

# ---------- emit a synthetic "spawn" event when the Task tool was invoked ----------
# Pre-tool-use with tool=Task means the main agent is spinning up a subagent.
# Capture its goal so the Agents pane can label that subagent.
if [ "$EVENT" = "pre-tool-use" ] && [ "$TOOL" = "Task" ] && [ -n "$TASK_AGENT" ]; then
  SPAWN_GOAL_RAW="$PROMPT_TOOL"
  [ -z "$SPAWN_GOAL_RAW" ] && SPAWN_GOAL_RAW="$DESC"
  SPAWN_GOAL="$(printf '%s' "$SPAWN_GOAL_RAW" | head -c 400)"
  SPAWN_AGENT_JSON="$(escape "$TASK_AGENT")"
  SPAWN_GOAL_JSON="$(escape "$SPAWN_GOAL")"
  SPAWN_DESC_JSON="$(escape "${DESC:-}")"
  SPAWN_LINE="{\"ts\":$TS_JSON,\"event\":\"spawn\",\"agent\":$SPAWN_AGENT_JSON,\"spawned_by\":$AGENT_JSON,\"tool\":\"Task\",\"target\":$SPAWN_DESC_JSON,\"goal\":$SPAWN_GOAL_JSON,\"session\":$SESSION_JSON}"
  append_line "$SPAWN_LINE"
fi

# ---------- truncate occasionally ----------
if [ $((RANDOM % 40)) -eq 0 ]; then
  tail -n 500 "$LOG" > "$LOG.tmp" 2>/dev/null && mv "$LOG.tmp" "$LOG" 2>/dev/null || true
fi

exit 0
