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
