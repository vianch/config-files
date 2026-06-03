---
name: project_overview
description: Core architecture and patterns for the Snippets code snippet manager app
type: project
---

Snippets is a personal code snippet manager at snippets.vianch.com. Next.js 14 App Router + TypeScript + Supabase + Zustand + CodeMirror. Deployed on Vercel. Package manager is yarn.

**Why:** Victor's personal project for saving/organizing code snippets. Part of his goal to ship one personal project per month.

**How to apply:** When making changes, respect the existing patterns — client-side state in `app/snippets/page.tsx`, Supabase queries centralized in `app/lib/supabase/queries.ts`, Zustand stores for cross-component state, global `.d.ts` types in `types/`.

## Key Architecture Decisions

- All snippet CRUD state lives in `app/snippets/page.tsx` (client component), passed down via props
- No server-side data fetching beyond auth middleware — all DB calls happen client-side via Supabase browser client
- Global TypeScript types (`Snippet`, `UUID`, `SnippetState`, `CurrentSnippet`, `TagItem`) are declared in `types/*.d.ts` — no imports needed
- Components follow one-component-per-directory pattern (e.g., `CodeEditor/CodeEditor.tsx`)
- ESLint enforces strict padding/blank-line rules between blocks — pay attention to whitespace
- `no-console` is an error — never use `console.log`
