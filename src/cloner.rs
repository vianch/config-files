use std::io;
use std::path::Path;
use std::process::{Command, Stdio};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Outcome {
    Cloned,
    Updated,
    UpToDate,
    SkippedDirty,
    SkippedNoMain,
    Failed(String),
}

#[derive(Debug, Clone)]
pub struct OpResult {
    pub name: String,
    pub outcome: Outcome,
}

/// `git clone` argv (pure, so it can be unit-tested).
pub fn clone_args(ssh_url: &str, dest: &str) -> Vec<String> {
    vec!["clone".into(), ssh_url.into(), dest.into()]
}

/// Run git capturing output — for quick, non-interactive queries.
fn git_capture(args: &[&str]) -> io::Result<(bool, String, String)> {
    let out = Command::new("git").args(args).output()?;
    Ok((
        out.status.success(),
        String::from_utf8_lossy(&out.stdout).to_string(),
        String::from_utf8_lossy(&out.stderr).to_string(),
    ))
}

/// Run git with inherited stdio so the user sees progress and can answer
/// SSH/passphrase/host-key prompts. The caller must have released the TUI first.
fn git_inherit(args: &[&str]) -> io::Result<bool> {
    let status = Command::new("git")
        .args(args)
        .stdin(Stdio::inherit())
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .status()?;
    Ok(status.success())
}

/// Clone a repo into `<target_dir>/<name>`.
pub fn clone_repo(name: &str, ssh_url: &str, target_dir: &Path) -> OpResult {
    let dest = target_dir.join(name);
    if dest.join(".git").is_dir() {
        return res(name, Outcome::Failed("already cloned".into()));
    }
    if dest.exists() {
        return res(
            name,
            Outcome::Failed("target path exists and is not a git repo".into()),
        );
    }
    let dest_str = dest.to_string_lossy().to_string();
    let args = clone_args(ssh_url, &dest_str);
    let argv: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    match git_inherit(&argv) {
        Ok(true) => res(name, Outcome::Cloned),
        Ok(false) => res(name, Outcome::Failed("git clone failed (see output above)".into())),
        Err(e) => res(name, Outcome::Failed(e.to_string())),
    }
}

/// Update a cloned repo's `main` branch to the latest (fast-forward only).
/// Dirty worktrees and repos without a local `main` are skipped distinctly,
/// not collapsed into a generic failure.
pub fn update_repo(name: &str, target_dir: &Path) -> OpResult {
    let repo_path = target_dir.join(name);
    let dir = repo_path.to_string_lossy().to_string();
    if !repo_path.join(".git").is_dir() {
        return res(name, Outcome::Failed("not cloned".into()));
    }

    // Dirty worktree?
    match git_capture(&["-C", &dir, "status", "--porcelain"]) {
        Ok((true, stdout, _)) if !stdout.trim().is_empty() => {
            return res(name, Outcome::SkippedDirty)
        }
        Ok((true, _, _)) => {}
        Ok((false, _, stderr)) => return res(name, Outcome::Failed(short(&stderr))),
        Err(e) => return res(name, Outcome::Failed(e.to_string())),
    }

    // Local `main` exists?
    match git_capture(&["-C", &dir, "rev-parse", "--verify", "--quiet", "refs/heads/main"]) {
        Ok((true, _, _)) => {}
        Ok((false, _, _)) => return res(name, Outcome::SkippedNoMain),
        Err(e) => return res(name, Outcome::Failed(e.to_string())),
    }

    let before = rev_of_main(&dir);
    for args in [
        vec!["-C", &dir, "checkout", "main"],
        vec!["-C", &dir, "fetch", "origin", "main"],
        vec!["-C", &dir, "pull", "--ff-only", "origin", "main"],
    ] {
        match git_inherit(&args) {
            Ok(true) => {}
            Ok(false) => return res(name, Outcome::Failed("git update failed (see output above)".into())),
            Err(e) => return res(name, Outcome::Failed(e.to_string())),
        }
    }
    let after = rev_of_main(&dir);

    if before.is_some() && before == after {
        res(name, Outcome::UpToDate)
    } else {
        res(name, Outcome::Updated)
    }
}

fn rev_of_main(dir: &str) -> Option<String> {
    match git_capture(&["-C", dir, "rev-parse", "main"]) {
        Ok((true, stdout, _)) => Some(stdout.trim().to_string()),
        _ => None,
    }
}

fn res(name: &str, outcome: Outcome) -> OpResult {
    OpResult {
        name: name.to_string(),
        outcome,
    }
}

fn short(stderr: &str) -> String {
    stderr.lines().last().unwrap_or("").trim().to_string()
}

/// Counts by outcome category for the summary header.
pub struct Counts {
    pub cloned: usize,
    pub updated: usize,
    pub up_to_date: usize,
    pub skipped: usize,
    pub failed: usize,
}

pub fn tally(results: &[OpResult]) -> Counts {
    let mut c = Counts {
        cloned: 0,
        updated: 0,
        up_to_date: 0,
        skipped: 0,
        failed: 0,
    };
    for r in results {
        match r.outcome {
            Outcome::Cloned => c.cloned += 1,
            Outcome::Updated => c.updated += 1,
            Outcome::UpToDate => c.up_to_date += 1,
            Outcome::SkippedDirty | Outcome::SkippedNoMain => c.skipped += 1,
            Outcome::Failed(_) => c.failed += 1,
        }
    }
    c
}

/// Print the Ruby-style batch summary to the (restored) terminal.
pub fn print_summary(results: &[OpResult]) {
    const GREEN: &str = "\x1b[32m";
    const CYAN: &str = "\x1b[36m";
    const YELLOW: &str = "\x1b[33m";
    const RED: &str = "\x1b[31m";
    const GRAY: &str = "\x1b[90m";
    const RESET: &str = "\x1b[0m";

    let c = tally(results);
    println!();
    println!(
        "  {CYAN}Summary:{RESET} {} updated, {} up-to-date, {} skipped, {} failed",
        c.updated, c.up_to_date, c.skipped, c.failed
    );
    for r in results {
        let (sym, color, label) = match &r.outcome {
            Outcome::Cloned => ("✓", GREEN, "cloned".to_string()),
            Outcome::Updated => ("✓", GREEN, "updated".to_string()),
            Outcome::UpToDate => ("=", GRAY, "up to date".to_string()),
            Outcome::SkippedDirty => ("⊘", YELLOW, "skipped (dirty worktree)".to_string()),
            Outcome::SkippedNoMain => ("⊘", YELLOW, "skipped (no main branch)".to_string()),
            Outcome::Failed(msg) => ("✗", RED, format!("failed: {msg}")),
        };
        println!("  {color}{sym}{RESET} {:<28} {GRAY}{label}{RESET}", r.name);
    }
    println!();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clone_args_shape() {
        let a = clone_args("git@github.com:vianch/x.git", "repos/x");
        assert_eq!(a, vec!["clone", "git@github.com:vianch/x.git", "repos/x"]);
    }

    #[test]
    fn tally_categorizes() {
        let results = vec![
            OpResult { name: "a".into(), outcome: Outcome::Updated },
            OpResult { name: "b".into(), outcome: Outcome::UpToDate },
            OpResult { name: "c".into(), outcome: Outcome::SkippedDirty },
            OpResult { name: "d".into(), outcome: Outcome::SkippedNoMain },
            OpResult { name: "e".into(), outcome: Outcome::Failed("x".into()) },
            OpResult { name: "f".into(), outcome: Outcome::Cloned },
        ];
        let c = tally(&results);
        assert_eq!(c.updated, 1);
        assert_eq!(c.up_to_date, 1);
        assert_eq!(c.skipped, 2);
        assert_eq!(c.failed, 1);
        assert_eq!(c.cloned, 1);
    }
}
