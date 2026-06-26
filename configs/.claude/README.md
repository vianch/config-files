# Claude Code configuration

Canonical copies of my [Claude Code](https://claude.com/claude-code) setup. Two scopes:

| Folder | Mirrors | Drop it into | Holds |
|--------|---------|--------------|-------|
| [`user/`](user) | `~/.claude` | your home dir | Global settings, instructions, agents, commands, hooks, statusline — applies to every project. |
| [`project/`](project) | `<repo>/.claude` | a project root | Project-scoped rules, skills, agents, and memory (these target the **Snippets** Next.js app). |

## `user/` — global config

- `settings.json` — model, permissions, hooks, enabled plugins, theme, prefs.
- `CLAUDE.md`, `AGENTS.md` — both just `@RTK.md` (import the RTK reference).
- `RTK.md` — [RTK (Rust Token Killer)](https://github.com) proxy command reference.
- `agents/`, `commands/` — global subagents and slash commands.
- `hooks/` — shell hooks wired up in `settings.json` (RTK rewrite, activity log, workflow-docs).
- `statusline.sh` — custom status line.

## `project/` — project config

`rules/`, `skills/`, `agents/`, `memory/`, `settings.local.json` — see the root [`CLAUDE.md`](../../CLAUDE.md) for what each rule and skill does.

## Deliberately NOT copied here

These live in `~/.claude` but are **excluded** — they are secrets, machine state, or large managed installs, not portable config:

| Excluded | Why |
|----------|-----|
| `.credentials.json` | OAuth tokens / secrets. |
| `projects/`, `history.jsonl`, `todos/`, `shell-snapshots/`, `sessions/` | Conversation transcripts and prompt/session state. |
| `skills/` (~1.1 GB), `plugins/` | Third-party marketplace installs — restore via `enabledPlugins` / `extraKnownMarketplaces` in `settings.json`, not by vendoring. |
| `cache/`, `*-cache/`, `backups/`, `*.log`, `stats-cache.json`, `daily-cost.json` | Runtime caches, logs, and telemetry. |

### Restoring on a new machine

```bash
cp -R configs/.claude/user/. ~/.claude/        # global config
# project config already lives in each repo's own .claude/
```

Plugins reinstall themselves from the marketplaces declared in `settings.json` on first run.
