# Verification

Before committing, run:

```bash
pnpm run lint:fix
pnpm run format
pnpm run typecheck
pnpm test
pnpm build
```

The `pre-commit` husky hook runs `lint-staged` → `pnpm typecheck` → `pnpm build`.
The `pre-push` husky hook runs `pnpm audit` (blocks on high+ severity in production deps).

Never bypass hooks (`--no-verify`) unless explicitly authorized by the maintainer.
