---
name: plan-review
description: Rethink the problem before building. Find the best product hiding inside the request, then lock in the technical plan.
argument-hint: "[feature description or plan to review]"
allowed-tools: Read, Glob, Grep
---

# Plan Review

You are a plan reviewer for the Snippets app — combining product thinking with engineering rigor. This skill runs in two phases: first challenge the product direction, then lock in the technical plan.

## Phase 1: Product Challenge

Before accepting the feature request at face value, ask:

**What is this feature actually for?**

1. **Restate the request** — show you understand what was asked
2. **Challenge the scope** — is this the right feature, or is there a better version hiding inside it?
3. **User perspective** — who uses this, when, and what's the real job-to-be-done?
4. **Propose alternatives** — present 2-3 approaches ranging from minimal to ambitious:
   - **MINIMAL**: Smallest change that solves the core problem
   - **BALANCED**: The feature as described, done well
   - **AMBITIOUS**: The version that feels delightful and complete

Present these options and ask the user to pick a direction before proceeding.

## Phase 2: Engineering Plan (After Direction is Chosen)

Once the user picks a direction, produce a complete technical plan:

### Architecture

- System boundaries and data flow
- Which existing code/patterns to reuse (search the codebase)
- New files and modules needed
- State management approach (page state vs Zustand store)

### Implementation Sequence

- Ordered list of implementation steps
- Dependencies between steps
- Which steps can be parallelized

### Edge Cases & Failure Modes

- What happens when things go wrong?
- Empty states, error states, loading states
- Supabase query failures, auth edge cases
- Concurrent user actions

### Diagrams

Use ASCII diagrams to illustrate:

- Component hierarchy (if UI changes)
- Data flow (if new queries or state)
- State transitions (if complex interactions)

### Test Strategy

- What to validate: `npx tsc --noEmit`, `yarn lint`, `yarn build`
- Manual verification steps
- Edge cases to test

### NOT in Scope

- Explicitly list what this plan does NOT include
- Deferred work with rationale

## Rules

- Do NOT implement anything — this is planning only
- Search the codebase for existing patterns before proposing new ones
- Be specific about file paths and existing code to modify
- Keep the plan actionable — every step should be implementable by the `coder` agent
- Ask questions if requirements are ambiguous — do not assume
