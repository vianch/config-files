#!/usr/bin/env bash
# workflow-server-toggle.sh
# Kill switch for the whole Claude Agents Visualizer automatic experience:
# the local HTTP server AND the Chrome tab that pops on every session/prompt.
#
# The toggle is just a JSON flag in ~/.claude/workflow-docs/config.json:
#
#   { "serverEnabled": false }
#
# Two hooks read that flag and no-op when it is false:
#   - workflow-docs-server.sh  → does not spawn python -m http.server
#   - open-workflow-docs.sh    → does not regenerate index.html or open Chrome
#
# Disabling also tears down any currently running server so the change is
# immediate. Enabling re-spawns the server.
#
# Usage: workflow-server-toggle.sh enable|disable|toggle|status

set -u

DOCS_DIR="${CLAUDE_WORKFLOW_DOCS_DIR:-$HOME/.claude/workflow-docs}"
CONFIG_FILE="$DOCS_DIR/config.json"
PID_FILE="$DOCS_DIR/.server.pid"
PORT_FILE="$DOCS_DIR/.server.port"

mkdir -p "$DOCS_DIR" 2>/dev/null || {
  echo "error: cannot create $DOCS_DIR" >&2
  exit 1
}

read_enabled() {
  # Default is enabled (true) when config is missing or unset.
  if [ ! -f "$CONFIG_FILE" ]; then
    echo "true"
    return
  fi
  if grep -qE '"serverEnabled"[[:space:]]*:[[:space:]]*false' "$CONFIG_FILE" 2>/dev/null; then
    echo "false"
  else
    echo "true"
  fi
}

write_enabled() {
  local val="$1"
  if command -v python3 >/dev/null 2>&1; then
    python3 - "$CONFIG_FILE" "$val" <<'PY'
import json, os, sys
path, val = sys.argv[1], sys.argv[2] == "true"
data = {}
if os.path.exists(path):
    try:
        with open(path) as f:
            data = json.load(f) or {}
    except Exception:
        data = {}
data["serverEnabled"] = val
with open(path, "w") as f:
    json.dump(data, f, indent=2)
    f.write("\n")
PY
  else
    # Fallback: rewrite a minimal file. Loses any unrelated keys, so warn.
    if [ -f "$CONFIG_FILE" ] && [ -s "$CONFIG_FILE" ]; then
      echo "warning: python3 not found; rewriting $CONFIG_FILE without preserving other keys" >&2
    fi
    printf '{\n  "serverEnabled": %s\n}\n' "$val" > "$CONFIG_FILE"
  fi
}

stop_server() {
  if [ -f "$PID_FILE" ]; then
    local pid
    pid="$(cat "$PID_FILE" 2>/dev/null || true)"
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      echo "stopped server (pid $pid)"
    fi
    rm -f "$PID_FILE" "$PORT_FILE" 2>/dev/null
  fi
}

start_server() {
  bash "$HOME/.claude/hooks/workflow-docs-server.sh"
}

show_status() {
  local enabled
  enabled="$(read_enabled)"
  echo "config:   $CONFIG_FILE"
  echo "enabled:  $enabled"
  if [ -f "$PID_FILE" ]; then
    local pid port
    pid="$(cat "$PID_FILE" 2>/dev/null || true)"
    port="$(cat "$PORT_FILE" 2>/dev/null || echo "?")"
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      echo "running:  pid $pid on port $port (http://127.0.0.1:$port/)"
    else
      echo "running:  no (stale pid file)"
    fi
  else
    echo "running:  no"
  fi
}

case "${1:-status}" in
  enable|on)
    write_enabled true
    start_server
    echo "workflow-docs server enabled."
    show_status
    ;;
  disable|off)
    write_enabled false
    stop_server
    echo "workflow-docs server disabled."
    show_status
    ;;
  toggle)
    if [ "$(read_enabled)" = "true" ]; then
      exec "$0" disable
    else
      exec "$0" enable
    fi
    ;;
  status|"")
    show_status
    ;;
  *)
    echo "usage: $(basename "$0") enable|disable|toggle|status" >&2
    exit 2
    ;;
esac
