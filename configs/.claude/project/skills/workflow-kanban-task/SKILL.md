---
name: workflow-kanban-task
description: Manages tasks on the workflow-visualizer Kanban board by reading and writing tasks.json under ~/.claude/workflow-docs/projects/<slug>/. Use only when the user names the Kanban board, the visualizer, or tasks.json — for example "add a task to the kanban board", "move the login task to in dev on the board", "what's on the kanban board". Do not use for the session task list or a project TODO file; those are handled by the built-in task tools. Always use this skill instead of editing tasks.json by hand.
tools: Read, Write, Bash
---

# Workflow Kanban Task Manager

You manage tasks on the live Kanban board rendered by the `workflow-visualizer` template.
The board has three columns: **Planned**, **In Dev**, **Done**.
You are the only thing that writes `tasks.json` — do it carefully and consistently.

## Before writing

`tasks.json` is shared state that the board renders live. Before the first write of a
session, echo the resolved path and the intended change on one line, then proceed.

If the file already exists and the change would **delete or reorder** existing tasks rather
than add one, stop and ask the user to confirm first. Adding a task, or moving one between
columns, needs no confirmation.

---

## Step 1 — Resolve the tasks.json path

Run this at the start of every operation to get the correct per-project path:

```bash
SLUG="$(basename "$PWD" | tr -c 'a-zA-Z0-9._-' '-' | sed 's/--*/-/g' | sed 's/^-//;s/-$//')-$(printf '%s' "$PWD" | shasum 2>/dev/null | awk '{print substr($1,1,8)}')"
TASKS_DIR="$HOME/.claude/workflow-docs/projects/$SLUG"
TASKS_FILE="$TASKS_DIR/tasks.json"
mkdir -p "$TASKS_DIR"
echo "$TASKS_FILE"
```

---

## Step 2 — Read before you write

Always read the current file first. If it doesn't exist, start with an empty array:

```bash
cat "$TASKS_FILE" 2>/dev/null || echo "[]"
```

---

## Task schema

```json
[
  {
    "id":       "t-1",
    "content":  "One clear imperative sentence describing the task",
    "status":   "pending | in_progress | completed",
    "priority": "high | medium | low",
    "owner":    "agent-name or null"
  }
]
```

**Column mapping:**

| `status`      | Kanban column |
|---------------|---------------|
| `pending`     | Planned       |
| `in_progress` | In Dev        |
| `completed`   | Done          |

---

## Operations

### Create a task

Read `tasks.json`, append a new object, write back.

- `id`: use `t-1`, `t-2` … (next integer after the highest existing id suffix), or `t-<epoch-ms>` if the file is empty.
- `content`: imperative, specific, under 80 chars. Write it like a commit message.
- `status`: always `pending` for new tasks unless the user explicitly says "start now".
- `priority`: infer from language if not stated (see inference rules below).
- `owner`: set to your agent name if you are creating the task for yourself; otherwise `null`.

### Move / update status

Read `tasks.json`, find the task (match by `id` or case-insensitive substring of `content`), update `status`, write back. Never touch other fields.

### Complete a task

Same as update status with `"status": "completed"`.

### List tasks

Read `tasks.json` and print a short table grouped by column:

```
Planned (2)
  t-1  [high  ] Implement auth refresh
  t-3  [medium] Add Stripe webhook flow

In Dev (1)
  t-2  [high  ] Generate flows.json for this repo

Done (1)
  t-4  [low   ] Fix typo in README
```

### Remove a task

Read `tasks.json`, filter out the matching item by id or content, write back.

---

## Natural language → operation

| User says | What to do |
|---|---|
| "add a task: X" / "create task for X" / "add X to the board" | Create, `status: pending` |
| "start task X" / "move X to in dev" / "I'm working on X" | Update → `in_progress` |
| "done with X" / "complete X" / "mark X done" / "finish X" | Update → `completed` |
| "remove X" / "delete task X" / "drop X from the board" | Remove |
| "show tasks" / "list kanban" / "what's on the board" / "what tasks do we have" | List |
| "add urgent task: X" / "high priority: X" | Create with `priority: high` |
| "backlog X" / "low priority: X" | Create with `priority: low` |
| "clear done tasks" / "archive completed" | Remove all `completed` items |
| "reset the board" | Write `[]` to tasks.json |

---

## Priority inference (when not stated)

| Keywords in content | Priority |
|---|---|
| "urgent", "asap", "critical", "blocker", "breaking", "hotfix" | `high` |
| "nice to have", "cleanup", "refactor", "minor", "polish", "backlog" | `low` |
| everything else | `medium` |

---

## Writing tasks.json

Use `python3` for safe JSON serialisation to avoid escape issues:

```bash
python3 - "$TASKS_FILE" << 'PY'
import sys, json, io
path = sys.argv[1]
# Build your tasks list here in Python, then:
tasks = []  # replace with your updated list
with io.open(path, 'w', encoding='utf-8') as f:
    json.dump(tasks, f, ensure_ascii=False, indent=2)
PY
```

Or, for simple single-field updates, use `jq`:

```bash
# Move task t-2 to in_progress
jq 'map(if .id == "t-2" then .status = "in_progress" else . end)' "$TASKS_FILE" \
  | sponge "$TASKS_FILE"   # or: > /tmp/t.json && mv /tmp/t.json "$TASKS_FILE"
```

---

## Confirmation format

After every write, print exactly one line:

```
✅ Task "<content>" → <new-column>. Board updates in ~1s.
```

For list operations, print the table only — no preamble.

---

## Rules

- **Always read before writing.** Never overwrite without reading the current state first.
- **Preserve all other tasks.** Only modify the targeted item.
- **One task = one sentence.** If the user gives you a paragraph, split it into multiple tasks.
- **Don't invent tasks.** Only create what the user explicitly asks for.
- **Never modify `flows.json` or `activity.jsonl`** — those belong to other parts of the visualizer.
- If `tasks.json` doesn't exist yet, create it with `[<new_task>]`.
- If the project slug can't be computed (unusual environment), fall back to `~/.claude/workflow-docs/tasks.json` and tell the user.
