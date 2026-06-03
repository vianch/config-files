---
name: prompt-enhancer
description: Analyze and optimize prompts for better AI performance using research-backed XML structures and systematic workflow
disable-model-invocation: true
argument-hint: "[file path or prompt text]"
allowed-tools: Read, Write, Edit, Glob, Grep
---

# Prompt Optimization Architect

Transform prompts into high-performance agents through systematic analysis, restructuring, and validation using research-backed patterns.

## Input Resolution

Determine whether `$ARGUMENTS` is a file path or inline prompt text:

1. If `$ARGUMENTS` looks like a file path (contains `/`, `.md`, `.txt`, or matches an existing file) → read the file and use its contents as the prompt to optimize
2. Otherwise → treat `$ARGUMENTS` itself as the raw prompt text to optimize

If `$ARGUMENTS` is empty, ask the user to provide either a file path or prompt text.

## Workflow

### Stage 1: Analyze

1. Resolve the input prompt (file or text) using the rules above
2. Assess prompt type (command, agent, subagent, workflow)
3. Analyze current structure against research patterns
4. Identify optimization opportunities
5. Determine complexity level

**Complexity Assessment:**

- **Simple**: Single task, linear flow → basic optimization
- **Moderate**: Multiple steps, some routing → enhanced structure
- **Complex**: Multi-agent coordination, dynamic routing → full orchestration

**Scoring Criteria (10 points):**

- Component order (context → role → task → instructions): 2 points
- Hierarchical context (system → domain → task → execution): 2 points
- Routing logic with executable conditions: 2 points
- Context management with allocation strategy: 2 points
- Clear stages with prerequisites and checkpoints: 2 points

### Stage 2: Restructure Core

Apply optimal component sequence:

1. **Context** (15-25%): Hierarchical information
2. **Role** (5-10%): Clear identity
3. **Task** (5-10%): Primary objective
4. **Instructions** (40-50%): Detailed workflow
5. **Examples** (20-30%): When needed
6. **Constraints** (5-10%): Boundaries
7. **Validation** (5-10%): Quality checks

### Stage 3: Enhance Workflow

Based on complexity:

- **Simple**: Numbered steps with actions and validation checkpoints
- **Moderate**: Multi-step workflow with decision points and routing logic
- **Complex**: Multi-stage workflow with routing intelligence and validation gates

### Stage 4: Add Validation

- Pre-flight checks (prerequisites before execution)
- Stage checkpoints (validation after each critical stage)
- Post-flight checks (final quality verification)

### Stage 5: Deliver

Present the optimized prompt with:

- Original vs optimized score
- Key optimizations applied
- Expected performance gains
- Implementation notes

## Example

See `example.md` in this skill directory for a full end-to-end workflow showing how all Snippets project skills chain together — from `/plan-review` through `/commit` and `/pr`.
