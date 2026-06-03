use crate::banner;
use crate::cloner::{self, Outcome};
use crate::data::{self, TARGET_DIR};
use crate::term;
use crate::ui::clone_view::{self, ClonePage};
use crate::ui::update_view::{self, UpdatePage};
use ratatui::crossterm::event::{self, Event, KeyEventKind};
use ratatui::DefaultTerminal;
use std::io;
use std::path::Path;
use std::time::Duration;

const POLL: Duration = Duration::from_millis(250);

pub enum Mode {
    Clone,
    Update,
}

pub fn run(mode: Mode) -> io::Result<()> {
    match mode {
        Mode::Clone => run_clone(),
        Mode::Update => run_update(),
    }
}

/// Load repos before entering the TUI; a gh failure prints actionable
/// instructions and exits rather than dropping into an empty screen.
fn load_or_exit(force: bool) -> data::Loaded {
    match data::load_repos(force) {
        Ok(loaded) => loaded,
        Err(e) => {
            eprintln!("\n  {e}\n");
            std::process::exit(1);
        }
    }
}

fn run_clone() -> io::Result<()> {
    let loaded = load_or_exit(false);
    let mut page = ClonePage::new(loaded.repos, loaded.cache_age, loaded.truncated);

    let mut terminal = term::init()?;
    let result = clone_loop(&mut terminal, &mut page);
    term::restore()?;
    result
}

fn clone_loop(terminal: &mut DefaultTerminal, page: &mut ClonePage) -> io::Result<()> {
    loop {
        terminal.draw(|f| page.draw(f))?;

        if !event::poll(POLL)? {
            continue;
        }
        let Event::Key(key) = event::read()? else {
            continue;
        };
        if key.kind != KeyEventKind::Press {
            continue;
        }

        match page.on_key(key) {
            clone_view::Action::Quit => return Ok(()),
            clone_view::Action::None => {}
            clone_view::Action::Refresh => {
                let loaded = term::released(terminal, || {
                    println!("Refreshing repo list from GitHub...");
                    data::load_repos(true)
                })?;
                match loaded {
                    Ok(l) => page.set_repos(l.repos, l.cache_age, l.truncated),
                    Err(e) => page.set_status(format!("refresh failed: {e}")),
                }
            }
            clone_view::Action::Clone { name, ssh_url } => {
                let result = term::released(terminal, || {
                    println!("Cloning {name} into {TARGET_DIR}/{name} ...");
                    cloner::clone_repo(&name, &ssh_url, Path::new(TARGET_DIR))
                })?;
                match &result.outcome {
                    Outcome::Cloned => {
                        page.mark_cloned(&name);
                        page.set_status(format!("cloned {name}"));
                    }
                    Outcome::Failed(msg) => page.set_status(format!("clone failed: {msg}")),
                    _ => {}
                }
            }
        }
    }
}

fn run_update() -> io::Result<()> {
    let loaded = load_or_exit(false);
    let cloned: Vec<_> = loaded.repos.into_iter().filter(|r| r.cloned).collect();

    if cloned.is_empty() {
        for line in banner::ART {
            println!("{line}");
        }
        println!("\n  No cloned repos found in {TARGET_DIR}/.");
        println!("  Run `make` to clone some first.\n");
        return Ok(());
    }

    let mut page = UpdatePage::new(cloned);
    let mut terminal = term::init()?;
    let selected = update_loop(&mut terminal, &mut page);
    term::restore()?;
    let selected = selected?;

    if selected.is_empty() {
        println!("\n  No repos selected.\n");
        return Ok(());
    }

    println!("\n  Updating main branches of {} repos...\n", selected.len());
    let target = Path::new(TARGET_DIR);
    let mut results = Vec::new();
    for name in &selected {
        println!("  → {name}");
        results.push(cloner::update_repo(name, target));
    }
    cloner::print_summary(&results);
    Ok(())
}

fn update_loop(terminal: &mut DefaultTerminal, page: &mut UpdatePage) -> io::Result<Vec<String>> {
    loop {
        terminal.draw(|f| page.draw(f))?;

        if !event::poll(POLL)? {
            continue;
        }
        let Event::Key(key) = event::read()? else {
            continue;
        };
        if key.kind != KeyEventKind::Press {
            continue;
        }

        match page.on_key(key) {
            update_view::Action::Cancel => return Ok(Vec::new()),
            update_view::Action::Confirm => return Ok(page.selected_names()),
            update_view::Action::None => {}
        }
    }
}
