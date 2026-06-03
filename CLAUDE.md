# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

A personal **configuration-files collection** — dotfiles and settings for the apps, systems, terminals, UI tooling, and frameworks the owner uses, plus one small built tool. There are two distinct working contexts; figure out which one a request falls into:

1. **The config collection** (most of the repo) — static config, docs, and assets. Not built or tested. See *Configuration collection* and *`.claude/` — rules & skills* below.
2. **`repo-manager`** — a Rust TUI, the only buildable/testable code (everything under `src/`, `tests/`, `Cargo.toml`, `Makefile`). See *repo-manager* below.

## Configuration collection

- `configs/` — per-tool configuration, one folder each: Bash, CircleCI (`.circleci`), Cursor, Docker, Gatsby, GitHub, Husky, Jest, Kubernetes, Linters, NGINX, OpenCode (`.opencode`), terminal/zsh, Next.js, TypeScript. Each is the canonical copy of that tool's dotfiles — edit the file under `configs/` and re-link/copy into the live location; don't hand-edit the live copy and forget this one.
- `documentation/` — long-form guides (e.g. a Pokémon Red/Fire guide and other personal notes).
- `wallpapers/`, `assets/` — images (desktop/mobile wallpapers, README screenshots). Binary; don't reformat.
- `README.md` — the human-facing index of the collection (config links, hardware/keyboard notes, app list).

These are mostly drop-in files for other environments. Treat them as data: preserve each tool's own format and conventions rather than imposing a house style.

## `.claude/` — Claude Code rules & skills

`.claude/rules/` and `.claude/skills/` are the owner's reusable Claude Code configuration. **They target an external project — the "Snippets" app (Next.js 16 App Router, React 19, TypeScript, Supabase, Zustand 5, CodeMirror) — not the Rust code in this repo.** When working on `repo-manager`, follow Rust idioms and the *Conventions* section, not these. They live here so they travel between machines and projects.

### Rules — [`.claude/rules/`](.claude/rules/)

Coding standards for the Snippets app. Some are scoped to paths (via `paths:` frontmatter) so they only fire on matching files.

- **TypeScript & style** — [`typescript.md`](.claude/rules/typescript.md) (strict, no `any`, arrow functions, alphabetized members, branded IDs), [`naming.md`](.claude/rules/naming.md) (no single-letter/abbreviated identifiers), [`code-style.md`](.claude/rules/code-style.md) (braces on all conditionals; no module-scope helpers in component/hook/store files), [`enums-and-constants.md`](.claude/rules/enums-and-constants.md) (`const enum` only; no magic literals in conditionals), [`imports.md`](.claude/rules/imports.md) (import-group ordering; no barrels), [`file-naming.md`](.claude/rules/file-naming.md), [`types-location.md`](.claude/rules/types-location.md) (all types in `types/**/*.d.ts`).
- **Architecture (path-scoped)** — [`components.md`](.claude/rules/components.md) (`components/ui` primitives, one component per file), [`utilities.md`](.claude/rules/utilities.md) (`utils/` are pure functions only), [`supabase.md`](.claude/rules/supabase.md) (singleton clients, all queries in `queries.ts`, `user_id` scoping).
- **Domain** — [`http-status.md`](.claude/rules/http-status.md) (use the `HttpStatusCode` enum, never raw status numbers), [`i18n.md`](.claude/rules/i18n.md) (all copy through `t(...)`, namespaced locale files).
- **Process** — [`verification.md`](.claude/rules/verification.md) (lint/format/typecheck/test/build before committing; never `--no-verify`).

### Skills — [`.claude/skills/`](.claude/skills/)

Slash-command workflows, also written for the Snippets app (their `yarn` pipelines won't apply to `repo-manager`). Those marked `disable-model-invocation: true` only run when the user invokes them explicitly; the rest may also be triggered proactively.

- **Git workflow** — [`commit`](.claude/skills/commit/SKILL.md) (conventional commits + validation + push), [`pr`](.claude/skills/pr/SKILL.md) (formatted GitHub PRs).
- **Quality & validation** — [`clean`](.claude/skills/clean/SKILL.md) (Prettier/ESLint/Stylelint/tsc), [`test`](.claude/skills/test/SKILL.md) (full validation pipeline, fix-until-green), [`review`](.claude/skills/review/SKILL.md) (pre-landing structural review against [`checklist.md`](.claude/skills/review/checklist.md)), [`optimize`](.claude/skills/optimize/SKILL.md) (performance/security pass).
- **Planning & analysis** — [`plan-review`](.claude/skills/plan-review/SKILL.md) (product-then-technical plan critique), [`project-context`](.claude/skills/project-context/SKILL.md) (analyze stack & state), [`retro`](.claude/skills/retro/SKILL.md) (weekly engineering retrospective), [`prompt-enhancer`](.claude/skills/prompt-enhancer/SKILL.md) (rewrite prompts with XML structure; see [`example.md`](.claude/skills/prompt-enhancer/example.md)).
- **Generation** — [`figma-to-react`](.claude/skills/figma-to-react/SKILL.md) (React components from Figma via MCP).

---

# repo-manager

A terminal UI for cloning and updating repos from a single GitHub org. Two modes:

- **Clone** (default): fuzzy-finder list of the org's repos; Enter clones the selected one into `repos/`.
- **Update** (`update` arg): multi-select list of already-cloned repos; fast-forwards each one's `main` branch.

The target org is the `GITHUB_ORG` constant in `src/github.rs` (currently `vianch`) — change it there, nowhere else. Cloned repos land in `TARGET_DIR` (`repos/`, gitignored), defined in `src/data.rs`.

## Commands

```bash
make            # Clone mode — open the fuzzy-finder menu (cargo run --release)
make update     # Update mode — multi-select fast-forward of cloned repos
make build      # cargo build --release
make test       # cargo test

cargo run -- help            # CLI usage + keybindings
cargo test parse_repos       # run one unit test by name substring
cargo test --test update_integration   # run only the integration test file
```

### Prerequisites
- **`gh` CLI installed and authenticated** (`brew install gh && gh auth login`) — repo listing shells out to `gh repo list`. Absence/auth failure is detected up front and prints actionable instructions instead of opening an empty TUI.
- **git with SSH access to the org** — clone/update use SSH URLs and may prompt for a passphrase or host-key confirmation.

## Architecture

`src/main.rs` is a thin shell: it parses the one optional arg into a `Mode` and calls `ui::run`. `src/lib.rs` re-exports every module as a library so the git flows can be integration-tested without going through the binary.

Data flow for a session:

```
gh repo list ──► github::fetch ──► cache (.cache/repos.json) ──► data::load_repos ──► ui (ClonePage/UpdatePage)
                                         ▲                                                    │
                                         └──── manifest::enrich_with_clone_status ◄───────────┘
                                              (live filesystem scan of repos/)
```

- **`github.rs`** — shells out to `gh`, deserializes JSON into `Repo`, sorts most-recent-first. `parse_repos` is pure (no I/O) and unit-tested. Owns `GITHUB_ORG` and `FETCH_LIMIT` (truncation is surfaced, not silently dropped).
- **`cache.rs`** — JSON cache at `.cache/repos.json`. Writes are atomic (temp file + rename). A missing or corrupt cache returns `None` so the caller refetches — a bad cache never bricks startup. Also formats cache age (`3m`, `2h`, `5d`).
- **`manifest.rs`** — the `Repo` model. The `cloned` flag is `#[serde(skip)]`: it is **always recomputed live** from the filesystem (`enrich_with_clone_status` checks `repos/<name>/.git`), never trusted from cache.
- **`data.rs`** — orchestrates cache-vs-fetch (`load_repos(force)`) and always re-enriches clone status afterward.
- **`cloner.rs`** — the git operations. `update_repo` is fast-forward-only and reports distinct `Outcome`s — `Cloned`, `Updated`, `UpToDate`, `SkippedDirty`, `SkippedNoMain`, `Failed` — rather than collapsing skips into failures. `clone_args`/`tally` are pure and unit-tested; `print_summary` renders the batch result.
- **`term.rs`** — TUI lifecycle. The key piece is `released()`: it tears down raw-mode/alt-screen, hands the **real** terminal to a child git process (so the user sees clone progress and can answer SSH prompts), then re-enters the TUI. Any git invocation that may prompt must go through this.
- **`ui/`** — `app.rs` holds the two event loops (250ms poll); `clone_view.rs` is the fuzzy finder (`SkimMatcherV2`); `update_view.rs` is the multi-select; `theme.rs` + `banner.rs` are presentation.

## Conventions (repo-manager)

- **Keep I/O at the edges, logic pure.** The functions that are unit-tested (`parse_repos`, `clone_args`, `format_age`, `tally`, `enrich_with_clone_status`) take plain inputs and return values — no process spawning or terminal access inside them. New parsing/derivation logic should follow the same split so it stays testable. Integration tests in `tests/update_integration.rs` cover the real git flows against throwaway temp repos.
- **Errors are typed and actionable.** `GhError` carries install/auth/command/parse variants whose `Display` text tells the user the exact remediation command. Don't replace these with bare strings.
- **Never bypass `term::released` for interactive git.** Running git directly while the TUI owns the terminal corrupts both the prompt and the render.
