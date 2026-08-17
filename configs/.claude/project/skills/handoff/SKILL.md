---
name: handoff
description: Compact the current conversation into a handoff document for another agent to pick up. Stored under ~/.claude/handoff-documents/ and named per project so a future session can locate it by project context.
argument-hint: "What will the next session be used for?"
allowed-tools:
  - Bash
  - Read
  - Write
  - Glob
  - Grep
---

# /handoff — Conversation Handoff Document

Write a handoff document summarising the current conversation so a fresh agent can continue the work. Save it to `~/.claude/handoff-documents/` so it survives across projects and sessions, and name it after the current project so future Claude sessions can locate it by inspecting that folder.

## Step 1 — Identify the current project

Run this bash block to derive a stable, filesystem-safe project slug from the current working directory. Prefer the git repo name when available; fall back to the basename of `$PWD`.

```bash
HANDOFF_DIR="$HOME/.claude/handoff-documents"
mkdir -p "$HANDOFF_DIR"

# Prefer git repo name; fall back to cwd basename.
if RAW_PROJECT=$(git rev-parse --show-toplevel 2>/dev/null); then
  RAW_PROJECT=$(basename "$RAW_PROJECT")
else
  RAW_PROJECT=$(basename "$PWD")
fi

# Sanitize: lowercase, collapse whitespace to hyphens, allowlist [a-z0-9.-], cap length.
PROJECT_SLUG=$(printf '%s' "$RAW_PROJECT" \
  | tr '[:upper:]' '[:lower:]' \
  | tr -s ' \t' '-' \
  | tr -cd 'a-z0-9.-' \
  | cut -c1-60)
PROJECT_SLUG="${PROJECT_SLUG:-unknown-project}"

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
HANDOFF_FILE="$HANDOFF_DIR/${PROJECT_SLUG}-${TIMESTAMP}.md"

# Collision guard for same-second double-saves.
if [ -e "$HANDOFF_FILE" ]; then
  SUFFIX=$(LC_ALL=C tr -dc 'a-z0-9' < /dev/urandom 2>/dev/null | head -c 4 || printf '%04x' "$$")
  HANDOFF_FILE="$HANDOFF_DIR/${PROJECT_SLUG}-${TIMESTAMP}-${SUFFIX}.md"
fi

# Surface variables the LLM will use to write the file.
echo "HANDOFF_DIR=$HANDOFF_DIR"
echo "PROJECT_SLUG=$PROJECT_SLUG"
echo "TIMESTAMP=$TIMESTAMP"
echo "HANDOFF_FILE=$HANDOFF_FILE"
echo "BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'not-a-git-repo')"
echo "CWD=$PWD"
```

Use the exact `HANDOFF_FILE` path emitted above when writing in Step 3 — do not rebuild it in the LLM layer.

## Step 2 — Compose the summary

Synthesize the handoff from the current conversation. Be concrete and tight.

Rules:
- **Reference, don't duplicate.** If a PRD, plan, ADR, issue, commit, diff, or design doc already captures something, link to it by path or URL instead of restating it.
- **Redact sensitive material.** Strip API keys, passwords, tokens, secrets, and any personally identifiable information from anything you quote or paraphrase.
- **Tailor to the next session.** If the user passed arguments after `/handoff`, treat them as a description of what the next session will focus on, and shape the doc around that focus.
- **No filler.** Skip sections that have nothing meaningful to say rather than padding them.

## Step 3 — Write the handoff document

Write to `HANDOFF_FILE` using this structure:

```markdown
---
project: {PROJECT_SLUG}
cwd: {absolute path to current working dir}
branch: {current git branch or "not-a-git-repo"}
timestamp: {ISO-8601, e.g. 2026-05-21T14:30:00-07:00}
next_session_focus: {verbatim user argument, or "unspecified"}
---

# Handoff — {short title inferred from the work or the user argument}

## Context for the next agent

{1-3 sentences: what this work is, where it sits, what stage it's in. Name the project, branch, and the user's stated focus for the next session.}

## What has been done

{Bulleted list of concrete progress this session. Each bullet is one finished thing, named specifically (file:line, command run, decision made). Do not list things still in flight.}

## Decisions made (and why)

{Bullets of architectural / scope / tradeoff decisions taken this session, each with a one-line rationale. Skip the section if no real decisions were made.}

## Open questions / unresolved

{Things the next agent must decide or confirm before proceeding. Empty section is fine — omit it if truly nothing is open.}

## Next steps

{Numbered list in priority order. Each step is a concrete action with enough specificity that a fresh agent can act on it without re-deriving context — file paths, commands, acceptance criteria.}

## References (do not duplicate)

{Links to PRDs, plans, ADRs, GitHub issues/PRs, commits, design docs, or files that already hold the detail. Use absolute paths or URLs.}

## Suggested skills

{Bulleted list of skills the next agent should invoke, with a one-line reason each. Pick from what is actually available in this environment. Examples (only include the ones that fit):
- `/context-restore` — if a prior `/context-save` exists for this branch
- `/investigate` — if the next session needs root-cause debugging
- `/plan-eng-review` — if an architecture plan exists and needs locking in
- `/review` — if a diff is ready for pre-landing review
- `/ship` — if the change is ready to land and PR
- `/qa` or `/qa-only` — if the next session is verifying behavior in a running app
Skip the section entirely if no skill clearly applies.}

## Gotchas / things tried that did not work

{Anything that would save the next agent 10+ minutes — dead ends, surprising behavior, flaky commands, env quirks. Omit if none.}
```

## Step 4 — Confirm to the user

Print a short confirmation block (not prose narration):

```
HANDOFF SAVED
══════════════════════════════════════════
Project:  {PROJECT_SLUG}
Branch:   {branch}
File:     {HANDOFF_FILE}
Focus:    {next_session_focus or "unspecified"}
══════════════════════════════════════════

Future Claude sessions in this project can find prior handoffs by listing
~/.claude/handoff-documents/ and filtering on the project slug.
```

## How a future session locates this handoff

When a future Claude session needs to resume work in the same project, it can run:

```bash
HANDOFF_DIR="$HOME/.claude/handoff-documents"
if RAW_PROJECT=$(git rev-parse --show-toplevel 2>/dev/null); then
  RAW_PROJECT=$(basename "$RAW_PROJECT")
else
  RAW_PROJECT=$(basename "$PWD")
fi
PROJECT_SLUG=$(printf '%s' "$RAW_PROJECT" | tr '[:upper:]' '[:lower:]' | tr -s ' \t' '-' | tr -cd 'a-z0-9.-' | cut -c1-60)
ls -1t "$HANDOFF_DIR"/"${PROJECT_SLUG}"-*.md 2>/dev/null | head -5
```

The newest matching file is the most recent handoff for this project. Read it before starting work.

## Rules

- **Never modify code.** This skill only writes the handoff document.
- **Never overwrite.** Each invocation creates a new timestamped file. The collision suffix in Step 1 guarantees this even on same-second double-saves.
- **Never write outside `~/.claude/handoff-documents/`.** Do not put the handoff in the project's workspace, the OS temp dir, or anywhere else.
- **Redact secrets.** If you are about to write a value that looks like an API key, token, password, email, or other PII, replace it with `[REDACTED]` and note the type of value redacted.
- **Infer, don't interrogate.** Use the conversation, git state, and any argument the user passed. Only ask the user a question if the next-session focus is genuinely ambiguous and you have no signal at all.
