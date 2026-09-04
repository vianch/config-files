# Agentic Coding Guidelines for this Repository

## Project Architecture Context

This repository is part of the ToDesktop workflow-visualizer project. Use this context for architecture and data-flow questions. The source flow definition is at `/Users/vianch/.claude/workflow-docs/projects/config-files-00899149/flows.json`; the live view is available at `http://127.0.0.1:47318/projects/config-files-00899149/index.html`.

The system is organized into these lanes: `ACTORS` → `CLIENT SURFACES` → `AUTH + FIREBASE FUNCTIONS` → `STORAGE / DATA` → `BUILD PIPELINE` → `DISTRIBUTION` → `EXTERNAL SERVICES`.

Key components include the ToDesktop end user, user Electron repository, Builder app, admin and invitee browsers, `@todesktop/cli`, Builder template, web-app frontend, website-combined, Firebase Auth, Firebase Functions for auth/builds/billing/infrastructure/api/analysis, Firestore, Firebase Storage, AWS S3, Cloudflare R2, Azure Pipelines, desktopify-runner, `@todesktop/desktopify`, CDN and API workers, Cloudflare API, Azure Key Vault, Apple notarization, Windows code-signing CA, Postmark, Stripe API, and the npm registry.

Documented flows are: `todesktop build` (Electron CLI), `todesktop release` (publish as latest), installed app auto-update check, inviting a new organization user, and the Stripe billing webhook.

When modifying workflow documentation or its generated visualization, invoke the workflow-doc-generator subagent.

This repository is primarily for configuration files, but the following guidelines apply to any code or scripts developed within this context.

## 1. Build, Lint, and Test Commands

- **Install Dependencies:** `yarn install`
- **Run All Tests:** `yarn test`
- **Run a Single Test:** `yarn test <path_to_test_file>` (e.g., `yarn test src/utils/my-util.test.ts`)
- **Lint Code:** `eslint .`
- **Format Code:** `prettier --write .`
- **Build Project:** `yarn build`

## 2. Code Style Guidelines

### General Principles
- Write clean, simple, readable, and reliable code.
- Implement features in the simplest possible way.
- Keep files small and focused (ideally <200 lines).

### Formatting
- Follow Prettier rules as defined in `.prettierrc` (e.g., `tabWidth: 2`, `useTabs: true`, `printWidth: 80`, `semi: true`, `singleQuote: false`, `trailingComma: es5`, `arrowParens: always`).

### Linting
- Adhere to ESLint rules, including `prettier/prettier: error` and `@typescript-eslint/no-unused-vars: error`.

### TypeScript Usage
- Use TypeScript for all code.
- Prefer interfaces over types (use types for components).
- Avoid enums; use `const` maps instead.
- Implement proper type safety and inference, using the `satisfies` operator for validation.
- Place types necessary in multiple files in the `types` folder within a `.d.ts` file.
- Avoid creating types and interfaces in `utils`, `services`, or `constant` files.

### Naming Conventions
- Use descriptive names with auxiliary verbs (e.g., `isLoading`, `hasError`).
- Prefix event handlers with "handle" (e.g., `handleClick`, `handleSubmit`).
- Use lowercase with dashes for directories (e.g., `components/auth-wizard`).
- Favor named exports for components.

### Error Handling
- Implement comprehensive error handling.

### React Specific (if applicable)
- All functions, including components, should be arrow functions with `FC` declaration and `ReactElement` return type.
- Favor React Server Components (RSC) where possible; minimize `use client` directives.
- Implement proper error boundaries and use Suspense for async operations.

### Path Aliases
- Use configured path aliases (e.g., `@/components/*`, `@/models/*`, `@/services/*`, `@/lib/*`, `@/utils/*`).
