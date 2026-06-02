use ratatui::style::{Color, Modifier, Style};
use ratatui::text::Span;

pub const ACCENT: Color = Color::Magenta;

pub fn header_style() -> Style {
    Style::default()
        .fg(Color::White)
        .add_modifier(Modifier::BOLD | Modifier::UNDERLINED)
}

pub fn footer_style() -> Style {
    Style::default().fg(Color::Cyan)
}

pub fn highlight_style() -> Style {
    Style::default().add_modifier(Modifier::REVERSED)
}

/// Clone-status indicator: green ● when cloned, dim ○ when not.
pub fn cloned_indicator(cloned: bool) -> Span<'static> {
    if cloned {
        Span::styled("● cloned", Style::default().fg(Color::Green))
    } else {
        Span::styled("○ —", Style::default().fg(Color::DarkGray))
    }
}
