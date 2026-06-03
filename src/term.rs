use ratatui::DefaultTerminal;
use std::io;

/// Enter the TUI (raw mode + alternate screen). `ratatui::try_init` also
/// installs a panic hook that restores the terminal, so a panic mid-render
/// never leaves the user's terminal wedged.
pub fn init() -> io::Result<DefaultTerminal> {
    ratatui::try_init()
}

/// Leave the TUI and restore the terminal to its normal state.
pub fn restore() -> io::Result<()> {
    ratatui::try_restore()
}

/// Hand the real terminal to a child process (git) so it can print progress
/// and prompt for SSH passphrases / host keys, then re-enter the TUI.
/// Returns the closure's result.
pub fn released<T>(terminal: &mut DefaultTerminal, op: impl FnOnce() -> T) -> io::Result<T> {
    restore()?;
    let out = op();
    *terminal = init()?;
    let _ = terminal.clear();
    Ok(out)
}
