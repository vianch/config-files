-- General (non-plugin) keymaps. Plugin-specific maps live in each plugin spec.

local map = vim.keymap.set

-- Clear search highlights
map("n", "<Esc>", "<cmd>nohlsearch<CR>", { desc = "Clear search highlights" })

-- Enter command mode with ;
map("n", ";", ":", { desc = "Command mode", nowait = true })

-- Window navigation
map("n", "<C-h>", "<C-w>h", { desc = "Window left" })
map("n", "<C-l>", "<C-w>l", { desc = "Window right" })
map("n", "<C-j>", "<C-w>j", { desc = "Window down" })
map("n", "<C-k>", "<C-w>k", { desc = "Window up" })

-- Files
map("n", "<C-s>", "<cmd>w<CR>", { desc = "Save file" })
map("n", "<C-c>", "<cmd>%y+<CR>", { desc = "Copy whole file" })

-- Insert-mode cursor movement
map("i", "<C-b>", "<ESC>^i", { desc = "Beginning of line" })
map("i", "<C-e>", "<End>", { desc = "End of line" })
map("i", "<C-h>", "<Left>", { desc = "Move left" })
map("i", "<C-l>", "<Right>", { desc = "Move right" })
map("i", "<C-j>", "<Down>", { desc = "Move down" })
map("i", "<C-k>", "<Up>", { desc = "Move up" })

-- Toggle line numbers
map("n", "<leader>n", "<cmd>set nu!<CR>", { desc = "Toggle line number" })
map("n", "<leader>rn", "<cmd>set rnu!<CR>", { desc = "Toggle relative number" })

-- New buffer
map("n", "<leader>b", "<cmd>enew<CR>", { desc = "New buffer" })

-- Move through wrapped lines naturally (but keep counts/operators correct)
map({ "n", "x" }, "j", 'v:count || mode(1)[0:1] == "no" ? "j" : "gj"', { expr = true, desc = "Move down" })
map({ "n", "x" }, "k", 'v:count || mode(1)[0:1] == "no" ? "k" : "gk"', { expr = true, desc = "Move up" })

-- Don't overwrite the unnamed register when pasting over a selection
map("x", "p", 'p:let @+=@0<CR>:let @"=@0<CR>', { silent = true, desc = "Paste without yank" })
