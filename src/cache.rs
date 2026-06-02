use crate::manifest::Repo;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

const CACHE_DIR: &str = ".cache";
const CACHE_FILE: &str = "repos.json";

fn cache_path() -> PathBuf {
    Path::new(CACHE_DIR).join(CACHE_FILE)
}

/// Load the cached repo list. Returns `None` if absent or unparseable so the
/// caller refetches — a corrupt cache never bricks startup.
pub fn load() -> Option<Vec<Repo>> {
    let data = fs::read_to_string(cache_path()).ok()?;
    serde_json::from_str(&data).ok()
}

/// Write the repo list atomically (temp file + rename).
pub fn write(repos: &[Repo]) -> io::Result<()> {
    fs::create_dir_all(CACHE_DIR)?;
    let json = serde_json::to_string_pretty(repos).map_err(io::Error::other)?;
    let final_path = cache_path();
    let tmp_path = final_path.with_extension("json.tmp");
    fs::write(&tmp_path, json)?;
    fs::rename(&tmp_path, &final_path)?;
    Ok(())
}

/// Age of the cache file, if present. Clock skew (future mtime) clamps to zero.
pub fn age() -> Option<Duration> {
    let meta = fs::metadata(cache_path()).ok()?;
    let modified = meta.modified().ok()?;
    Some(SystemTime::now().duration_since(modified).unwrap_or(Duration::ZERO))
}

/// Human-friendly cache age, e.g. "3m", "2h", "5d".
pub fn age_display() -> Option<String> {
    age().map(|d| format_age(d.as_secs()))
}

pub fn format_age(secs: u64) -> String {
    if secs < 60 {
        format!("{secs}s")
    } else if secs < 3600 {
        format!("{}m", secs / 60)
    } else if secs < 86400 {
        format!("{}h", secs / 3600)
    } else {
        format!("{}d", secs / 86400)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn age_formatting_boundaries() {
        assert_eq!(format_age(0), "0s");
        assert_eq!(format_age(59), "59s");
        assert_eq!(format_age(60), "1m");
        assert_eq!(format_age(3599), "59m");
        assert_eq!(format_age(3600), "1h");
        assert_eq!(format_age(86399), "23h");
        assert_eq!(format_age(86400), "1d");
        assert_eq!(format_age(172800), "2d");
    }
}
