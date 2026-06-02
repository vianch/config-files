# Import organization

Order each file's imports as follows, with a blank line between groups:

1. **External libraries** — React first, then alphabetical by package name.
2. **Local imports from `@/lib/...`** — alphabetical by source within the group.
3. **Local imports from `@/components/...`** — alphabetical by source within the group.
4. **Local imports from `@/stores/...`** — alphabetical by source within the group.
5. **Type-only imports from `@/types/...`** — single block at the bottom, alphabetical.
6. **Styles.**

Type imports always use `import type`. Never mix `import` and `import type` for the same module — split into two statements.

For files in `@/lib/...` themselves (utilities, constants, exporters), the `@/components` and `@/stores` groups don't apply; types still come last.

No barrels (`index.ts`) outside `types/index.d.ts`. Import directly from the leaf file.
