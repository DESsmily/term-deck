//! System clipboard bridge for the terminal panes.
//!
//! The webview's own Clipboard API is gated behind focus + permissions that
//! WebView2 does not reliably grant, so copy/paste go through the native
//! clipboard here instead. A fresh `Clipboard` per call is intentional: arboard's
//! handle is not `Sync`, and these commands run on Tauri's async thread pool.

use arboard::Clipboard;

#[tauri::command]
pub fn clipboard_read() -> Result<String, String> {
    Clipboard::new()
        .and_then(|mut c| c.get_text())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn clipboard_write(text: String) -> Result<(), String> {
    Clipboard::new()
        .and_then(|mut c| c.set_text(text))
        .map_err(|e| e.to_string())
}
