# RTK — Rust Token Killer

Bash commands are rewritten to `rtk <cmd>` automatically by the `PreToolUse` hook
`~/.claude/hooks/rtk-rewrite.sh`. Do not prefix commands with `rtk` yourself.

Call `rtk` directly only for its own subcommands, which the hook does not produce:

```bash
rtk gain              # token savings
rtk gain --history    # per-command history
rtk discover          # missed opportunities in Claude Code history
rtk proxy <cmd>       # bypass filtering when debugging
```

Name collision: if `rtk gain` fails, the installed binary is reachingforthejack/rtk
(Rust Type Kit), not this one.
