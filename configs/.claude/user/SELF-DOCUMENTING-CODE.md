# Self-Documenting Code — Global Rule

Applies to every project, every language, every session. No exceptions unless I
say so in that session.

## 1. Do not write code comments

Code explains itself through naming. If a comment feels necessary, the name is
wrong — rename instead of annotating.

Never emit: explanatory comments, section banners, step-by-step narration
(`// 1. validate`), restated signatures, TODO/FIXME/NOTE/HACK, docblocks
(JSDoc/TSDoc/docstrings/XML docs) added just to describe params — except in util
files, see §4.4 — commented-out code, or "why" prose that belongs in a commit
message or PR description.

When removing my existing comments is not requested, leave them alone — this
rule governs code you write or edit.

## 2. Names carry the meaning

Every one of these must be named so its purpose is readable without context:
constants, variables, functions, methods, classes, interfaces, types, generics,
factories, services, hooks, env variables, models, objects, object keys, enums
and enum members, primitives, components, props, lambdas / arrow functions,
callbacks, promises, test names, file names, and branches of a conditional.

Rules of thumb:
- Booleans read as predicates — mandatory for constants and for anything a
  conditional tests: `isExpired`, `hasSeatInventory`, `canRefund`.
- **Props are exempt.** A boolean prop may be a bare adjective or state word
  when that reads better or matches the platform / library convention:
  `disabled`, `loading`, `required`, `fullWidth`, `dismissible`. Don't force
  `isDisabled` on a prop just to satisfy the predicate rule. The moment that
  prop is destructured into a local used in a condition, the predicate rule
  applies again to the local or to the extracted named condition.
- Functions are verb phrases; the name states the effect and the return.
- No abbreviations, no single letters (except a mathematical index), no `data`,
  `info`, `temp`, `res`, `obj`, `val`, `helper`, `utils`, `handleStuff`, `flag`.
- Units and currency in the name: `timeoutMs`, `priceInCents`, `maxRetries`.
- Collections are plural; a map says both sides: `ordersByCustomerId`.
- Env vars are screaming snake case and name the resource and role:
  `STRIPE_WEBHOOK_SIGNING_SECRET`, not `SECRET`.
- Extract an intermediate named variable instead of a comment explaining an
  expression.

## 3. Conditionals must read as sentences

No bare literals, magic numbers, or raw string comparisons in a condition.
Extract a named constant or a named predicate that says why, not what.

```ts
const MAX_CHECKOUT_ATTEMPTS = 3
const isCheckoutLockedOut = attemptCount >= MAX_CHECKOUT_ATTEMPTS

if (isCheckoutLockedOut) return lockoutResponse
```

```ts
if (attemptCount >= 3) return { error: 'locked' }
```

Same for enums over string unions typed inline, and for guard clauses — an
early return named by its reason beats a nested branch with a comment.

## 4. Comments allowed only here

1. **Imports** — grouping or ordering labels for import blocks.
2. **Thrown errors inside `try`/`catch`** — when the reason a specific error is
   caught, rethrown, or swallowed is not derivable from the code (external
   contract, known upstream bug, retry semantics).
3. **Special API response models** — when an external payload's shape or a
   provider quirk cannot be expressed in the type itself (undocumented field,
   inconsistent nullability, legacy alias).
4. **Util functions in util files** — files named `*.utils.ts` / `*.utils.js` /
   `*.util.ts`, or living in a `utils/` folder, and the equivalent in other
   languages. Exported helpers there get a JSDoc block. Keep it tight:

   - One short sentence describing the function. No restating the signature.
   - One line per param and per return — nothing more.
   - No `@example`, no `@remarks`, no multi-paragraph prose, no `@author`,
     no type annotations duplicating TypeScript.

   ```ts
   /**
    * Rounds a money amount to the currency's smallest unit.
    * @param amountInCents - value to round
    * @param currencyCode - ISO 4217 code deciding the unit size
    * @returns rounded amount in cents
    */
   export function roundToCurrencyUnit(amountInCents: number, currencyCode: string): number
   ```

   Internal, non-exported helpers in a util file stay bare — the name is enough.

Nothing else qualifies. Not "this is tricky", not "performance", not
"temporary".

## 5. Never disable a linter with a comment

Forbidden in every language, no matter how convenient:

`// eslint-disable*`, `// @ts-ignore`, `// @ts-expect-error`, `// tslint:disable`,
`# noqa`, `# type: ignore`, `# pylint: disable`, `# ruff: noqa`,
`# mypy: ignore-errors`, `# rubocop:disable`, `// nolint`, `//go:nolint`,
`@SuppressWarnings`, `@Suppress`, `#pragma warning disable`,
`// swiftlint:disable`, `// ktlint-disable`, `-- luacheck: ignore`,
`<!-- prettier-ignore -->`, `/* stylelint-disable */`, `// NOSONAR`,
`#[allow(...)]`, `// phpcs:ignore`, `// @codingStandardsIgnoreLine`,
`// deno-lint-ignore`.

Fix the code the rule is pointing at. If the rule itself is genuinely wrong for
the project, change the lint configuration file and tell me — never silence it
at the call site.

## 6. Precedence

This rule outranks every other instruction that asks for a comment, including
marker comments from modes I have enabled. Specifically: **no `ponytail:`
comments** — ponytail's simplification markers lose to this rule, always.
Ponytail still governs *what* gets built; it never authorizes a comment.

Convey the intent through a name (`globalLockLimitsThroughput`,
`naiveLinearScanOverSmallSet`), or say it to me in chat instead.
