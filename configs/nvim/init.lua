-- Bootstrap lazy.nvim
local lazypath = vim.fn.stdpath("data") .. "/lazy/lazy.nvim"
if not (vim.uv or vim.loop).fs_stat(lazypath) then
  vim.fn.system({
    "git",
    "clone",
    "--filter=blob:none",
    "https://github.com/folke/lazy.nvim.git",
    "--branch=stable",
    lazypath,
  })
end
vim.opt.rtp:prepend(lazypath)

-- Core editor configuration (load before plugins so <leader> is correct)
require("config.options")
require("config.keymaps")
require("config.autocmds")

-- Plugins: every file in lua/plugins/ is auto-imported and must return a spec
require("lazy").setup({
  spec = {
    { import = "plugins" },
  },
  install = { colorscheme = { "shades_of_purple" } },
  checker = { enabled = false }, -- don't auto-check for plugin updates
  change_detection = { notify = false },
  performance = {
    rtp = {
      disabled_plugins = {
        "gzip",
        "tarPlugin",
        "tohtml",
        "tutor",
        "zipPlugin",
        "netrwPlugin",
      },
    },
  },
})
