---
name: supress-github
description: Run a prompt with GitHub and git fully suppressed. Use when invoked as /supress-github {prompt}, or when the user asks to work without touching git, GitHub, or the .github folder.
---

# Suppress GitHub

Do the task in `{prompt}`. GitHub and git are off-limits for the whole turn.

## Forbidden

- Any `git` command — including read-only ones (`status`, `log`, `diff`, `branch`, `show`, `blame`).
- Any `gh` command, GitHub API call, `github.com` fetch, or GitHub MCP tool.
- Commit, push, tag, PR create/update/comment, branch create, merge, rebase.
- Reading, listing, globbing, or grepping `.github/` — workflows, actions, issue templates, CODEOWNERS. Treat the folder as if it does not exist.
- Reading `.git/` internals.

## Allowed

Everything else: read/edit/write project files, run tests, build, search code outside `.github/`, use non-GitHub network tools.

## Rules

1. Never work around the ban by proxy — no `hub`, no `curl` to GitHub, no scripts that shell out to git, no subagent tasked with git work.
2. Never ask permission to run a forbidden command. Just skip it.
3. If the task needs git info (recent changes, blame, branch state), derive it from the files on disk or state the assumption and continue. Do not stop and ask.
4. If the task is impossible without git or GitHub, say so in one line and stop. Do not partially do it.
5. Report edits as file paths only. No "ready to commit", no suggested commit message, no next-step git advice.

Suppression lasts the whole turn and any follow-ups in the same session, until the user says otherwise.
