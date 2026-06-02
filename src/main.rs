use repo_manager::github::GITHUB_ORG;
use repo_manager::ui::{self, Mode};

fn main() {
    let arg = std::env::args().nth(1);
    let mode = match arg.as_deref() {
        None => Mode::Clone,
        Some("update") => Mode::Update,
        Some("help") | Some("--help") | Some("-h") => {
            print_help();
            return;
        }
        Some(other) => {
            eprintln!("unknown command: {other}\n");
            print_help();
            std::process::exit(2);
        }
    };

    if let Err(e) = ui::run(mode) {
        eprintln!("error: {e}");
        std::process::exit(1);
    }
}

fn print_help() {
    println!("repo-manager — clone & update github.com/{GITHUB_ORG} repos");
    println!();
    println!("USAGE:");
    println!("  make            open the clone menu (list + fuzzy finder)");
    println!("  make update     multi-select update of cloned repos' main branch");
    println!();
    println!("CLONE KEYS:   up/down move · type to filter · Enter clone · Ctrl+R refresh · Esc quit");
    println!("UPDATE KEYS:  up/down move · Space toggle · a select all · Enter update · q cancel");
}
