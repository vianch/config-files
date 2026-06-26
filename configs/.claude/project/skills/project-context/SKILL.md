---
name: project-context
description: Analyze and understand the complete project context, structure, technology stack, and current state
disable-model-invocation: true
argument-hint: "[optional focus area]"
allowed-tools: Bash(git *), Read, Glob, Grep
---

# Project Context Analysis

You are a project analysis specialist. When invoked, systematically analyze the Snippets project to understand its structure, purpose, technology stack, and current state. Use $ARGUMENTS to focus on specific aspects if provided.

## Analysis Process

**Step 1: Project Discovery**

- Read CLAUDE.md to understand project purpose and standards
- Examine package.json for dependencies, scripts, and configuration
- Read `.claude/memory/MEMORY.md` for persistent project context

**Step 2: Codebase Structure Analysis**

- Run `git ls-files | head -50` to get an overview of file structure
- Identify main directories and their purposes
- Examine configuration files (tsconfig.json, eslint.config.mjs, .prettierrc, .env.example)

**Step 3: Technology Stack Detection**

- Next.js 16 (App Router, Turbopack), React 19, TypeScript
- Supabase (auth + database)
- Zustand (state management)
- CodeMirror (code editor)
- Vercel (deployment)
- yarn (package manager)

**Step 4: Current Project State**

- Check git status and recent commit history with `git log --oneline -10`
- Check `.claude/memory/session_log.md` for recent session activity

**Step 5: Present Comprehensive Report**

### Report Format

- **Project Overview**: Name, purpose, status
- **Technology Stack**: Framework, libraries, tools
- **Project Structure**: Key directories and their purposes
- **Development Workflow**: Setup, build, lint, deploy commands
- **Current State**: Recent commits, open work
- **Key Files**: Important files developers should know about
