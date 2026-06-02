# Code style

## Always use braces for conditionals

- Every `if` / `else if` / `else` must use braces, even for single-line bodies.
- Same for `for` / `while` / `do` loops.
- Improves readability and prevents bugs when a second statement is added later.
- Enforced by ESLint: `curly: ["error", "all"]`.

```ts
// Preferred
if (format === ExportFormat.Mp4) {
  return VideoCodec.H264;
}

// Forbidden
if (format === ExportFormat.Mp4) return VideoCodec.H264;
```

Ternary expressions and arrow-function single-expression bodies (`(arg) => expr`) are exempt — they are expressions, not statements.

## No helpers outside the component in a component file

- A component file (`components/**/*.tsx`) may contain:
  - exactly one exported component;
  - any number of internal-only prop types that are not exported (per `types-location.md`);
  - the JSX itself.
- It **must not** contain module-scope helper constants, helper functions, mapping objects, regular expressions, look-up tables, etc.
  Those go to `lib/constants/*.constants.ts`, `lib/utils/*.utils.ts`, or `lib/icons/`.
- The same rule applies to hook files (`use*.ts`) and store files (`stores/*.ts`).

## File-suffix conventions

- Files in `lib/constants/` **must** end in `.constants.ts` (e.g. `playback.constants.ts`).
- Files in `lib/utils/` **must** end in `.utils.ts` (e.g. `arrays.utils.ts`, `id.utils.ts`).
- Test files end in `.test.ts` / `.test.tsx`.
- Worker entrypoints end in `.worker.ts`.
