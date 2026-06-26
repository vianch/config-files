#!/usr/bin/env bash
# bootstrap-flows.sh
# SessionStart hook for the workflow-visualizer. Has two branches:
#
# 1. First session in a new project (no flows.json anywhere on the priority
#    chain): create $HOME/.claude/workflow-docs/projects/<slug>/flows.json
#    seeded from the bundled example + a .needs-generation marker, then emit
#    a SessionStart context message asking the main agent to populate it.
#
# 2. Subsequent sessions: resolve the project's flows.json and emit a short
#    summary (app, columns, components, flows) as SessionStart context. Lets
#    Claude reason about the project's architecture from turn 0 without
#    re-reading the file.
#
# All output goes to stdout as a single JSON object that Claude Code injects
# into the session via hookSpecificOutput.additionalContext.

set -u

TRIGGER="${1:-session-start}"
[ "$TRIGGER" = "session-start" ] || exit 0

# Skip degenerate cwds (avoid spamming context for $HOME / ~/.claude itself).
if [ "$PWD" = "$HOME" ] || [ "$PWD" = "$HOME/.claude" ] || [ "${#PWD}" -lt 5 ]; then
  exit 0
fi

# ---------- slug ----------
PROJECT_BASENAME="$(basename "$PWD" | tr -c 'a-zA-Z0-9._-' '-' | sed 's/--*/-/g' | sed 's/^-//;s/-$//')"
[ -z "$PROJECT_BASENAME" ] && PROJECT_BASENAME="project"
CWD_HASH_SHORT="$(printf '%s' "$PWD" | shasum 2>/dev/null | awk '{print substr($1, 1, 8)}')"
[ -z "$CWD_HASH_SHORT" ] && CWD_HASH_SHORT="$(printf '%s' "$PWD" | md5sum 2>/dev/null | awk '{print substr($1, 1, 8)}')"
[ -z "$CWD_HASH_SHORT" ] && CWD_HASH_SHORT="$(printf '%s' "$PWD" | md5 2>/dev/null | cut -c1-8)"
[ -z "$CWD_HASH_SHORT" ] && CWD_HASH_SHORT="default"
PROJECT_SLUG="${PROJECT_BASENAME}-${CWD_HASH_SHORT}"

DOCS_DIR="$HOME/.claude/workflow-docs"
PROJECT_DIR="$DOCS_DIR/projects/$PROJECT_SLUG"
PROJECT_FLOWS="$PROJECT_DIR/flows.json"
PROJECT_META="$PROJECT_DIR/.meta"
PROJECT_NEEDS_GEN="$PROJECT_DIR/.needs-generation"
EXAMPLE_FLOWS="$HOME/.claude/skills/workflow-visualizer/example-flows.json"

# Back-compat: prefer an old hash-keyed dir if it already exists.
CWD_HASH_FULL="$(printf '%s' "$PWD" | shasum 2>/dev/null | awk '{print $1}')"
[ -z "$CWD_HASH_FULL" ] && CWD_HASH_FULL="$(printf '%s' "$PWD" | md5sum 2>/dev/null | awk '{print $1}')"
LEGACY_DIR="$DOCS_DIR/projects/$CWD_HASH_FULL"
if [ -d "$LEGACY_DIR" ] && [ ! -d "$PROJECT_DIR" ]; then
  PROJECT_DIR="$LEGACY_DIR"
  PROJECT_FLOWS="$PROJECT_DIR/flows.json"
  PROJECT_META="$PROJECT_DIR/.meta"
  PROJECT_NEEDS_GEN="$PROJECT_DIR/.needs-generation"
fi

# ---------- resolve existing flows.json ----------
FLOWS_SRC=""
for c in "$PWD/flows.json" "$PWD/.claude/flows.json" "$PWD/docs/flows.json" "$PROJECT_FLOWS"; do
  if [ -f "$c" ]; then
    FLOWS_SRC="$c"
    break
  fi
done

# ---------- summariser (python3) ----------
emit_summary_context() {
  local path="$1"
  python3 - "$path" "$PROJECT_SLUG" "$PWD" <<'PY' 2>/dev/null
import sys, json, io
path, slug, cwd = sys.argv[1], sys.argv[2], sys.argv[3]
try:
    with io.open(path, 'r', encoding='utf-8') as f:
        d = json.load(f)
except Exception:
    sys.exit(1)

MAX_COMPONENTS = 50
MAX_FLOWS      = 20

lines = []
app = d.get('app') or {}
lines.append(f"🗂️ workflow-visualizer — architecture context for this project ({cwd})")
lines.append(f"flows.json source: {path}")
lines.append(f"Live view: http://127.0.0.1:47318/projects/{slug}/index.html")
lines.append("")

if app.get('name'):
    title = f"App: {app['name']}"
    if app.get('description'):
        title += f" — {app['description']}"
    lines.append(title)

cols = d.get('columns') or []
if cols:
    spine = " → ".join((c.get('label') or c.get('id') or '?') for c in cols)
    lines.append(f"Lanes: {spine}")

cats = d.get('categories') or []
if cats:
    swatches = ", ".join((c.get('label') or c.get('id') or '?') for c in cats)
    lines.append(f"Categories: {swatches}")

components = d.get('components') or d.get('packages') or []
flows      = d.get('flows') or []

lines.append("")
lines.append(f"Components ({len(components)}):")
for c in components[:MAX_COMPONENTS]:
    name = c.get('name') or c.get('label') or c.get('id') or '?'
    col  = c.get('column') or c.get('group') or '?'
    cat  = c.get('category') or c.get('type') or ''
    sub  = c.get('subtitle') or c.get('caption') or c.get('description') or ''
    row  = f"  • {name} [{col}"
    if cat and cat != col:
        row += f" / {cat}"
    row += "]"
    if sub:
        row += f" — {sub}"
    lines.append(row)
if len(components) > MAX_COMPONENTS:
    lines.append(f"  … ({len(components) - MAX_COMPONENTS} more — see flows.json)")

lines.append("")
lines.append(f"Flows ({len(flows)}):")
for f in flows[:MAX_FLOWS]:
    name = f.get('name') or f.get('id') or '?'
    desc = f.get('description') or ''
    steps = f.get('steps') or []
    row = f"  • {name} ({len(steps)} steps)"
    if desc:
        row += f" — {desc}"
    lines.append(row)
if len(flows) > MAX_FLOWS:
    lines.append(f"  … ({len(flows) - MAX_FLOWS} more — see flows.json)")

lines.append("")
lines.append("Use this as background when answering architecture / data-flow questions. To edit, invoke the workflow-doc-generator subagent.")

ctx = "\n".join(lines)
print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "SessionStart",
        "additionalContext": ctx
    }
}, ensure_ascii=False))
PY
}

# ---------- branch 1: existing project — emit architecture summary ----------
if [ -n "$FLOWS_SRC" ]; then
  if command -v python3 >/dev/null 2>&1; then
    emit_summary_context "$FLOWS_SRC" || true
  fi
  exit 0
fi

# ---------- branch 2: first session — bootstrap + nudge ----------
mkdir -p "$PROJECT_DIR" 2>/dev/null || exit 0

if [ ! -f "$PROJECT_FLOWS" ] && [ -f "$EXAMPLE_FLOWS" ]; then
  cp "$EXAMPLE_FLOWS" "$PROJECT_FLOWS" 2>/dev/null || true
  printf '{"created_at":"%s","cwd":"%s"}\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$PWD" > "$PROJECT_META" 2>/dev/null || true
  touch "$PROJECT_NEEDS_GEN" 2>/dev/null || true

  cat <<EOF
{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"📋 workflow-visualizer: first session in $PWD — created a starter flows.json at $PROJECT_FLOWS (under ~/.claude, NOT in the repo). It is seeded with the bundled example as a placeholder.\n\nPlease invoke the **workflow-doc-generator** subagent now to inventory this codebase and replace the placeholder with the real architecture (categories, columns, components, flows). When the subagent finishes writing $PROJECT_FLOWS, delete the marker $PROJECT_NEEDS_GEN so future sessions don't re-nudge."}}
EOF
fi

exit 0
