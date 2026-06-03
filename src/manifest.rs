use serde::{Deserialize, Serialize};
use std::path::Path;

/// A repository as listed by `gh`, enriched with local clone status.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Repo {
    pub name: String,
    #[serde(default)]
    pub description: String,
    pub primary_lang: Option<String>,
    pub updated_at: Option<String>,
    pub ssh_url: String,
    /// Computed live from the filesystem; never read from cache.
    #[serde(skip)]
    pub cloned: bool,
}

impl Repo {
    pub fn lang_display(&self) -> &str {
        self.primary_lang.as_deref().unwrap_or("—")
    }
}

/// Set `cloned = true` when `<target_dir>/<name>/.git` is a directory.
pub fn enrich_with_clone_status(repos: &mut [Repo], target_dir: &Path) {
    for repo in repos.iter_mut() {
        let git_dir = target_dir.join(&repo.name).join(".git");
        repo.cloned = git_dir.is_dir();
    }
}

pub fn cloned_count(repos: &[Repo]) -> usize {
    repos.iter().filter(|r| r.cloned).count()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lang_display_falls_back() {
        let mut r = Repo {
            name: "x".into(),
            description: String::new(),
            primary_lang: None,
            updated_at: None,
            ssh_url: String::new(),
            cloned: false,
        };
        assert_eq!(r.lang_display(), "—");
        r.primary_lang = Some("Rust".into());
        assert_eq!(r.lang_display(), "Rust");
    }

    #[test]
    fn enrichment_detects_git_dir() {
        let tmp = std::env::temp_dir().join(format!("rm-manifest-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&tmp);
        std::fs::create_dir_all(tmp.join("cloned").join(".git")).unwrap();
        std::fs::create_dir_all(tmp.join("plaindir")).unwrap();
        let mut repos = vec![
            mk("cloned"),
            mk("plaindir"),
            mk("absent"),
        ];
        enrich_with_clone_status(&mut repos, &tmp);
        assert!(repos[0].cloned, "git dir -> cloned");
        assert!(!repos[1].cloned, "non-git dir -> not cloned");
        assert!(!repos[2].cloned, "absent -> not cloned");
        assert_eq!(cloned_count(&repos), 1);
        let _ = std::fs::remove_dir_all(&tmp);
    }

    fn mk(name: &str) -> Repo {
        Repo {
            name: name.into(),
            description: String::new(),
            primary_lang: None,
            updated_at: None,
            ssh_url: String::new(),
            cloned: false,
        }
    }
}
