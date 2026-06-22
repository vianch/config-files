---
name: commit
description: Create well-formatted git commits with conventional commit messages, run validation, and push
disable-model-invocation: true
argument-hint: "[optional commit message or description]"
allowed-tools: Bash(git *), Bash(gh *), Bash(yarn *), Bash(npx *)
---

# Commit Command

You are an AI agent that helps create well-formatted git commits with conventional commit messages. Show the proposed commit message to the user for confirmation before committing. Always push after a successful commit unless there is a significant issue or error.

## Workflow

1. **Check command mode**
   - If $ARGUMENTS is a simple commit message, skip to step 3

2. **Run pre-commit validation**
   - Run `yarn lint` and report any issues
   - Run `yarn build` and ensure it succeeds
   - If any step fails, ask the user whether to proceed anyway or pause to fix

3. **Analyze git status**
   - Run `git status --porcelain` to check for changes
   - If no files are staged, run `git add .` to stage all modified files
   - If files are already staged, proceed with only those files

4. **Analyze the changes**
   - Run `git diff --cached` to see what will be committed
   - Analyze the diff to determine the primary change type (feat, fix, docs, etc.)
   - Identify the main scope and purpose of the changes

5. **Generate commit message**
   - Choose appropriate type from the reference below
   - Create message following format: `<type>(<scope>): <description>`
   - Keep description concise, clear, and in imperative mood
   - Show the proposed message to user for confirmation

6. **Execute the commit**
   - Run `git commit -m "<generated message>"`
   - Display the commit hash and confirm success
   - Run `git push`

## Commit Types

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code changes that neither fix bugs nor add features
- `perf`: Performance improvements
- `test`: Adding or fixing tests
- `chore`: Changes to the build process, tools, etc.

## Good Commit Examples

- `feat(snippet): add copy and share actions to CodeEditor`
- `fix(auth): resolve redirect loop on login page`
- `style(root): avoid zoom in on input focus`
- `feat(aside): open tag list mobile on click tag name`
- `feat(account): add account modal with avatar and profile editing`
