# Types location

- All `type`/`interface` declarations live in `types/**/*.d.ts`. Never inline `export type ...` in a util, hook, store, or worker file.
- Files in `types/` are declaration files (`.d.ts`) — they contain no runtime code. Runtime helpers (factories, validators) live under `lib/`.
- Group types by responsibility, matching the constants split. Example: `types/playback.d.ts` carries every playback-related shape (EasingMode, KeyframeBundle, PlaybackState, AdvanceInput). `types/stores.d.ts` carries every store shape.
- Component-internal prop types may stay co-located in `.tsx` if and only if they are not exported. Any exported component prop type goes to `types/components.d.ts`.
- Do not introduce redundant aliases. Bad: `export type ProjectState = Project;`. Use `Project` directly.
- `types/index.d.ts` is the one barrel allowed in the repo.
