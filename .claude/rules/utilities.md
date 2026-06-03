---
paths:
  - "app/utils/**/*.ts"
  - "app/lib/constants/**/*.ts"
  - "app/lib/config/**/*.ts"
  - "app/lib/models/**/*.ts"
---

# Utility & Lib Rules

- Utils (`app/utils/`) are **pure functions only** — no side effects, no Supabase calls, no constants, no types, no mappings. If a util needs a constant or mapping, import it from `app/lib/constants/` or `app/lib/config/`
- Constants and static mappings live in `app/lib/constants/` (organized by domain: `core.ts`, `toast.ts`, `form.ts`, `account.ts`, `codeMirror.ts`, `formatter.ts`) or `app/lib/config/` (for enums and config objects like `languages.ts`, `themes.ts`)
- Global types (`Snippet`, `UUID`, `SnippetState`, etc.) are declared in `types/*.d.ts` — never redeclare or import them. Never define types in util files; place them in `types/*.d.ts` or colocate with the constant/config they describe
- Zustand stores live in `app/lib/store/` and use the `use[Name]Store` naming convention
