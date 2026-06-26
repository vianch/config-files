# Config files Repository

<p align="center">
  <img src="/assets/images/terminal.jpg" height="480" />
</p>

A personal collection of dotfiles and configuration for the tools, terminals, editors, and frameworks I use every day — plus `repo-manager`, a small Rust TUI for cloning and updating repos from a GitHub org.

Each folder under [`configs/`](configs) is the **canonical copy** of that tool's config: edit it here, then re-link or copy it into its live location.

## 👇 Index

- [Repository layout](#-repository-layout)
- [Config files](#-config-files)
  - [Editors & AI tooling](#editors--ai-tooling)
  - [Shell & terminal](#shell--terminal)
  - [Build & language tooling](#build--language-tooling)
  - [Frameworks](#frameworks)
  - [CI / CD & quality gates](#ci--cd--quality-gates)
  - [Containers & infrastructure](#containers--infrastructure)
  - [Hardware](#hardware)
- [Documentation](#-documentation)
- [Apps used](#-apps-used)
- [My Keyboards](#-my-keyboards)
  - [Switches](#switches)
  - [40% keyboard layers](#40-keyboard-layers)
- [Wallpapers](#️-wallpapers)
  - [Desktop](#desktop)
  - [Mobile](#mobile)

## 🗂️ Repository layout

| Path | What it holds |
|------|---------------|
| [`configs/`](configs) | Per-tool configuration, one folder each (the bulk of this repo). |
| [`documentation/`](documentation) | Long-form guides — contributing rules and TypeScript guidelines. |
| [`wallpapers/`](wallpapers) | Desktop, mobile, and avatar images. |
| [`assets/`](assets) | README screenshots, fonts, and other static assets. |
| [`codex-usage/`](codex-usage) | Vendored macOS menu-bar app for tracking Claude usage. |
| [`configs/.claude`](configs/.claude), `.agents/`, `.codex/`, [`configs/.opencode`](configs/.opencode) | Reusable AI-agent rules, skills, commands, and hooks (Claude Code / OpenCode / Codex). |
| `src/`, `tests/`, `Cargo.toml` | `repo-manager` — the Rust TUI. See its section in [`CLAUDE.md`](CLAUDE.md). |

## 🎨 Config files

> Each row links to the folder. **Contents** lists the key files; **Description** says what it sets up.

### Editors & AI tooling

| Config | Contents | Description |
|--------|----------|-------------|
| [Neovim](configs/nvim) | `init.lua`, `lua/config/*`, `lua/plugins/*` (17 specs), `lazy-lock.json`, `.stylua.toml` | Full Neovim setup on **lazy.nvim** — options/keymaps/autocmds plus plugins for LSP, Telescope, Treesitter, neo-tree, lualine, DAP, gitsigns, which-key, and more. |
| [Cursor](configs/cursor) | `.cursorrules_react` | Cursor IDE AI rules tuned for React / TypeScript projects. |
| [OpenCode](configs/.opencode) | `opencode.json`, `agent/`, `command/`, `mcp/server/`, `themes/`, `context/` | OpenCode configuration: primary agents and subagents, slash commands, a Python MCP server, a custom theme, and shared project context. |
| [Claude Code](configs/.claude) | `user/` (global `~/.claude`: settings, hooks, agents, commands, statusline), `project/` (rules, skills, agents, memory) | Canonical copy of my Claude Code setup — global config plus project-scoped rules/skills. Secrets, transcripts, and the 1.1 GB plugin install are deliberately excluded; see its [README](configs/.claude/README.md). |

### Shell & terminal

| Config | Contents | Description |
|--------|----------|-------------|
| [Terminal](configs/terminal) | `.tmux.conf`, `starship.toml`, `.aliases`, `neofetch/`, `zsh/` (`.zshrc`, `dracula.zsh-theme`, `cloud.zsh-theme`, `brew.sh`) | The whole shell environment — tmux, Starship prompt, aliases, Neofetch, and zsh themes plus a Homebrew bootstrap script. |
| [Bash](configs/Bash) | `deploy.sh`, `greeting.sh`, `request-url-multiple-times.sh`, `bestdayevercomplete.sh` | Standalone shell scripts: a deploy helper, a terminal greeting, a URL load-tester, and a startup routine. |

### Build & language tooling

| Config | Contents | Description |
|--------|----------|-------------|
| [TypeScript](configs/TypeScript) | `tsconfig.json`, `nodemon.json` | Base TypeScript compiler options and a nodemon watch config. |
| [Linters](configs/Linters) | `.eslintrc`, `.eslintrc.js`, `.prettierrc`, `.stylelintrc`, `.editorconfig`, `.lintstagedrc`, `*ignore` | ESLint, Prettier, Stylelint, EditorConfig, and lint-staged rules. |
| [Jest](configs/Jest) | `jest.config.js` | Jest test-runner configuration. |
| [Vite](configs/vite) | `vite.config.js` | Vite build configuration. |
| [Husky](configs/Husky) | `pre-commit`, `pre-push` | Git hooks that run before commit and push. |

### Frameworks

| Config | Contents | Description |
|--------|----------|-------------|
| [Next.js](configs/NextJs) | `next.config.js`, `middleware.ts`, `next-env.d.ts` | Next.js config, edge middleware, and env typings. |
| [Gatsby](configs/Gatsby) | `gatsby-config.js` | Gatsby site configuration. |

### CI / CD & quality gates

| Config | Contents | Description |
|--------|----------|-------------|
| [GitHub](configs/Github) | `PULL_REQUEST_TEMPLATE.md`, `.gitIgnore`, `dependabot.yml`, `workflows/` (build, deploy, CodeQL) | GitHub repo defaults: PR template, gitignore, Dependabot, and Actions workflows. |
| [CircleCI](configs/.circleci) | `config.yml`, `config-example.yml` | CircleCI pipeline configuration with an annotated example. |

### Containers & infrastructure

| Config | Contents | Description |
|--------|----------|-------------|
| [Docker](configs/Docker) | `Dockerfile`, `.dockerignore`, `docker-compose.yml` | A baseline image, ignore list, and Compose stack. |
| [Kubernetes](configs/Kubernetes) | `nginx/`, `mongo/` manifests | Sample manifests: an NGINX service/deployment and a MongoDB + Mongo Express stack. |
| [NGINX](configs/NGINX) | `mime.types`, `sites-available/` | NGINX MIME types and example single- and multi-page server blocks. |
| [n8n](configs/n8n) | `compose.yaml`, `nginx/` | Self-hosted n8n via Docker Compose, fronted by Traefik / NGINX. |

### Hardware

| Config | Contents | Description |
|--------|----------|-------------|
| [Keyboard layouts](configs/keyboard-layouts) | `cstc40.vil` | Vial layout for the CSTC40 40% mechanical keyboard. |

## 🎨 Documentation

* [Contributing guide](documentation/CONTRIBUTING.md) — PR and commit conventions
* [TypeScript guidelines](documentation/TYPESCRIPT_GUIDELINES.md)
* [Config-files wiki](https://github.com/vianch/config-files/wiki)
* [Docker commands](https://github.com/vianch/config-files/wiki/Docker-commands)
* [NGINX guide](https://github.com/vianch/config-files/wiki/NGINX-guide)

## 💻 Apps used

| Program | Name |
|---------|------|
| Terminal | [iTerm2](https://iterm2.com/) |
| Terminal framework | [Oh My Zsh](https://ohmyz.sh/) |
| Terminal searcher | [fzf](https://github.com/junegunn/fzf) |
| Terminal multiplexer | [tmux](https://github.com/tmux/tmux) |
| Prompt | [Starship](https://starship.rs/) |
| Syntax highlighting | [bat](https://github.com/sharkdp/bat) |
| Editor | [Neovim](https://neovim.io/) |
| IDE | [WebStorm](https://www.jetbrains.com/webstorm/) |
| Default web browser | [Chrome UK](https://www.google.com/intl/en_uk/chrome/) |
| Developer web browser | [Firefox Developer UK](https://www.mozilla.org/en-GB/firefox/developer/) |
| Main color scheme | [Dracula 🧛](https://github.com/dracula/dracula-theme) |
| Second color scheme | [Catppuccin 🐱](https://github.com/catppuccin/catppuccin) |
| Snippets app | [SnippetsLab 🧪](https://www.renfei.org/snippets-lab/) |
| Snippets web | [Snippets VIANCH 🧪](https://snippets.vianch.com/snippets) |
| AI coding agent | [OpenCode](https://opencode.ai) |
| MCP server | [OpenCode MCP server](configs/.opencode/mcp/server) |

## ⌨️ My Keyboards

<p>
    <img width="720" src="/assets/images/IMG_0326.JPG" alt="keyboards" />
</p>

### Switches

- GoPolar x Gateron Azure Dragon V3 Switches
- EV-01 Linear Switches

| <img width="320" src="/assets/images/gopolar.webp" alt="gopolar" /> | <img width="320" src="/assets/images/eva.png" alt="eva-01" /> |
|--------------|--------------|

### 40% keyboard layers

The layout file lives in [`configs/keyboard-layouts/cstc40.vil`](configs/keyboard-layouts/cstc40.vil) (open it with [Vial](https://get.vial.today/)).

| <img width="420" src="/assets/images/layer0.png" alt="layer0" /> | <img width="420" src="/assets/images/layer1.png" alt="layer1" /> |
|--------------|--------------|

## 🖼️ Wallpapers

### Desktop

<p>
    <a href="https://github.com/vianch/config-files/tree/main/wallpapers/desktop" target="_blank">
        <img src="https://raw.githubusercontent.com/vianch/config-files/main/wallpapers/desktop/preview.jpg" alt="preview wallpapers" />
    </a>
</p>

### Mobile

<p>
    <a href="https://github.com/vianch/config-files/tree/main/wallpapers/mobile" target="_blank">
        <img height="1240" src="/wallpapers/mobile/IMG_0335.JPG" />
    </a>
</p>
