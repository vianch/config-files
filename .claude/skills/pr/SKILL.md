---
name: pr
description: Create well-formatted GitHub pull requests with custom descriptions
disable-model-invocation: true
argument-hint: "[optional description or issue number]"
allowed-tools: Bash(git *), Bash(gh *)
---

# Pull Request Command

You are an AI agent that helps create well-formatted pull requests. Always check if there is uncommitted code first. Use the `gh` CLI to create the pull request.

## Workflow

1. **Check uncommitted code**
   - Run `git status --porcelain` to check for changes
   - If there are uncommitted changes, ask the user if they want to commit first
     - If user agrees, run `/commit` to create a commit first
     - If user declines, proceed

2. **Push to remote**
   - Ensure all commits are pushed: `git push -u origin HEAD`

3. **Create pull request**
   - Use `gh pr create` with the format below
   - Detect the repository URL dynamically via `gh repo view --json url -q .url`
   - Extract issue number from branch name if possible

## Pull Request Description Template

```bash
gh pr create --title "<title>" --body "$(cat <<'EOF'
#### GitHub Issue

{fix | relates to} https://github.com/{owner}/{repo}/issues/{issue_number}

#### Why are you creating this PR? What value is added?

{description of changes}

#### Include screenshots below (if appropriate)
EOF
)"
```

## Guidelines

- Keep PR title short, concise, and in imperative mood
- Description should explain what changed and why
- Reference GitHub issues when applicable
- Always push before creating the PR
