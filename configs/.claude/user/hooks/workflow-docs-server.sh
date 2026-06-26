#!/usr/bin/env bash
# workflow-docs-server.sh
# Idempotently ensure a local HTTP server is serving ~/.claude/workflow-docs/
# so the browser can poll activity.jsonl in real time. Exits silently on any
# error — the visualiser falls back to file:// when no server is up.

set -u

PORT="${WORKFLOW_DOCS_PORT:-47318}"
DOCS_DIR="${CLAUDE_WORKFLOW_DOCS_DIR:-$HOME/.claude/workflow-docs}"
PID_FILE="$DOCS_DIR/.server.pid"
PORT_FILE="$DOCS_DIR/.server.port"
LOG_FILE="$DOCS_DIR/.server.log"
CONFIG_FILE="$DOCS_DIR/config.json"

mkdir -p "$DOCS_DIR" 2>/dev/null || exit 0

# Config-driven kill switch. Mirrors the Understand-Anything autoUpdate pattern:
# the hook itself reads a project-local config and no-ops when explicitly
# disabled. Toggle with `/workflow-server disable` (or edit config.json).
if [ -f "$CONFIG_FILE" ]; then
  if grep -qE '"serverEnabled"[[:space:]]*:[[:space:]]*false' "$CONFIG_FILE" 2>/dev/null; then
    # If a server was previously left running, take it down so the toggle is
    # immediate rather than only kicking in next session.
    if [ -f "$PID_FILE" ]; then
      OLD_PID="$(cat "$PID_FILE" 2>/dev/null || true)"
      if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
        kill "$OLD_PID" 2>/dev/null || true
      fi
      rm -f "$PID_FILE" "$PORT_FILE" 2>/dev/null
    fi
    exit 0
  fi
fi

# Already running? Check PID file first, then port.
if [ -f "$PID_FILE" ]; then
  PID="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
    # Process exists — assume it's ours.
    echo "$PORT" > "$PORT_FILE" 2>/dev/null || true
    exit 0
  fi
fi

# PID file stale — check the port too. If something else owns it, give up.
if command -v lsof >/dev/null 2>&1; then
  if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    # Port busy and we don't own it. Don't fight — fall back to file://.
    rm -f "$PID_FILE" "$PORT_FILE" 2>/dev/null
    exit 0
  fi
fi

if ! command -v python3 >/dev/null 2>&1; then
  exit 0
fi

# Spawn a detached server (parent process group so it survives the hook exit).
nohup python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$DOCS_DIR" \
  >"$LOG_FILE" 2>&1 &
NEW_PID=$!
disown "$NEW_PID" 2>/dev/null || true

echo "$NEW_PID" > "$PID_FILE" 2>/dev/null || true
echo "$PORT" > "$PORT_FILE" 2>/dev/null || true

exit 0
