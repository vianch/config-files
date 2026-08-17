---
name: review-code-locally
description: Review recently written or modified code changes to ensure they meet project quality standards before committing. Use when code has been written or modified and needs validation against CLAUDE.md conventions.
argument-hint: "[file paths or directories]"
allowed-tools: Bash(git diff *), Bash(git status *), Read, Glob, Grep
---

# Code Review

Two-pass code review for the TodayTix Portal. Pass 1 catches critical issues that must be fixed. Pass 2 catches quality issues that should be fixed.

## Step 1: Identify changed files

1. If `$ARGUMENTS` specifies file paths or directories, review only those
2. Otherwise, run `git diff --name-only HEAD` and `git status --porcelain` to identify modified files
3. Focus exclusively on changed files — do not review the entire codebase

## Step 2: Read the checklist

Read the following checklist it defines every check for both passes.

# Review Checklist

Two-pass review checklist for the TodayTix Portal codebase.

## Gate Classification

```
CRITICAL (blocks merge):              INFORMATIONAL (in PR body):
├─ Data Safety & Auth                 ├─ React & Performance
└─ Race Conditions & State            ├─ TypeScript & Code Quality
                                      ├─ Dead Code & Consistency
                                      └─ Component Patterns
```

## Pass 1: Critical Issues (must fix — blocks merge)

### Type Safety
- [ ] No `any` usage — use `unknown` with type guards or generics
- [ ] Array/object access checked for `undefined` (`noUncheckedIndexedAccess` is enabled)
- [ ] Optional properties handled correctly (`exactOptionalPropertyTypes` is enabled)
- [ ] All functions have explicit return types
- [ ] Types reused from `/types` folder — no duplicate definitions

### Data Safety & Auth
- [ ] No hardcoded secrets, API keys, tokens, or credentials
- [ ] User input is validated and sanitized before use
- [ ] No XSS vectors (dangerouslySetInnerHTML, unescaped user content)
- [ ] No sensitive data logged or exposed in error messages
- [ ] Environment variables accessed through proper config patterns
- [ ] Auth checks present on protected routes and API calls

### Race Conditions & State
- [ ] No race conditions in async operations (stale closures, concurrent state updates)
- [ ] useEffect cleanup where needed (event listeners, subscriptions, timers, abort controllers)
- [ ] No hooks called conditionally or inside loops
- [ ] Keys on list items are stable and unique (not array index unless static list)
- [ ] Server/client component boundary is correct — no server-only imports in client components
- [ ] `"use client"` directive present only when needed (hooks, event handlers, browser APIs)

### Error Handling
- [ ] API calls wrapped in try/catch or error boundaries
- [ ] Error states handled in UI (not just happy path)
- [ ] Async operations handle rejection
- [ ] No silent failures (swallowed errors without logging)

### Dead Code
- [ ] No unused imports
- [ ] No unreachable code after early returns
- [ ] No commented-out code blocks
- [ ] No unused variables or function parameters

## Pass 2: Quality Issues (should fix — reported in PR body)

### React & Performance
- [ ] No unnecessary re-renders (check for new object/array creation in render)
- [ ] `React.memo`, `useMemo`, `useCallback` used only when justified
- [ ] Large lists use virtualization if applicable
- [ ] Images use Next.js `Image` component
- [ ] No blocking operations on the main thread
- [ ] Data fetched at the right level (server components fetch, client components receive props)

### TypeScript & Code Quality
- [ ] Arrow functions only — no function declarations
- [ ] `React.ReactElement` return type on components
- [ ] Single return statement per component
- [ ] `type` for props (not `interface`) unless extending
- [ ] `const enum` with PascalCase — not `enum`
- [ ] All properties organized alphabetically (objects, types, enums)
- [ ] Import order: External -> Types -> Utils -> Components -> Styles
- [ ] Alphabetical ordering within each import group
- [ ] Blank lines between import groups
- [ ] Path aliases used: `@/components`, `@/lib`, `@/types`, `@/ui`
- [ ] Curly braces on all conditionals and loops
- [ ] JSDoc comments on utility functions

### Dead Code & Consistency
- [ ] No barrel exports pulling in unnecessary code
- [ ] Naming follows convention: kebab-case dirs, PascalCase components, camelCase utils
- [ ] Type files use `.d.ts` extension in `/types`
- [ ] Test fixtures in `/lib/fixtures/` with `.fixture.ts` suffix
- [ ] Blank lines preserved for readability
- [ ] CSS variables used for theming

### Component Patterns
- [ ] Components are focused (single responsibility)
- [ ] Complex logic extracted into custom hooks in `lib/hooks/`
- [ ] Component composition preferred over deep prop drilling
- [ ] Mobile-first responsive design with Tailwind utilities
- [ ] Semantic HTML elements used (not div soup)
- [ ] ARIA attributes on interactive elements
- [ ] Tailwind CSS utilities used over custom CSS

### Testing
- [ ] New utility functions in `lib/` have corresponding tests in `__tests__/`
- [ ] Test files use `.test.ts(x)` extension
- [ ] Tests cover edge cases (empty, null, error states)
- [ ] Mocks are properly isolated — tests don't depend on external state


## Step 3: Pass 1 — Critical issues

Review each changed file against the **Pass 1** section of the checklist:
- Type safety violations
- Security concerns
- React/Next.js correctness issues
- Missing error handling
- Dead code

**Stop here if critical issues are found.** Report them immediately — these must be fixed before continuing.

## Step 4: Pass 2 — Quality issues

If Pass 1 is clean, review against the **Pass 2** section:
- Portal convention violations
- Component architecture concerns
- Performance issues
- Missing tests
- Naming/file structure issues

## Step 5: Deliver review

```
## Code Review

**Assessment**: [APPROVED | NEEDS CHANGES | CRITICAL ISSUES]
**Files Reviewed**: {count} ({list})

### Pass 1: Critical Issues
{issues found, or "None - all critical checks pass"}

### Pass 2: Quality Issues
{issues found, or "None - all quality checks pass"}

### Strengths
- {positive aspects observed}

### Action Items
1. {specific fix with file:line reference}
2. {ordered by severity}
```

## Severity Guide

| Level | Meaning | Action |
|-------|---------|--------|
| **Critical** | Bugs, security, type errors | Must fix before merge |
| **Important** | Convention violations, missing tests | Should fix before merge |
| **Suggestion** | Style improvements, minor optimizations | Nice to have |

## Principles

- **Two-pass efficiency**: Critical issues first, don't waste time on style if there are bugs
- **Specific references**: Every issue must include `file:line` and a corrected code snippet
- **Constructive**: Explain why something is an issue, not just that it is
- **Pattern-aware**: When multiple approaches work, favor existing codebase patterns
- **Pragmatic**: Don't flag issues that have zero impact on correctness or readability
