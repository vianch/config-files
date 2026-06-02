use ratatui::style::{Color, Style};
use ratatui::text::{Line, Span};

/// VIANCH block-art banner shown on launch.
pub const ART: [&str; 7] = [
    "░██    ░██ ░██████   ░███    ░███    ░██   ░██████  ░██     ░██ ",
    "░██    ░██   ░██    ░██░██   ░████   ░██  ░██   ░██ ░██     ░██ ",
    "░██    ░██   ░██   ░██  ░██  ░██░██  ░██ ░██        ░██     ░██ ",
    "░██    ░██   ░██  ░█████████ ░██ ░██ ░██ ░██        ░██████████ ",
    " ░██  ░██    ░██  ░██    ░██ ░██  ░██░██ ░██        ░██     ░██ ",
    "  ░██░██     ░██  ░██    ░██ ░██   ░████  ░██   ░██ ░██     ░██ ",
    "   ░███    ░██████░██    ░██ ░██    ░███   ░██████  ░██     ░██ ",
];

/// Number of art rows (used for TUI layout sizing).
pub const HEIGHT: u16 = ART.len() as u16;

/// Banner as styled ratatui lines.
pub fn lines() -> Vec<Line<'static>> {
    ART.iter()
        .map(|l| Line::from(Span::styled(*l, Style::default().fg(Color::Magenta))))
        .collect()
}
