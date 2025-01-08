export CONTENTFUL_API="api contentful"
export CONTENTFUL_CMA_TOKEN="contentful-token"
export CONTENTFUL_SPACE_ID="spaceid"
export CONTENTFUL_ENVIRONMENT_ID="master"
export CONTENTFUL_HOST="https://cdn.contentful.com"

# Path to your oh-my-zsh installation.
export ZSH="$HOME/.oh-my-zsh"
export PATH=/opt/homebrew/bin:$PATH
export PATH=$PATH:~/go/bin
export PATH=~/.npm-global/bin:$PATH

ZSH_THEME="dracula"

CASE_SENSITIVE="false"

HYPHEN_INSENSITIVE="true"

plugins=(
	git
	brew
    grails
	npm
	node
	web-search
	zsh-autosuggestions
	zsh-syntax-highlighting
)

source $ZSH/oh-my-zsh.sh

# User configuration
# set up fzf keybinding ad fuzzy completion
eval "$(fzf --zsh)"
# startshio coss-shell prompt
eval "$(starship init zsh)"

alias zshconfig="mate ~/.zshrc"
alias gcz="git cz"
alias grails="/Users/victorchavarro/.sdkman/candidates/grails/current/bin/grails"
alias yri="yarn run init"
alias yrd="yarn run dev"
alias grails="/Users/user/.sdkman/candidates/grails/current/bin/grails"
alias python=/usr/bin/python3
# alias ohmyzsh="mate ~/.oh-my-zsh"

source /Users/user/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh


export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion

# bun completions
[ -s "/Users/user/.bun/_bun" ] && source "/Users/user/.bun/_bun"

# bun
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

# >>> conda initialize >>>
# !! Contents within this block are managed by 'conda init' !!
__conda_setup="$('/opt/miniconda3/bin/conda' 'shell.zsh' 'hook' 2> /dev/null)"
if [ $? -eq 0 ]; then
    eval "$__conda_setup"
else
    if [ -f "/opt/miniconda3/etc/profile.d/conda.sh" ]; then
        . "/opt/miniconda3/etc/profile.d/conda.sh"
    else
        export PATH="/opt/miniconda3/bin:$PATH"
    fi
fi
unset __conda_setup
# <<< conda initialize <<<

# Use fd instead of fzf

export FZF_DEFAULT_COMMAND="fd --hidden --strip-cwd-prefix --exclude .git"
export FZF_CTRL_T_COMMAND="$FZF_DEFAULT_COMMAND"
export FZF_ALT_C_COMMAND="fd --type=d --hidden --strip-cwd-prefix --exclude .git"

# Use fd (https://github.com/sharkdp/fd) for listing path candidates.
# The first argument to the function ($1) is the base path to start traversal.
# See the source code (completion.{bash,zsh}) for the details.
_fzf_compgen_path() {
  fd --hidden --exclude .git . "$1"
}

# Use fd to generate the list for directory completion
_fzf_compgen_dir() {
  fd --type=d --hidden --exclude .git . "$1"
}

# Initialize neofetch
neofetch