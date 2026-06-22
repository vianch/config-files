-- Editor options. Loaded before lazy.nvim so <leader> is set before plugins.

local opt = vim.opt
local g = vim.g

-- Leader keys (must be set before plugins load)
g.mapleader = " "
g.maplocalleader = " "

-- UI
opt.number = true -- show line numbers
opt.numberwidth = 2
opt.signcolumn = "yes" -- always show the sign column to avoid layout shift
opt.cursorline = true
opt.termguicolors = true -- 24-bit colours (required by most themes)
opt.background = "dark" -- shades-of-purple is a dark theme
opt.laststatus = 3 -- single, global statusline
opt.showmode = false -- mode is shown in lualine instead
opt.ruler = false
opt.fillchars = { eob = " " } -- hide ~ on empty lines
opt.scrolloff = 8 -- keep some context around the cursor

-- Indentation
opt.expandtab = true -- spaces instead of tabs
opt.tabstop = 2
opt.softtabstop = 2
opt.shiftwidth = 2
opt.smartindent = true

-- Search
opt.ignorecase = true
opt.smartcase = true -- case-sensitive only when the query has uppercase

-- Behaviour
opt.clipboard = "unnamedplus" -- use the system clipboard
opt.mouse = "a"
opt.swapfile = false
opt.undofile = true -- persistent undo history
opt.updatetime = 250 -- faster CursorHold / gitsigns
opt.timeoutlen = 400
opt.splitbelow = true
opt.splitright = true
opt.shortmess:append("sI") -- skip intro message
opt.whichwrap:append("<>[]hl") -- let h/l and arrows wrap across lines

-- Disable unused providers to speed up startup
for _, provider in ipairs({ "node", "perl", "python3", "ruby" }) do
  g["loaded_" .. provider .. "_provider"] = 0
end

-- Make mason-installed binaries available on PATH
local is_windows = vim.fn.has("win32") == 1
local sep = is_windows and ";" or ":"
vim.env.PATH = vim.fn.stdpath("data") .. "/mason/bin" .. sep .. vim.env.PATH
