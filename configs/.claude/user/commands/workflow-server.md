---
name: workflow-server
description: Kill switch for the Claude Agents Visualizer auto-open. Enable / disable / toggle / status — flips ~/.claude/workflow-docs/config.json's serverEnabled flag, which gates both workflow-docs-server.sh (HTTP server) and open-workflow-docs.sh (Chrome tab).
argument-hint: ["enable | disable | toggle | status"]
allowed-tools: ["Bash"]
---

# /workflow-server

Kill switch for the whole automatic Claude Agents Visualizer experience.

Two hooks fire on every Claude Code session:

- `~/.claude/hooks/workflow-docs-server.sh` brings up a `python3 -m http.server`
  on `http://127.0.0.1:47318/` serving `~/.claude/workflow-docs/`, so the
  diagram can poll `activity.jsonl` / `flows.json` in real time.
- `~/.claude/hooks/open-workflow-docs.sh` regenerates `index.html` and opens
  a Chrome tab to it.

This command flips a single flag — `serverEnabled` in
`~/.claude/workflow-docs/config.json` — that **both** hooks read before doing
any work. When disabled, neither the server starts nor the Chrome tab opens,
and a currently-running server is taken down so the change is immediate.

## Usage

```
/workflow-server                    # status (default)
/workflow-server status
/workflow-server enable             # turn the server on now and on every session
/workflow-server disable            # turn it off now and skip it on every session
/workflow-server toggle             # flip whichever state is current
```

## What to do

Run exactly one Bash command depending on `$ARGUMENTS`:

- If `$ARGUMENTS` is empty or `status`, run:
  ```bash
  bash $HOME/.claude/hooks/workflow-server-toggle.sh status
  ```
- If `$ARGUMENTS` is `enable` / `on`, run:
  ```bash
  bash $HOME/.claude/hooks/workflow-server-toggle.sh enable
  ```
- If `$ARGUMENTS` is `disable` / `off`, run:
  ```bash
  bash $HOME/.claude/hooks/workflow-server-toggle.sh disable
  ```
- If `$ARGUMENTS` is `toggle`, run:
  ```bash
  bash $HOME/.claude/hooks/workflow-server-toggle.sh toggle
  ```
- Otherwise print:
  ```
  usage: /workflow-server enable | disable | toggle | status
  ```

After running, print the script's stdout verbatim so the user sees the new
state (config path, enabled flag, and running pid/port). Do **not** start a
follow-up tool call to "verify" — the script already prints status as part of
every action.

## Notes

- The flag lives at `~/.claude/workflow-docs/config.json`. Hand-editing it
  works too — the hooks only check for `"serverEnabled": false` (anything
  else counts as enabled, which keeps the default behaviour
  backwards-compatible).
- When disabled, you can still open the renderer manually:
  `open "file://$HOME/.claude/workflow-docs/projects/<slug>/index.html"` — it
  just loses the live activity / flows / agents polling.
- This does **not** disable `bootstrap-flows.sh` (the architecture-summary
  injection that gives Claude background context). That's a separate hook —
  delete the script or remove the entry from `~/.claude/settings.json` if you
  want it off too.
