---
paths:
  - "app/components/**/*.tsx"
---

# Component Rules

- One component per directory: `ComponentName/ComponentName.tsx`
- Use named function exports for page components, default exports for reusable components
- Icons live in `app/components/ui/icons/` as individual `.tsx` files
- UI primitives (Button, Input, Modal, Select, Alert, Badge) live in `app/components/ui/`
- Import order: React → Components → Lib/Utils → Types → Styles (with comment separators like `/* Components */`)
- All components use TypeScript with explicit return types (`: ReactElement`)


## Atomic UI primitives

- All shared, reusable primitives (buttons, inputs, selects, sliders, chips, etc.) live under `components/ui/<Component>/<Component>.tsx`.
- One folder per primitive. The folder may contain helpers (sub-components, hooks) co-located, but the exported primitive sits at `components/ui/<Name>/<Name>.tsx`.
- Never re-implement a primitive inline. If you need a button, import from `components/ui/Button/Button.tsx`. If a needed variant is missing, add it there.
- Variants and sizes are expressed as `const enum` values in `lib/constants/components.ts`, not as freeform strings.

## Components in general

- Arrow functions with explicit `React.ReactElement` return type.
- `type` for props (use `interface` only when extending).
- Component prop types that are exported live in `types/components.d.ts`. Internal-only prop types may stay inside the `.tsx` file.
- Server components by default; add `"use client"` only when needed.

## Single responsibility per file

- One exported component per file. If a file holds `ExportedThing`, the file is named `ExportedThing.tsx`.
- Do **not** declare a second sibling component inside the same file (no helper subviews like `EmptyView`, `LoadedView`, `ListItem`). Each lives in its own file in the same feature folder.
- Trivially small render-only fragments that are _not reused_ anywhere else and exist purely to break up JSX can stay inline as JSX (no separate `const ChildView = () => ...` declaration). If you found yourself naming it, it deserves its own file.
- Hooks (`useX`) and utilities specific to one component live in their own files inside the feature folder, not appended to the component file.

## Folder layout

- `components/ui/` — atomic primitives (Button, Input, Select, Slider, Modal, Tooltip, Toast, …)
- `components/<feature>/` — feature-scoped composites (sheet/SheetUpload, header/Header, sequence/SequenceList, …)
- `components/icon/Icon.tsx` — single icon component, registry inside
