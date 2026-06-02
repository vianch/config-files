# TypeScript

- `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`. Never relax these.
- Never use `any`. Use `unknown` with type guards, or generics.
- Always arrow functions. Never `function` declarations.
- Organize all properties alphabetically (objects, type fields, enum members, imports).
- Type assertions (`as X`) must carry a one-line comment explaining why.
- Branded types for IDs and indices (see `types/branded.d.ts`). Never use raw `string`/`number` for these outside their factory.
