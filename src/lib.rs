//! repo-manager — a small TUI for cloning and updating repos from a single
//! GitHub org. The binary (`src/main.rs`) is a thin shell over these modules;
//! exposing them as a library lets the git flows be integration-tested.

pub mod banner;
pub mod cache;
pub mod cloner;
pub mod data;
pub mod github;
pub mod manifest;
pub mod term;
pub mod ui;
