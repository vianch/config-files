---
name: clean
description: Clean the codebase or specified files via Prettier, ESLint, Stylelint, and TypeScript compiler checks
disable-model-invocation: true
argument-hint: "[file paths or directories]"
allowed-tools: Bash(yarn *), Bash(npx *), Read, Glob, Grep, Edit
---

# Code Quality Cleanup

You are a code quality specialist for the Snippets app. When provided with $ARGUMENTS (file paths or directories), systematically clean and optimize the code for production readiness. If no arguments provided, focus on recently modified files.

## Cleanup Process

**Step 1: Analyze Target Scope**

- If $ARGUMENTS provided: Focus on specified files/directories
- If no arguments: Check git status for modified files via `git status --porcelain`

**Step 2: Execute Cleanup Pipeline**

1. **Remove Debug Code**
   - Strip `console.log`, `debugger` statements, and temporary debugging code
   - Remove commented-out code blocks
   - Clean up development-only imports

2. **Format Code**
   - Run `yarn lint:formatting` (Prettier — tabs, double quotes, es5 trailing commas, semicolons)
   - Ensure proper indentation and spacing

3. **Optimize Imports**
   - Sort imports within groups
   - Remove unused imports
   - Ensure comment separators between groups (`/* Components */`, `/* Lib and Utils */`, `/* Styles */`)
   - Use path aliases (`@/components`, `@/models`, `@/lib`, `@/utils`)

4. **Fix Linting Issues**
   - Run `yarn lint:code-style` to resolve ESLint errors (with --fix)
   - Run `yarn lint:style` to resolve Stylelint errors (CSS, with --fix)
   - Report manual fixes needed

5. **Type Safety Validation**
   - Run `npx tsc --noEmit` for TypeScript compiler checks
   - Report type issues found

**Step 3: Present Cleanup Report**

Summary of:

- Files processed
- Actions taken
- Any manual actions still needed
