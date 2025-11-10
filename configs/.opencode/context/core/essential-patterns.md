This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Next.js 16 application** for mcp

**Tech Stack**: Next.js 16, React 20, TypeScript, Tailwind CSS 4, pnpm, Jest

## Development Commands

### Setup

```bash
pnpm install                     # Install all dependencies
pnpm run init                    # Clean node_modules and fresh install
```

### Development

```bash
pnpm dev                         # Start development server with Turbo
pnpm start                       # Start production server
```

### Building & Testing

```bash
pnpm build                       # Build application for production
pnpm run clean:next              # Clean Next.js cache

pnpm test                        # Run all tests with coverage
pnpm run test:ci                 # Run tests in CI mode

pnpm lint                        # Lint all files
pnpm run lint:fix                # Auto-fix linting issues
pnpm run format                  # Format all files with Prettier
pnpm run format:check            # Check formatting without changes
```

### Git Hooks

```bash
pnpm run pre-commit              # Run lint-staged (triggered by Husky)
```

## Architecture

### Project Structure

```
 /
├── app/                         # Next.js App Router directory
│   ├── globals.css             # Global styles
│   ├── theme.css               # Theme definitions
│   ├── layout.tsx              # Root layout component
│   ├── page.tsx                # Home page
│   └── components/             # App-specific components
│       ├── SplashScreen/       # Feature components
│       └── ui/                 # Reusable UI components
├── lib/                        # Shared utilities and services
│   └── utils/                  # Utility functions
│       ├── config.utils.ts     # Configuration utilities
│       └── __tests__/          # Unit tests
├── types/                      # TypeScript type definitions
│   ├── config.d.ts            # Configuration types
│   ├── index.d.ts             # General types
│   └── layout.d.ts            # Layout-specific types
├── public/                     # Static assets
│   └── images/                 # Image assets
└── coverage/                   # Test coverage reports
```

### Key Patterns

**TypeScript Path Mapping**: Project uses path aliases for clean imports:

- `@/components/*` → `./app/components/*`
- `@/lib/*` → `./lib/*`
- `@/types/*` → `types/*`
- `@/ui/*` → `./app/components/ui/*`

**Import Organization**: Follow strict import order with blank lines between groups:

1. External libraries (React first, then alphabetical)
2. Types (prefixed with `type`)
3. Local utilities and services
4. Components
5. Styles

**Component Guidelines**:

- Use functional components with hooks
- TypeScript for all code with strict typing
- Tailwind CSS for styling
- Keep files focused and maintainable
- Extract complex logic into custom hooks
- Use component composition over prop drilling
- **Single Return**: Components must have only one return statement to improve readability and maintainability

#### Function and Component Standards

- **Function Declaration**: Always use arrow functions instead of function declarations
- **Component Props**: Use `type` for component props, unless extending from another type/interface
- **Type Reusability**: Always check and use existing types from `/types` folder before creating new ones to avoid duplication
- **Return Type**: All React components must include `React.ReactElement` return type
- **Single Return**: All React components must have only one return statement for consistency and readability
- **Props Extending**: Use `interface` only when extending from another type or interface

```typescript
// ✅ Correct - Using existing types from /types folder
import type { LayoutProps } from '@/types/layout';

const NavigationProvider = ({ children }: LayoutProps): React.ReactElement => {
  return <div>{children}</div>;
};

// ✅ Correct - Simple component props when no existing type matches
type MyComponentProps = {
  propName: string;
  isActive: boolean;
}

const MyComponent = ({ propName, isActive }: MyComponentProps): React.ReactElement => {
  return <div>{propName}</div>;
};

// ✅ Correct - Props extending from another type/interface
interface MyComponentProps extends SharedComponent {
  propName: string;
  customProp: number;
}

const MyComponent = ({ propName, sharedProp, customProp }: MyComponentProps): React.ReactElement => {
  return <div>{propName}</div>;
};

// ✅ Correct - Utility functions as arrow functions
const calculateTotal = (items: Item[]): number => {
  return items.reduce((sum, item) => sum + item.price, 0);
};

// ❌ Incorrect - Creating duplicate types when existing ones are available
type NavigationProviderProps = {  // Should use LayoutProps from /types/layout
  children: ReactNode;
}

// ❌ Incorrect - Function declarations
function MyComponent(props: MyComponentProps) {  // Should be arrow function
  return <div>content</div>;
}

function calculateTotal(items: Item[]): number {  // Should be arrow function
  return items.reduce((sum, item) => sum + item.price, 0);
}

// ❌ Incorrect - Missing return type
const MyComponent = ({ propName }: MyComponentProps) => {  // Missing React.ReactElement
  return <div>{propName}</div>;
};

// ❌ Incorrect - Using interface for simple props
interface MyComponentProps {  // Should be type when not extending
  propName: string;
}
```

### State Management

- **URL State**: Modern Next.js patterns for state management
- **Form State**: Use `useActionState` for form handling
- **Local State**: React hooks (`useState`, `useReducer`)

## Configuration Files

### TypeScript Configuration

- **Strict mode enabled** with additional safety features:
  - `noUncheckedIndexedAccess: true`
  - `exactOptionalPropertyTypes: true`
  - `noImplicitReturns: true`
  - `noFallthroughCasesInSwitch: true`
- **Target**: ES2017
- **Module**: ESNext with bundler resolution

### ESLint Configuration

Comprehensive linting setup including:

- TypeScript ESLint
- React and React Hooks rules
- JSX accessibility (jsx-a11y)
- Import organization
- Jest testing rules
- Next.js specific rules
- Prettier integration

### Jest Configuration

- **Test Environment**: Node.js
- **Coverage**: HTML, LCOV, and text reports
- **Test Patterns**: `**/*.(test|spec).(ts|tsx|js)` and `**/lib/**/__tests__/**/*`
- **Coverage Collection**: `lib/**/*.{ts,tsx}` (excluding config, stories, tests)
- **Module Mapping**: Supports path aliases

### Prettier Configuration

- **Print Width**: 80 characters
- **Tab Width**: 2 spaces
- **Semicolons**: Required
- **Quotes**: Single quotes
- **Trailing Commas**: All
- **End of Line**: LF

## Development Guidelines

### File Naming

- **Directories**: kebab-case (`splash-screen/`)
- **Components**: PascalCase (`SplashScreen.tsx`)
- **Utils**: camelCase (`config.utils.ts`)
- **Types**: camelCase with `.d.ts` extension (`layout.d.ts`)
- **Tests**: `.test.ts(x)` or `.spec.ts(x)`
- **Styles**: Global CSS files in app directory

### TypeScript

- Use strict type checking with enhanced safety features
- **Always check `/types` folder first** - Use existing type definitions before creating new ones to avoid duplication
- Prefer `type` over `interface` for component props
- Place shared types in `types/` folder as `.d.ts` files
- Use path aliases for clean imports (e.g., `@/types/layout` for layout types)
- Never use `any` - leverage TypeScript's type system
- Use JSDoc comments for utility functions

#### Alphabetical Organization

- **Object Properties**: All object properties must be organized alphabetically for consistency and maintainability
- **Enum Properties**: All enum values must be organized alphabetically
- **Type/Interface Properties**: All type and interface properties must be organized alphabetically
- **Import Statements**: Within each import group, organize imports alphabetically

```typescript
// ✅ Correct - Alphabetical object properties
const buttonClasses = {
  default: 'bg-primary text-primary-foreground hover:bg-primary/90',
  ghost: 'hover:bg-accent hover:text-accent-foreground',
  outline:
    'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
};

const sizeClasses = {
  default: 'h-10 px-4 py-2',
  lg: 'h-11 px-8',
  sm: 'h-9 px-3',
};

// ✅ Correct - Alphabetical type properties
type ButtonProps = {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  isLoading?: boolean;
  size?: 'default' | 'sm' | 'lg';
  variant?: 'default' | 'outline' | 'ghost';
};

// ✅ Correct - Alphabetical enum properties
const enum UserStatus {
  Active = 'active',
  Inactive = 'inactive',
  Pending = 'pending',
}

// ✅ Correct - Alphabetical interface properties
interface ComponentConfig {
  autoFocus?: boolean;
  className?: string;
  disabled?: boolean;
  id?: string;
  placeholder?: string;
  value?: string;
}

// ❌ Incorrect - Properties not in alphabetical order
const buttonClasses = {
  outline:
    'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
  default: 'bg-primary text-primary-foreground hover:bg-primary/90',
  ghost: 'hover:bg-accent hover:text-accent-foreground',
};

type ButtonProps = {
  variant?: 'default' | 'outline' | 'ghost';
  children: ReactNode;
  isLoading?: boolean;
  className?: string;
  size?: 'default' | 'sm' | 'lg';
};
```

#### Enum Standards

- **Enum Declarations**: Always use `const enum` instead of `enum` for better performance and tree-shaking
- **Enum Names**: Use PascalCase (e.g., `const enum KeyEvents`, `const enum UserStatus`)
- **Enum Properties**: Use PascalCase and organize alphabetically (e.g., `Active`, `Inactive`, `Pending`)

```typescript
// ✅ Correct
const enum KeyEvents {
  Keydown = 'keydown',
  Keyup = 'keyup',
}

const enum UserStatus {
  Active = 'active',
  Inactive = 'inactive',
  Pending = 'pending',
}

// ❌ Incorrect
enum keyEvents {
  // Should be const enum + PascalCase
  KEY_DOWN = 'keydown', // Should be PascalCase
  key_up = 'keyup', // Should be PascalCase
}
```

### Component Development

- Mobile-first responsive design with Tailwind CSS
- Implement proper ARIA attributes and keyboard navigation
- Use React.memo for expensive renders when justified
- Optimize with useMemo/useCallback when needed
- Follow semantic HTML best practices
- Extract complex logic into custom hooks

### Testing Standards

- **Test Organization**: Place tests in `__tests__/` directories
- **File Naming**: Use `.test.` before extension (e.g., `config.utils.test.ts`)
- **Focus**: Test current function logic, mock dependencies
- **Coverage**: Aim for comprehensive coverage of utility functions
- **Documentation**: Use describe blocks for each utility function

## Package Management

- **Package Manager**: pnpm (fast, disk space efficient)
- **Node Version**: Compatible with Next.js 15 requirements
- **Dependencies**: Minimal, focused on core functionality
- **Dev Dependencies**: Comprehensive tooling for quality and development experience

## Key Dependencies

### Production

- **Next.js 15**: React framework with App Router
- **React 19**: Latest React version
- **Tailwind CSS 4**: Utility-first CSS framework
- **PostCSS**: CSS processing
- **Autoprefixer**: CSS vendor prefixing

### Development

- **TypeScript**: Type-safe JavaScript
- **ESLint**: Code linting with comprehensive rules
- **Prettier**: Code formatting
- **Jest**: Testing framework
- **Testing Library**: React component testing
- **Husky**: Git hooks
- **lint-staged**: Pre-commit linting

## Important Implementation Details

### Next.js 15 Features

- **App Router**: Modern routing with layouts
- **Turbo Mode**: Enhanced development performance
- **React 19**: Latest React features and performance improvements

### CSS and Styling

- **Tailwind CSS 4**: Latest version with improved performance
- **PostCSS**: Processing pipeline for CSS
- **CSS Variables**: For theming support
- **Inter Font**: Google Fonts integration with optimization

### Development Workflow

- **Git Hooks**: Automatic linting and formatting on commit
- **Type Safety**: Strict TypeScript configuration
- **Code Quality**: ESLint + Prettier + Jest
- **Hot Reload**: Fast development feedback with Turbo

## Security Guidelines

- Never include or commit any secrets—API keys, credentials, tokens, passwords, internal URLs/paths, environment variables—in code, examples, commit messages, or PR descriptions
- Use environment variables for sensitive configuration
- Always audit commits for accidentally included sensitive information
- When generating git instructions, avoid suggesting adding secret files (e.g., `.env`, `.pem`, `.key`) to version control
- For any automation commands that delete or modify files (e.g., `rm`, force pushes), add a visible warning about the risks
- Default to secure coding patterns (input validation, XSS prevention, etc.)
- If asked to generate environment files, use obvious placeholders for sensitive values

## Git and Version Control

### Branch Strategy

- **Main Branch**: `main` (production-ready code)
- **Feature Branches**: `feature/description` or `feat/ticket-description`
- **Bug Fixes**: `fix/description` or `bugfix/ticket-description`

## General Guidelines

- Always check existing patterns in the codebase before implementing new features
- Leverage TypeScript's type system for better developer experience
- Use Tailwind CSS utilities rather than custom CSS when possible
- Test utility functions comprehensively
- Follow the established project structure and naming conventions
- Utilize path aliases for clean, maintainable imports
- Never commit files that are listed in `.gitignore`
- Prefer composition over inheritance for component design
- Keep components focused and single-responsibility
- Organize imports by `Components`, `Styles`, `Types` and `Constants`
- Remember to always use curly braces in single line conditionals and loops, even if they can be omitted
- **Blank Line Preservation**: Don't remove blank lines unnecessarily as this can cause linting failures ("Expected blank line before this statement") and reduces code readability. If a file exceeds maximum line limits, prefer code abstraction into new/existing files or refactoring over removing blank lines
- Put storybook stories in the same directory than the component it describes
- When creating stories for complex components, create their titles prepended by `feature/`. Complex components, which are themselves composed of multiple ui-only components, go under the `components` directory.
- Stories for simpler components should be prepended by `ui/`. They should be created under the `components/ui` directory.
