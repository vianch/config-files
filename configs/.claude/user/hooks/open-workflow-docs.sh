#!/usr/bin/env bash
# open-workflow-docs.sh
# Opens (once per session) a Chrome tab pointing to the local workflow docs page.
# Triggered by Claude Code hooks: SessionStart and UserPromptSubmit.
#
# Behaviour:
#   - SessionStart: always opens (or focuses) the tab.
#   - UserPromptSubmit: only opens if the marker file is missing/stale, then
#     touches the marker so subsequent prompts in the same session no-op.
#   - Regenerates index.html from template + flows.json whenever flows.json
#     is newer than index.html (cheap make-style check).
#
# Stdin from the hook is JSON; we ignore it. Always exit 0 to avoid blocking.

set -u

TRIGGER="${1:-user-prompt}"

DOCS_DIR="${CLAUDE_WORKFLOW_DOCS_DIR:-$HOME/.claude/workflow-docs}"
SKILL_DIR="$HOME/.claude/skills/workflow-visualizer"

# Shared kill switch — same flag the workflow-docs-server.sh hook honours.
# When disabled, neither the HTTP server nor the Chrome tab opens. Flip with
# `/workflow-server enable|disable` or hand-edit the config file.
CONFIG_FILE="$DOCS_DIR/config.json"
if [ -f "$CONFIG_FILE" ] && \
   grep -qE '"serverEnabled"[[:space:]]*:[[:space:]]*false' "$CONFIG_FILE" 2>/dev/null; then
  exit 0
fi

# Per-project namespace under ~/.claude (zero pollution in the user's repo).
# Directory key: <sanitized basename>-<8-char hash>. The hash suffix prevents
# basename collisions when two projects share a name in different parent dirs.
PROJ_BASENAME="$(basename "$PWD" | tr -c 'a-zA-Z0-9._-' '-' | sed 's/--*/-/g' | sed 's/^-//;s/-$//')"
[ -z "$PROJ_BASENAME" ] && PROJ_BASENAME="project"
PROJ_HASH_SHORT="$(printf '%s' "$PWD" | shasum 2>/dev/null | awk '{print substr($1, 1, 8)}')"
[ -z "$PROJ_HASH_SHORT" ] && PROJ_HASH_SHORT="$(printf '%s' "$PWD" | md5sum 2>/dev/null | awk '{print substr($1, 1, 8)}')"
[ -z "$PROJ_HASH_SHORT" ] && PROJ_HASH_SHORT="default"
PROJECT_SLUG="${PROJ_BASENAME}-${PROJ_HASH_SHORT}"
PROJECT_FLOWS_JSON="$DOCS_DIR/projects/$PROJECT_SLUG/flows.json"

# Back-compat fallback: old layout used the full 40-char hash directly.
LEGACY_HASH="$(printf '%s' "$PWD" | shasum 2>/dev/null | awk '{print $1}')"
LEGACY_FLOWS_JSON="$DOCS_DIR/projects/$LEGACY_HASH/flows.json"

FLOWS_JSON_CANDIDATES=(
  "$PWD/flows.json"
  "$PWD/.claude/flows.json"
  "$PWD/docs/flows.json"
  "$PROJECT_FLOWS_JSON"
  "$LEGACY_FLOWS_JSON"
  "$HOME/.claude/workflow-docs/flows.json"
)
TEMPLATE_HTML="$SKILL_DIR/template.html"
EXAMPLE_FLOWS="$SKILL_DIR/example-flows.json"

# Per-cwd marker so each project gets its own "opened once" state.
CWD_HASH="$(printf '%s' "$PWD" | shasum 2>/dev/null | awk '{print $1}')"
[ -z "$CWD_HASH" ] && CWD_HASH="$(printf '%s' "$PWD" | md5sum 2>/dev/null | awk '{print $1}')"
[ -z "$CWD_HASH" ] && CWD_HASH="default"
MARKER_DIR="${TMPDIR:-/tmp}"
MARKER="$MARKER_DIR/.claude-workflow-docs.$CWD_HASH"

mkdir -p "$DOCS_DIR" 2>/dev/null || exit 0

# Resolve flows.json: first existing candidate wins. Fall back to example.
FLOWS_SRC=""
for c in "${FLOWS_JSON_CANDIDATES[@]}"; do
  if [ -f "$c" ]; then
    FLOWS_SRC="$c"
    break
  fi
done
if [ -z "$FLOWS_SRC" ] && [ -f "$EXAMPLE_FLOWS" ]; then
  FLOWS_SRC="$EXAMPLE_FLOWS"
fi

# Per-project served layout. Every project gets its own index.html + flows.json
# under projects/<slug>/, so opening Claude Code in different repos no longer
# clobbers each other's browser tabs.
PROJECT_DIR="$DOCS_DIR/projects/$PROJECT_SLUG"
mkdir -p "$PROJECT_DIR" 2>/dev/null || true
OUT_HTML="$PROJECT_DIR/index.html"
OUT_FLOWS="$PROJECT_DIR/flows.json"

# Link (preferred) or copy the resolved flows.json into the project's served
# dir. Skip if the resolved source IS the served file (i.e. the project's own
# flows.json under projects/<slug>/) — no self-symlinking.
if [ -n "$FLOWS_SRC" ] && [ "$FLOWS_SRC" != "$OUT_FLOWS" ]; then
  if [ -L "$OUT_FLOWS" ] || [ -f "$OUT_FLOWS" ]; then
    EXISTING_TARGET="$(readlink "$OUT_FLOWS" 2>/dev/null || true)"
    if [ "$EXISTING_TARGET" != "$FLOWS_SRC" ]; then
      rm -f "$OUT_FLOWS" 2>/dev/null || true
    fi
  fi
  if [ ! -e "$OUT_FLOWS" ]; then
    ln -s "$FLOWS_SRC" "$OUT_FLOWS" 2>/dev/null || cp "$FLOWS_SRC" "$OUT_FLOWS" 2>/dev/null || true
  fi
fi

# Rebuild index.html when template/flows newer or output missing.
NEED_BUILD=0
if [ ! -f "$OUT_HTML" ]; then
  NEED_BUILD=1
elif [ -f "$TEMPLATE_HTML" ] && [ "$TEMPLATE_HTML" -nt "$OUT_HTML" ]; then
  NEED_BUILD=1
elif [ -f "$OUT_FLOWS" ] && [ "$OUT_FLOWS" -nt "$OUT_HTML" ]; then
  NEED_BUILD=1
fi
if [ "$NEED_BUILD" -eq 1 ] && [ -f "$TEMPLATE_HTML" ]; then
  # Inline flows.json into the template's <script type="application/json"
  # id="flows-data"> placeholder so the page works offline from file:// with
  # no CORS issues. Keeps it a single self-contained HTML file.
  if [ -f "$OUT_FLOWS" ] && command -v python3 >/dev/null 2>&1; then
    python3 - "$TEMPLATE_HTML" "$OUT_FLOWS" "$OUT_HTML" <<'PY' 2>/dev/null || cp "$TEMPLATE_HTML" "$OUT_HTML"
import sys, json, io
tpl_p, flows_p, out_p = sys.argv[1], sys.argv[2], sys.argv[3]
with io.open(tpl_p, 'r', encoding='utf-8') as f: tpl = f.read()
with io.open(flows_p, 'r', encoding='utf-8') as f: flows_raw = f.read()
try:
    # Pretty-print so the inline JSON is editable.
    flows_pretty = json.dumps(json.loads(flows_raw), ensure_ascii=False, indent=2)
except Exception:
    flows_pretty = "{}"
if "__FLOWS_JSON__" in tpl:
    out = tpl.replace("__FLOWS_JSON__", flows_pretty, 1)
else:
    # Fallback for older templates: drop a bootstrap script before </head>.
    flows_js = json.dumps(json.loads(flows_raw) if flows_raw else {}, ensure_ascii=True)
    inject = "<script>window.__FLOWS_BOOTSTRAP__ = " + flows_js + ";</script>\n"
    out = tpl.replace("</head>", inject + "</head>", 1) if "</head>" in tpl else inject + tpl
with io.open(out_p, "w", encoding="utf-8") as f: f.write(out)
PY
  else
    cp "$TEMPLATE_HTML" "$OUT_HTML" 2>/dev/null || true
  fi
fi

# Decide whether to actually launch the browser.
SHOULD_OPEN=0
case "$TRIGGER" in
  session-start)
    SHOULD_OPEN=1
    ;;
  user-prompt)
    # Open if marker missing or older than 8 hours.
    if [ ! -f "$MARKER" ]; then
      SHOULD_OPEN=1
    else
      # Cross-platform stale check (mtime older than 8h => 28800s).
      MARKER_AGE=$(( $(date +%s) - $(stat -f %m "$MARKER" 2>/dev/null || stat -c %Y "$MARKER" 2>/dev/null || echo 0) ))
      if [ "$MARKER_AGE" -gt 28800 ]; then
        SHOULD_OPEN=1
      fi
    fi
    ;;
esac

touch "$MARKER" 2>/dev/null || true

if [ "$SHOULD_OPEN" -ne 1 ]; then
  exit 0
fi

# Try to bring up the local HTTP server (idempotent). Lets the page poll the
# live activity stream — falls back to file:// if anything goes wrong.
SERVER_SCRIPT="$HOME/.claude/hooks/workflow-docs-server.sh"
if [ -x "$SERVER_SCRIPT" ]; then
  "$SERVER_SCRIPT" >/dev/null 2>&1 || true
fi

URL="file://$OUT_HTML"
PORT_FILE="$DOCS_DIR/.server.port"
if [ -f "$PORT_FILE" ]; then
  PORT="$(cat "$PORT_FILE" 2>/dev/null || true)"
  if [ -n "$PORT" ]; then
    # Quick sanity check the port is actually listening before we open it.
    if command -v lsof >/dev/null 2>&1 && lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
      URL="http://127.0.0.1:$PORT/projects/$PROJECT_SLUG/index.html"
    fi
  fi
fi

# Open in Chrome (background so it does not steal focus from the terminal).
case "$(uname -s)" in
  Darwin)
    /usr/bin/open -g -a "Google Chrome" "$URL" >/dev/null 2>&1 \
      || /usr/bin/open -g "$URL" >/dev/null 2>&1 \
      || true
    ;;
  Linux)
    if command -v google-chrome >/dev/null 2>&1; then
      (google-chrome "$URL" >/dev/null 2>&1 &) || true
    elif command -v chromium >/dev/null 2>&1; then
      (chromium "$URL" >/dev/null 2>&1 &) || true
    elif command -v xdg-open >/dev/null 2>&1; then
      (xdg-open "$URL" >/dev/null 2>&1 &) || true
    fi
    ;;
  MINGW*|MSYS*|CYGWIN*)
    start chrome "$URL" >/dev/null 2>&1 || start "$URL" >/dev/null 2>&1 || true
    ;;
esac

exit 0
