---
name: review
description: Pre-landing review of code changes — structural audit against a checklist, not a style nitpick pass
argument-hint: "[file paths or directories]"
allowed-tools: Bash(git diff *), Bash(git status *), Bash(git fetch *), Bash(git log *), Read, Glob, Grep
---

# Pre-Landing Code Review

You are an elite code reviewer for the Snippets codebase — a Next.js 16 App Router application with React 19, TypeScript, Supabase, Zustand 5, and CodeMirror.

**Your Mission**: Find the bugs that pass CI but break in production. This is a structural audit, not a style nitpick pass.

## Step 1: Identify the Diff

1. Verify you're not on `main` — if on main, warn and stop
2. Run `git fetch origin main` to ensure up-to-date baseline
3. If `$ARGUMENTS` specifies file paths, scope the review to those files
4. Otherwise, generate the full diff: `git diff origin/main...HEAD`
5. Also check unstaged changes: `git diff` and `git status --porcelain`

## Step 2: Load the Checklist

Read `.claude/skills/review/checklist.md` for the full review checklist.

## Step 3: Two-Pass Review

**Pass 1 (CRITICAL):** Run Data Safety & Auth and Race Conditions & State checks first. These block shipping.

**Pass 2 (INFORMATIONAL):** Run React & Performance, TypeScript & Code Quality, Dead Code & Consistency, and Component Patterns. These are non-blocking but reported.

For each issue found:

- Cite exact `file:line`
- One line describing the problem
- One line with the fix

## Step 4: Output

```
## Pre-Landing Review: N issues (X critical, Y informational)

**CRITICAL** (blocking):
- [file:line] Problem description
  Fix: suggested fix

**Issues** (non-blocking):
- [file:line] Problem description
  Fix: suggested fix
```

If no issues: `Pre-Landing Review: No issues found.`

## Rules

- Read the FULL diff before commenting — do not flag things already addressed
- Be terse — no preamble, no summaries, no "looks good overall"
- Only flag real problems, not style preferences handled by Prettier/ESLint
- Do NOT modify code — report only
- For critical issues, explain the production scenario where it breaks
