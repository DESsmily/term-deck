//! Persistent app configuration and the window close behaviour.
//!
//! Config lives in `termdeck.json` next to the executable so the app is fully
//! portable ("数据保存在安装目录"). If that directory is read-only (e.g. Program
//! Files without elevation) we fall back to the platform app-data directory.

use std::fs;
use std::path::PathBuf;
use std::sync::Arc;

use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase", default)]
pub struct AppConfig {
    pub windows_shell: String,
    pub mac_shell: String,
    /// "tray" | "quit"
    pub close_action: String,
    /// "dark" | "light"
    pub theme: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        AppConfig {
            windows_shell: "powershell".into(),
            mac_shell: "zsh".into(),
            close_action: "tray".into(),
            theme: "dark".into(),
        }
    }
}

/// Shared close behaviour read by the window-close handler.
#[derive(Clone, Default)]
pub struct CloseBehavior(Arc<Mutex<String>>);

impl CloseBehavior {
    pub fn set(&self, mode: &str) {
        *self.0.lock() = mode.to_string();
    }
    pub fn is_tray(&self) -> bool {
        self.0.lock().as_str() != "quit"
    }
}

fn exe_dir() -> Option<PathBuf> {
    std::env::current_exe().ok().and_then(|p| {
        p.parent().map(|d| d.to_path_buf())
    })
}

fn read_paths(app: &AppHandle) -> Vec<PathBuf> {
    let mut v = Vec::new();
    if let Some(d) = exe_dir() {
        v.push(d.join("termdeck.json"));
    }
    if let Ok(d) = app.path().app_data_dir() {
        v.push(d.join("termdeck.json"));
    }
    v
}

#[tauri::command]
pub fn config_load(app: AppHandle) -> AppConfig {
    for path in read_paths(&app) {
        if let Ok(text) = fs::read_to_string(path) {
            if let Ok(cfg) = serde_json::from_str::<AppConfig>(&text) {
                return cfg;
            }
        }
    }
    AppConfig::default()
}

#[tauri::command]
pub fn config_save(
    app: AppHandle,
    behavior: State<'_, CloseBehavior>,
    config: AppConfig,
) -> Result<(), String> {
    behavior.set(&config.close_action);
    let json = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;

    if let Some(dir) = exe_dir() {
        if fs::create_dir_all(&dir).is_ok() && fs::write(dir.join("termdeck.json"), &json).is_ok()
        {
            return Ok(());
        }
    }
    if let Ok(dir) = app.path().app_data_dir() {
        let _ = fs::create_dir_all(&dir);
        fs::write(dir.join("termdeck.json"), json).map_err(|e| e.to_string())?;
    }
    Ok(())
}
