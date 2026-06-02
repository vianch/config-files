use crate::cache;
use crate::github::{self, GhError};
use crate::manifest::{self, Repo};
use std::path::Path;

/// Local directory cloned repos live in (gitignored).
pub const TARGET_DIR: &str = "repos";

pub struct Loaded {
    pub repos: Vec<Repo>,
    pub cache_age: Option<String>,
    pub truncated: bool,
}

/// Load repos: from cache unless `force`, otherwise fetch via gh and rewrite the
/// cache. Always enriches with live clone status.
pub fn load_repos(force: bool) -> Result<Loaded, GhError> {
    let target = Path::new(TARGET_DIR);

    if !force {
        if let Some(mut repos) = cache::load() {
            manifest::enrich_with_clone_status(&mut repos, target);
            return Ok(Loaded {
                repos,
                cache_age: cache::age_display(),
                truncated: false,
            });
        }
    }

    let fetched = github::fetch()?;
    let mut repos = fetched.repos;
    // Best-effort cache write; a write failure shouldn't block usage.
    let _ = cache::write(&repos);
    manifest::enrich_with_clone_status(&mut repos, target);
    Ok(Loaded {
        repos,
        cache_age: cache::age_display(),
        truncated: fetched.truncated,
    })
}
