use crate::banner;
use crate::manifest::Repo;
use crate::ui::theme;
use ratatui::crossterm::event::{KeyCode, KeyEvent, KeyModifiers};
use ratatui::layout::{Constraint, Layout, Rect};
use ratatui::style::{Color, Modifier, Style};
use ratatui::text::{Line, Span};
use ratatui::widgets::{Block, Borders, List, ListItem, ListState, Paragraph};
use ratatui::Frame;

pub enum Action {
    None,
    Cancel,
    Confirm,
}

pub struct UpdatePage {
    repos: Vec<Repo>,
    checked: Vec<bool>,
    cursor: usize,
}

impl UpdatePage {
    pub fn new(repos: Vec<Repo>) -> Self {
        let checked = vec![false; repos.len()];
        Self {
            repos,
            checked,
            cursor: 0,
        }
    }

    pub fn selected_names(&self) -> Vec<String> {
        self.repos
            .iter()
            .zip(&self.checked)
            .filter(|(_, &c)| c)
            .map(|(r, _)| r.name.clone())
            .collect()
    }

    pub fn on_key(&mut self, key: KeyEvent) -> Action {
        match (key.code, key.modifiers) {
            (KeyCode::Esc, _) | (KeyCode::Char('q'), _) => Action::Cancel,
            (KeyCode::Char('c'), KeyModifiers::CONTROL) => Action::Cancel,
            (KeyCode::Up, _) => {
                if self.cursor > 0 {
                    self.cursor -= 1;
                }
                Action::None
            }
            (KeyCode::Down, _) => {
                if self.cursor + 1 < self.repos.len() {
                    self.cursor += 1;
                }
                Action::None
            }
            (KeyCode::Char(' '), _) => {
                if let Some(c) = self.checked.get_mut(self.cursor) {
                    *c = !*c;
                }
                Action::None
            }
            (KeyCode::Char('a'), _) => {
                let all = self.checked.iter().all(|&c| c);
                for c in self.checked.iter_mut() {
                    *c = !all;
                }
                Action::None
            }
            (KeyCode::Enter, _) => Action::Confirm,
            _ => Action::None,
        }
    }

    pub fn draw(&self, f: &mut Frame) {
        let chunks = Layout::vertical([
            Constraint::Length(banner::HEIGHT + 1),
            Constraint::Min(3),
            Constraint::Length(2),
        ])
        .split(f.area());

        f.render_widget(Paragraph::new(banner::lines()), chunks[0]);
        self.draw_list(f, chunks[1]);
        self.draw_footer(f, chunks[2]);
    }

    fn draw_list(&self, f: &mut Frame, area: Rect) {
        let items: Vec<ListItem> = self
            .repos
            .iter()
            .zip(&self.checked)
            .map(|(r, &c)| {
                let mark = if c { "[x]" } else { "[ ]" };
                let mark_color = if c { Color::Green } else { Color::DarkGray };
                ListItem::new(Line::from(vec![
                    Span::styled(mark, Style::default().fg(mark_color)),
                    Span::raw(" "),
                    Span::styled(r.name.clone(), Style::default().add_modifier(Modifier::BOLD)),
                    Span::raw("  "),
                    Span::styled(r.lang_display().to_string(), Style::default().fg(Color::Gray)),
                ]))
            })
            .collect();
        let list = List::new(items)
            .block(Block::default().borders(Borders::ALL).title(" cloned repos "))
            .highlight_style(theme::highlight_style())
            .highlight_symbol("▶ ");
        let mut state = ListState::default();
        state.select(Some(self.cursor));
        f.render_stateful_widget(list, area, &mut state);
    }

    fn draw_footer(&self, f: &mut Frame, area: Rect) {
        let selected = self.checked.iter().filter(|&&c| c).count();
        let total = self.repos.len();
        let footer = format!("  {selected}/{total} selected");
        let help = "  ↑/↓ move · Space toggle · a select all · Enter update · q cancel";
        let lines = vec![
            Line::from(Span::styled(footer, theme::footer_style())),
            Line::from(Span::styled(help, Style::default().fg(Color::DarkGray))),
        ];
        f.render_widget(Paragraph::new(lines), area);
    }
}
