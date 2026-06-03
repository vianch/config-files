# File naming

- Components: `PascalCase.tsx`
- Utilities under `lib/utils/`: `camelCase.utils.ts` (e.g. `arrays.utils.ts`, `id.utils.ts`)
- Constants under `lib/constants/`: `camelCase.constants.ts` (e.g. `playback.constants.ts`)
- Hooks: `useThing.ts` (camelCase)
- Stores: `useThingStore.ts` (camelCase)
- Type declarations: `camelCase.d.ts` (declarations only — no runtime code)
- Tests: `*.test.ts` / `*.test.tsx`
- Workers: `*.worker.ts` (under `workers/`)
- Locale namespaces: `public/locales/{language}/{namespace}.json`
