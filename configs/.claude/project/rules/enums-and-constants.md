# Enums and constants

## Enums

- Always `const enum`. Never `enum`.
- PascalCase enum name and PascalCase members.
- Members listed alphabetically.
- One responsibility per file. Group related enums (e.g. all UI-mode enums in `lib/constants/ui.ts`).

## Constants

- All shared constants live in `lib/constants/`. Never in util/hook/store/component files.
- PascalCase for `const` declarations whose value is a literal (primitives, immutable objects, arrays):
  `const ModalTitleId = "modal-title"`, `const NameMaxLength = 50`.
- camelCase only for runtime bindings (hook results, computed values, function locals).
- Never `UPPER_SNAKE_CASE` — rename to PascalCase when touching the file.
- Group constants by responsibility, not type. `lib/constants/playback.ts` holds enums _and_ literal defaults related to playback.

## No hardcoded string/number literals in conditionals

- `if`, ternary, `===`/`!==`, `case`, and any other conditional check must compare against a value imported from `lib/constants/` (a `const enum` member, a PascalCase `const`, or an `as const` value).
- Bad: `if (mode === "dark")`, `case "ping-pong":`, `if (status === 1)`.
- Good: `if (mode === ThemeMode.Dark)`, `case LoopMode.PingPong:`, `if (status === HttpStatus.Ok)`.
- This applies to switch case labels too.
- Type-level string-literal unions in `types/*.d.ts` are fine — this rule is about _runtime_ comparisons.
