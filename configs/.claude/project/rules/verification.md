# Verification

Before committing, run:

```bash
yarn lint:fix
yarn format
yarn typecheck
yarn test
yarn build
```

The `pre-commit` husky hook runs `lint-staged` → `yarn typecheck` → `yarn build`.
The `pre-push` husky hook runs `yarn audit` (blocks on high+ severity in production deps).

Never bypass hooks (`--no-verify`) unless explicitly authorized by the maintainer.
