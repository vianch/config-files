use crate::banner;
use crate::manifest::{self, Repo};
use crate::ui::theme;
use fuzzy_matcher::skim::SkimMatcherV2;
use fuzzy_matcher::FuzzyMatcher;
use ratatui::crossterm::event::{KeyCode, KeyEvent, KeyModifiers};
use ratatui::layout::{Constraint, Layout, Rect};
use ratatui::style::{Color, Modifier, Style};
use ratatui::text::{Line, Span};
use ratatui::widgets::{Block, Borders, Cell, Paragraph, Row, Table, TableState};
use ratatui::Frame;

/// Repos shown when no filter is active (most-recent-first).
const DEFAULT_VISIBLE: usize = 20;

pub enum Action {
    None,
    Quit,
    Refresh,
    Clone { name: String, ssh_url: String },
}

pub struct ClonePage {
    repos: Vec<Repo>,
    query: String,
    filtered: Vec<usize>,
    selected: usize,
    status: Option<String>,
    cache_age: Option<String>,
    truncated: bool,
    matcher: SkimMatcherV2,
}

impl ClonePage {
    pub fn new(repos: Vec<Repo>, cache_age: Option<String>, truncated: bool) -> Self {
        let mut page = Self {
            repos,
            query: String::new(),
            filtered: Vec::new(),
            selected: 0,
            status: None,
            cache_age,
            truncated,
            matcher: SkimMatcherV2::default(),
        };
        page.recompute();
        page
    }

    /// Replace repo data after a refresh, preserving the query.
    pub fn set_repos(&mut self, repos: Vec<Repo>, cache_age: Option<String>, truncated: bool) {
        self.repos = repos;
        self.cache_age = cache_age;
        self.truncated = truncated;
        self.recompute();
    }

    pub fn set_status(&mut self, msg: impl Into<String>) {
        self.status = Some(msg.into());
    }

    /// Mark a repo cloned in place (after a successful clone).
    pub fn mark_cloned(&mut self, name: &str) {
        if let Some(r) = self.repos.iter_mut().find(|r| r.name == name) {
            r.cloned = true;
        }
    }

    fn recompute(&mut self) {
        // Preserve selection by repo name across filter changes.
        let prev = self.selected_name();
        if self.query.is_empty() {
            self.filtered = (0..self.repos.len()).take(DEFAULT_VISIBLE).collect();
        } else {
            let mut scored: Vec<(i64, usize)> = self
                .repos
                .iter()
                .enumerate()
                .filter_map(|(i, r)| self.matcher.fuzzy_match(&r.name, &self.query).map(|s| (s, i)))
                .collect();
            scored.sort_by(|a, b| b.0.cmp(&a.0));
            self.filtered = scored.into_iter().map(|(_, i)| i).collect();
        }
        // Restore selection if the same repo is still visible; otherwise clamp.
        self.selected = prev
            .and_then(|name| self.filtered.iter().position(|&i| self.repos[i].name == name))
            .unwrap_or(0);
        if self.selected >= self.filtered.len() {
            self.selected = self.filtered.len().saturating_sub(1);
        }
    }

    fn selected_name(&self) -> Option<String> {
        self.filtered
            .get(self.selected)
            .map(|&i| self.repos[i].name.clone())
    }

    pub fn on_key(&mut self, key: KeyEvent) -> Action {
        // Clear any transient status on the next keypress.
        self.status = None;
        match (key.code, key.modifiers) {
            (KeyCode::Esc, _) => Action::Quit,
            (KeyCode::Char('c'), KeyModifiers::CONTROL) => Action::Quit,
            (KeyCode::Char('r'), KeyModifiers::CONTROL) => Action::Refresh,
            (KeyCode::Up, _) => {
                if self.selected > 0 {
                    self.selected -= 1;
                }
                Action::None
            }
            (KeyCode::Down, _) => {
                if self.selected + 1 < self.filtered.len() {
                    self.selected += 1;
                }
                Action::None
            }
            (KeyCode::Enter, _) => {
                let target = self
                    .filtered
                    .get(self.selected)
                    .map(|&i| (self.repos[i].name.clone(), self.repos[i].ssh_url.clone(), self.repos[i].cloned));
                match target {
                    Some((name, ssh_url, false)) => Action::Clone { name, ssh_url },
                    Some((_, _, true)) => {
                        self.set_status("already cloned");
                        Action::None
                    }
                    None => Action::None,
                }
            }
            (KeyCode::Backspace, _) => {
                self.query.pop();
                self.recompute();
                Action::None
            }
            (KeyCode::Char(c), m) if !m.contains(KeyModifiers::CONTROL) => {
                self.query.push(c);
                self.recompute();
                Action::None
            }
            _ => Action::None,
        }
    }

    pub fn draw(&self, f: &mut Frame) {
        let chunks = Layout::vertical([
            Constraint::Length(banner::HEIGHT + 1),
            Constraint::Length(3),
            Constraint::Min(3),
            Constraint::Length(2),
        ])
        .split(f.area());

        f.render_widget(Paragraph::new(banner::lines()), chunks[0]);

        let filter = Paragraph::new(Line::from(vec![
            Span::styled("Filter: ", Style::default().fg(Color::Gray)),
            Span::styled(self.query.as_str(), Style::default().fg(Color::White)),
            Span::styled("▏", Style::default().fg(theme::ACCENT)),
        ]))
        .block(Block::default().borders(Borders::ALL).title(" find repo "));
        f.render_widget(filter, chunks[1]);

        self.draw_table(f, chunks[2]);
        self.draw_footer(f, chunks[3]);
    }

    fn draw_table(&self, f: &mut Frame, area: Rect) {
        let header = Row::new(vec!["#", "Repo", "Language", "Description", "Status"])
            .style(theme::header_style());
        let rows = self.filtered.iter().enumerate().map(|(pos, &i)| {
            let r = &self.repos[i];
            let desc: String = r.description.chars().take(40).collect();
            Row::new(vec![
                Cell::from(format!("{:>2}", pos + 1)),
                Cell::from(r.name.clone()).style(Style::default().add_modifier(Modifier::BOLD)),
                Cell::from(r.lang_display().to_string()),
                Cell::from(desc),
                Cell::from(theme::cloned_indicator(r.cloned)),
            ])
        });
        let widths = [
            Constraint::Length(4),
            Constraint::Length(30),
            Constraint::Length(14),
            Constraint::Min(20),
            Constraint::Length(12),
        ];
        let table = Table::new(rows, widths)
            .header(header)
            .row_highlight_style(theme::highlight_style())
            .highlight_symbol("▶ ");
        let mut state = TableState::default();
        if !self.filtered.is_empty() {
            state.select(Some(self.selected));
        }
        f.render_stateful_widget(table, area, &mut state);
    }

    fn draw_footer(&self, f: &mut Frame, area: Rect) {
        let total = self.repos.len();
        let cloned = manifest::cloned_count(&self.repos);
        let mut footer = format!("  {cloned}/{total} repos cloned");
        if let Some(age) = &self.cache_age {
            footer.push_str(&format!("  (cache: {age})"));
        }
        if self.truncated {
            footer.push_str("  [list may be truncated]");
        }
        let help = "  ↑/↓ move · type to filter · Enter clone · Ctrl+R refresh · Esc quit";
        let mut lines = vec![Line::from(Span::styled(footer, theme::footer_style()))];
        if let Some(status) = &self.status {
            lines.push(Line::from(Span::styled(
                format!("  {status}"),
                Style::default().fg(Color::Yellow),
            )));
        } else {
            lines.push(Line::from(Span::styled(
                help,
                Style::default().fg(Color::DarkGray),
            )));
        }
        f.render_widget(Paragraph::new(lines), area);
    }
}
