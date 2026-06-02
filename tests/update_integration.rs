//! Integration tests for the git update flow against real temp repositories.
//! These exercise `cloner::update_repo` end-to-end (the part string-only tests
//! can't validate): up-to-date detection, fast-forward updates, dirty
//! worktrees, and repos without a local `main`.

use repo_manager::cloner::{update_repo, Outcome};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

fn git(dir: &Path, args: &[&str]) {
    let ok = Command::new("git")
        .current_dir(dir)
        .args(args)
        .output()
        .expect("git should run")
        .status
        .success();
    assert!(ok, "git {args:?} failed in {dir:?}");
}

fn write(path: &Path, content: &str) {
    fs::write(path, content).unwrap();
}

fn unique_dir(tag: &str) -> PathBuf {
    let base = std::env::temp_dir().join(format!("rm-it-{}-{tag}", std::process::id()));
    let _ = fs::remove_dir_all(&base);
    fs::create_dir_all(&base).unwrap();
    base
}

/// Create an "origin" repo with one commit on `default_branch`.
fn init_origin(root: &Path, default_branch: &str) -> PathBuf {
    let origin = root.join("origin");
    fs::create_dir_all(&origin).unwrap();
    git(&origin, &["init", "-q", "-b", default_branch]);
    git(&origin, &["config", "user.email", "t@t.t"]);
    git(&origin, &["config", "user.name", "tester"]);
    write(&origin.join("README.md"), "hello\n");
    git(&origin, &["add", "."]);
    git(&origin, &["commit", "-q", "-m", "init"]);
    origin
}

fn clone_into(root: &Path, origin: &Path, target: &Path, name: &str) {
    let dest = target.join(name);
    git(
        root,
        &["clone", "-q", origin.to_str().unwrap(), dest.to_str().unwrap()],
    );
    git(&dest, &["config", "user.email", "t@t.t"]);
    git(&dest, &["config", "user.name", "tester"]);
}

#[test]
fn up_to_date_then_updated_then_dirty() {
    let root = unique_dir("upd");
    let origin = init_origin(&root, "main");
    let target = root.join("repos");
    fs::create_dir_all(&target).unwrap();
    clone_into(&root, &origin, &target, "proj");
    let clone = target.join("proj");

    // No new commits upstream -> up to date.
    assert_eq!(update_repo("proj", &target).outcome, Outcome::UpToDate);

    // New commit on origin main -> fast-forward update.
    write(&origin.join("CHANGES.md"), "more\n");
    git(&origin, &["add", "."]);
    git(&origin, &["commit", "-q", "-m", "more"]);
    assert_eq!(update_repo("proj", &target).outcome, Outcome::Updated);

    // Dirty worktree -> skipped, not failed.
    write(&clone.join("dirty.txt"), "x\n");
    assert_eq!(update_repo("proj", &target).outcome, Outcome::SkippedDirty);

    let _ = fs::remove_dir_all(&root);
}

#[test]
fn skips_when_no_local_main() {
    let root = unique_dir("nomain");
    let origin = init_origin(&root, "master");
    let target = root.join("repos");
    fs::create_dir_all(&target).unwrap();
    clone_into(&root, &origin, &target, "proj");

    assert_eq!(update_repo("proj", &target).outcome, Outcome::SkippedNoMain);

    let _ = fs::remove_dir_all(&root);
}

#[test]
fn missing_clone_fails() {
    let root = unique_dir("missing");
    let target = root.join("repos");
    fs::create_dir_all(&target).unwrap();
    matches!(
        update_repo("nope", &target).outcome,
        Outcome::Failed(_)
    );
    let _ = fs::remove_dir_all(&root);
}
