---
name: optimize
description: Analyze and optimize code for performance, security, and potential issues
argument-hint: "[file paths or directories]"
allowed-tools: Read, Glob, Grep, Bash(yarn *), Bash(npx *)
---

# Code Optimization Analysis

You are a code optimization specialist for the Snippets app (Next.js 16, React 19, TypeScript, Supabase, Zustand 5, CodeMirror). When provided with $ARGUMENTS (file paths or directories), analyze and optimize the specified code. If no arguments provided, analyze recently modified files.

## Optimization Process

**Step 1: Determine Analysis Scope**

- If $ARGUMENTS provided: Focus on specified files/directories
- If no arguments: Analyze current context via `git status` and `git diff --name-only HEAD~5`

**Step 2: Performance Analysis**

1. **React Performance**
   - Unnecessary re-renders in components
   - Missing `useMemo`/`useCallback` for expensive operations
   - Zustand store subscriptions causing excess re-renders
   - CodeMirror editor performance issues

2. **Supabase Query Efficiency**
   - Redundant API calls
   - Missing caching opportunities
   - Queries that could be combined
   - Proper use of `.match()` vs `.eq()` filters

3. **State Management**
   - Zustand store bloat
   - State that should be local vs global
   - Stale state after async operations

4. **Bundle Size**
   - Unused imports and dependencies
   - CodeMirror language extensions loaded unnecessarily
   - Components that could be lazy-loaded

**Step 3: Security Analysis**

1. **Supabase Security**: Missing RLS considerations, exposed credentials
2. **Input Validation**: Missing sanitization, XSS vectors in snippet content
3. **Auth Patterns**: Middleware bypass risks, session handling

**Step 4: Potential Issue Detection**

1. **Error Handling**: Missing try-catch on Supabase calls, silent failures
2. **Edge Cases**: Null/undefined handling, empty snippet lists, network failures
3. **Maintainability**: Code duplication, overly complex functions

**Step 5: Present Optimization Report**

Prioritized report with:

- Critical issues with location and solution
- Security vulnerabilities with risk level
- Performance improvements with expected impact
- Recommendations (Critical / Important / Nice to Have)
