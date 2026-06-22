# Pre-Landing Review Checklist

## Instructions

Review the `git diff origin/main` output for the issues listed below. Be specific — cite `file:line` and suggest fixes. Skip anything that's fine. Only flag real problems.

**Two-pass review:**

- **Pass 1 (CRITICAL):** Run critical checks first. These block shipping.
- **Pass 2 (INFORMATIONAL):** Run all remaining categories. Non-blocking but included in PR body.

**Output format:**

```
Pre-Landing Review: N issues (X critical, Y informational)

**CRITICAL** (blocking):
- [file:line] Problem description
  Fix: suggested fix

**Issues** (non-blocking):
- [file:line] Problem description
  Fix: suggested fix
```

If no issues found: `Pre-Landing Review: No issues found.`

Be terse. For each issue: one line describing the problem, one line with the fix.

---

## Review Categories

### Pass 1 — CRITICAL

#### Data Safety & Auth

- Supabase queries missing `getUserIdBySession()` — user-scoped data must always verify auth
- Missing error handling on Supabase operations (`.error` not checked after query)
- Hardcoded secrets, API keys, or Supabase credentials in code
- Missing RLS considerations for new tables/queries
- XSS vectors in snippet content rendering (especially CodeMirror output or `dangerouslySetInnerHTML`)

#### Race Conditions & State

- Stale Zustand state after async operations (reading store value before async write completes)
- Concurrent snippet CRUD operations without proper optimistic update handling
- Check-then-write patterns without deduplication (e.g., creating duplicate snippets)

### Pass 2 — INFORMATIONAL

#### React & Performance

- Unnecessary re-renders from Zustand store subscriptions (subscribing to entire store vs. selectors)
- Missing `useMemo`/`useCallback` for expensive operations passed as props
- CodeMirror editor recreated unnecessarily (check dependency arrays)
- N+1 Supabase queries (multiple queries in a loop that could be a single `.in()` query)
- Components missing `"use client"` directive when using hooks/browser APIs

#### TypeScript & Code Quality

- `any` type usage anywhere
- Global types from `types/*.d.ts` redeclared locally instead of used directly
- Missing path aliases (`@/components`, `@/lib`, `@/utils`) — using relative paths instead
- Import groups missing comment separators (`/* Components */`, `/* Lib and Utils */`, `/* Styles */`)
- `console.log` statements (`no-console` is an error)
- Blank line enforcement violations between blocks, returns, control flow

#### Dead Code & Consistency

- Variables assigned but never read
- Commented-out code blocks
- Unused imports
- Stale comments that describe old behavior

#### Component Patterns

- Components not following one-per-directory pattern
- Missing `ReactElement` return type annotation
- Snippet CRUD logic leaking into child components (should stay in `app/snippets/page.tsx`)
- Supabase queries outside `app/lib/supabase/queries.ts`

---

## Gate Classification

```
CRITICAL (blocks /ship):              INFORMATIONAL (in PR body):
├─ Data Safety & Auth                 ├─ React & Performance
└─ Race Conditions & State            ├─ TypeScript & Code Quality
                                      ├─ Dead Code & Consistency
                                      └─ Component Patterns
```

---

## Suppressions — DO NOT flag these

- Style preferences already handled by Prettier/ESLint (formatting, spacing, quote style)
- "Add a comment explaining why" — comments rot, code should be self-documenting
- Suggesting consistency-only changes with no functional impact
- ANYTHING already addressed in the diff you're reviewing
