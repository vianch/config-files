---
name: test
description: Run the complete validation pipeline including TypeScript checks, linting, styling, and build, then fix any failures
disable-model-invocation: true
allowed-tools: Bash(yarn *), Bash(npx *), Read, Edit, Write, Glob, Grep
---

# Validation Pipeline

Run the complete validation pipeline for the Snippets project, fix any failures, and repeat until everything passes.

## Pipeline Steps

1. **Type Checking**: Run `npx tsc --noEmit` to check for TypeScript errors
2. **Code Linting**: Run `yarn lint:code-style` to check ESLint errors
3. **Style Linting**: Run `yarn lint:style` to check CSS/Stylelint errors
4. **Formatting**: Run `yarn lint:formatting` to check Prettier formatting
5. **Build**: Run `yarn build` to ensure production build succeeds
6. **Report**: Report any failures found
7. **Fix**: Fix any failures encountered
8. **Repeat**: Re-run failed steps until all pass
9. **Success**: Report final success with summary

## Behavior

- Run all checks sequentially
- If any step fails, attempt to fix the issue automatically
- After fixing, re-run the failed step to verify
- Continue the cycle until all steps pass or an issue cannot be auto-fixed
- If an issue requires manual intervention, report it clearly with file locations and suggested fixes
