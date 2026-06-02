use crate::manifest::Repo;
use serde::Deserialize;
use std::fmt;
use std::process::Command;

/// GitHub org this tool operates against.
/// Update this single constant if the company's GitHub org/URL ever changes.
pub const GITHUB_ORG: &str = "vianch";

/// Upper bound on repos fetched in one `gh` call. If exactly this many come
/// back, the list may be truncated (surfaced in the footer).
pub const FETCH_LIMIT: usize = 1000;

#[derive(Debug)]
pub enum GhError {
    NotInstalled,
    NotAuthenticated,
    CommandFailed(String),
    ParseFailed(String),
}

impl fmt::Display for GhError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            GhError::NotInstalled => write!(
                f,
                "GitHub CLI (gh) is required but was not found.\n  Install it:\n    brew install gh\n    gh auth login"
            ),
            GhError::NotAuthenticated => write!(
                f,
                "GitHub CLI is not authenticated.\n  Run:\n    gh auth login"
            ),
            GhError::CommandFailed(msg) => write!(f, "gh command failed: {msg}"),
            GhError::ParseFailed(msg) => write!(f, "could not parse gh output: {msg}"),
        }
    }
}

impl std::error::Error for GhError {}

#[derive(Deserialize)]
struct GhLang {
    name: String,
}

#[derive(Deserialize)]
struct GhRepo {
    name: String,
    #[serde(default)]
    description: String,
    #[serde(rename = "primaryLanguage")]
    primary_language: Option<GhLang>,
    #[serde(rename = "updatedAt")]
    updated_at: Option<String>,
    #[serde(rename = "sshUrl")]
    ssh_url: String,
}

/// Result of a fetch: the repos plus whether the list may be truncated.
pub struct Fetched {
    pub repos: Vec<Repo>,
    pub truncated: bool,
}

fn gh_installed() -> bool {
    Command::new("gh")
        .arg("--version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

fn gh_authenticated() -> bool {
    Command::new("gh")
        .args(["auth", "status"])
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

/// Fetch the org's repos via `gh repo list`.
pub fn fetch() -> Result<Fetched, GhError> {
    if !gh_installed() {
        return Err(GhError::NotInstalled);
    }
    if !gh_authenticated() {
        return Err(GhError::NotAuthenticated);
    }

    let limit = FETCH_LIMIT.to_string();
    let output = Command::new("gh")
        .args([
            "repo",
            "list",
            GITHUB_ORG,
            "--limit",
            &limit,
            "--json",
            "name,description,primaryLanguage,updatedAt,sshUrl",
        ])
        .output()
        .map_err(|e| GhError::CommandFailed(e.to_string()))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(GhError::CommandFailed(stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let repos = parse_repos(&stdout).map_err(|e| GhError::ParseFailed(e.to_string()))?;
    let truncated = repos.len() == FETCH_LIMIT;
    Ok(Fetched { repos, truncated })
}

/// Parse `gh repo list --json ...` output into `Repo`s sorted most-recent-first.
/// Pure (no I/O) so it can be unit-tested.
pub fn parse_repos(json: &str) -> Result<Vec<Repo>, serde_json::Error> {
    let raw: Vec<GhRepo> = serde_json::from_str(json)?;
    let mut repos: Vec<Repo> = raw
        .into_iter()
        .map(|r| Repo {
            name: r.name,
            description: r.description,
            primary_lang: r.primary_language.map(|l| l.name),
            updated_at: r.updated_at,
            ssh_url: r.ssh_url,
            cloned: false,
        })
        .collect();
    // Most recently updated first; missing timestamps sort last.
    // gh emits normalized RFC3339 UTC ("...Z"), so lexicographic order is valid.
    repos.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(repos)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_and_sorts_by_updated_desc() {
        let json = r#"[
          {"name":"old","description":"o","primaryLanguage":{"name":"Go"},"updatedAt":"2023-01-01T00:00:00Z","sshUrl":"git@github.com:vianch/old.git"},
          {"name":"new","description":"","primaryLanguage":null,"updatedAt":"2024-06-01T00:00:00Z","sshUrl":"git@github.com:vianch/new.git"}
        ]"#;
        let repos = parse_repos(json).unwrap();
        assert_eq!(repos[0].name, "new");
        assert_eq!(repos[1].name, "old");
        assert_eq!(repos[0].lang_display(), "—");
        assert_eq!(repos[1].lang_display(), "Go");
    }

    #[test]
    fn missing_updated_at_sorts_last() {
        let json = r#"[
          {"name":"nodate","description":"","primaryLanguage":null,"updatedAt":null,"sshUrl":"x"},
          {"name":"dated","description":"","primaryLanguage":null,"updatedAt":"2024-01-01T00:00:00Z","sshUrl":"y"}
        ]"#;
        let repos = parse_repos(json).unwrap();
        assert_eq!(repos[0].name, "dated");
        assert_eq!(repos[1].name, "nodate");
    }

    #[test]
    fn empty_list_is_ok() {
        assert!(parse_repos("[]").unwrap().is_empty());
    }
}
