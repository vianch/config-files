---
paths:
  - "app/lib/supabase/**/*.ts"
  - "proxy.ts"
---

# Supabase Rules

- Browser client (`client.ts`): singleton, used for all client-side DB calls and auth
- Server client (`server.ts`): only used in proxy (formerly middleware) for auth checks — handles cookie sync
- All DB queries go in `queries.ts` — do not scatter Supabase calls across components
- Always get userId via `getUserIdBySession()` before querying user-scoped data
- The `snippet` table uses `user_id` scoping and soft-delete via `state: "inactive"`
- Env vars: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
