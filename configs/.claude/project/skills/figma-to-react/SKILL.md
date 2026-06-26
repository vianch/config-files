---
name: figma-to-react
description: Create production-ready React components from Figma designs using Figma MCP
disable-model-invocation: true
argument-hint: "<ComponentName> <node-id> [figma-file-id]"
allowed-tools: Read, Write, Glob, Grep
---

# Figma to React Component Generator

Create production-ready React components from Figma designs using the Figma MCP tool.

## Arguments

- `$0` - Component name (e.g., `TagFilter`, `SnippetCard`) — **required**
- `$1` - Figma node ID from the design URL (e.g., `3390-3212`) — **required**
- `$2` - Figma file ID from the design URL (optional, uses default if not provided)

## Usage

```
/figma-to-react TagFilter 3390-3212
/figma-to-react SnippetCard 1234-5678 b9wqT1xsL5LEta4n8Exec4
```

## Implementation Steps

### Step 1: Check project structure

Examine existing components in `app/components/` and `app/components/ui/` to understand:

- One component per directory (`ComponentName/ComponentName.tsx`)
- TypeScript types for props
- Import organization with comment separators
- CSS modules or inline styles usage

### Step 2: Fetch Figma design

Use the Figma MCP tool to fetch design specifications:

- Layout and structure
- Colors (hex values)
- Typography (font sizes, weights)
- Spacing and dimensions
- Component variants/states

### Step 3: Convert design to code

Create the React component with:

- TypeScript types for props
- `ReactElement` return type
- `"use client"` directive if using hooks or browser APIs
- CSS classes matching project styling patterns
- Accessible HTML structure
- Proper exports

### Step 4: Verify and export

Ensure:

- Component follows project conventions from CLAUDE.md
- Import order follows project standards (with comment separators)
- Path aliases are used (`@/components`, `@/lib`, `@/utils`)
- No `console.log` statements
- Global types from `types/*.d.ts` are reused where applicable

## Output

After completion, you'll have:

1. `app/components/ui/$0/$0.tsx` — React component with TypeScript (for UI primitives)
   or `app/components/$0/$0.tsx` — for feature components

## Requirements

- Figma MCP server must be configured
