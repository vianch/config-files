# Prompt Enhancer — Example Workflow

This example shows how to use the Snippets project skills end-to-end, from planning through shipping. Each skill activates a different cognitive mode — use them in sequence for maximum rigor.

---

## Scenario: Add tag-based snippet filtering with keyboard shortcuts

```
You:   [enter plan mode]
       I want users to filter snippets by tag using keyboard shortcuts.
       Press a number key (1-9) to toggle the corresponding tag filter.
       The snippet list should update instantly.

You:   /plan-review

Claude: "Keyboard shortcut filtering" is not the full feature. The real job
        is making tag navigation feel instant and effortless. Here's what the
        10-star version looks like:

        MINIMAL: Number keys 1-9 toggle tag filters in the sidebar
        BALANCED: Number keys + visual indicator of active filters + Cmd+K
                  quick-filter palette
        AMBITIOUS: Full keyboard-driven navigation — number keys for tags,
                   j/k for snippet list, Enter to open, Esc to clear filters,
                   with a floating shortcut hint bar

        Which direction?

You:   Let's go with BALANCED

Claude: ## Technical Plan

        ### Architecture
        - New `useKeyboardShortcuts` hook in `app/lib/hooks/`
        - Extend `menu.store` with `activeTagFilters: Set<string>`
        - Filter logic in `app/snippets/page.tsx` (where snippet state lives)
        - Quick-filter palette as new `FilterPalette/FilterPalette.tsx` component

        ### Implementation Sequence
        1. Add `activeTagFilters` to menu store (depends on: nothing)
        2. Create `useKeyboardShortcuts` hook (depends on: nothing)
        3. Wire filter logic into page.tsx (depends on: 1)
        4. Add visual filter indicators to Aside (depends on: 1)
        5. Build FilterPalette component (depends on: 1, 2)

        ### Edge Cases
        - User has more than 9 tags → number keys map to first 9, palette for rest
        - No tags exist → shortcuts are no-ops, no error
        - CodeMirror focused → keyboard shortcuts must not fire while typing code

        ### NOT in Scope
        - Persistent filter state across sessions (future enhancement)
        - Custom shortcut key mapping

You:   [exit plan mode, implement the plan]

       ... (implementation happens here) ...

You:   /review

Claude: Pre-Landing Review: 2 issues (1 critical, 1 informational)

        **CRITICAL** (blocking):
        - app/lib/hooks/useKeyboardShortcuts.ts:24 — Keyboard listener not
          checking if CodeMirror has focus. Users typing code will trigger
          tag filters on number keys.
          Fix: Add `if (document.activeElement?.closest('.cm-editor')) return;`

        **Issues** (non-blocking):
        - app/snippets/page.tsx:142 — Filter runs on every keystroke even when
          no tags match. Minor perf issue with large snippet lists.
          Fix: Early return when `activeTagFilters.size === 0`

You:   (fix both issues)

You:   /review

Claude: Pre-Landing Review: No issues found.

You:   /test

Claude: ## Validation Pipeline
        - TypeScript type check: PASSED
        - ESLint: PASSED
        - Stylelint: PASSED
        - Prettier: PASSED
        - Build: PASSED
        All checks completed successfully.

You:   /commit

Claude: Proposed: feat(snippets): add keyboard shortcut tag filtering with
        quick-filter palette

        Proceed? (y/n)

You:   y

Claude: [committed abc1234, pushed to origin]

You:   /pr

Claude: Created: https://github.com/vianch/snippets/pull/42
```

---

## Skill Sequence Reference

| Step | Skill | Mode | Purpose |
|------|-------|------|---------|
| 1 | `/plan-review` | Product + Engineering | Challenge the feature, lock the technical plan |
| 2 | (implement) | — | Write the code |
| 3 | `/review` | Paranoid reviewer | Find bugs that pass CI but break in prod |
| 4 | `/test` | Validation pipeline | Type check, lint, build |
| 5 | `/commit` | Release engineer | Conventional commit with validation |
| 6 | `/pr` | Release engineer | Push and open pull request |
| 7 | `/retro` | Engineering manager | Weekly retrospective from git data |

### Other useful skills at any point

| Skill | When to use |
|-------|------------|
| `/optimize` | Analyze performance, security, and potential issues |
| `/clean` | Run Prettier, ESLint, Stylelint cleanup |
| `/create-ticket` | Create GitHub issues for follow-up work |
| `/project-context` | Understand codebase structure and current state |
