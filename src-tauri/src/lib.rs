mod clipboard;
mod config;
mod process;
mod terminal;

use config::CloseBehavior;
use tauri::{Manager, WindowEvent};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let close = CloseBehavior::default();

    tauri::Builder::default()
        .manage(terminal::TerminalManager::default())
        .manage(close.clone())
        .on_window_event(move |window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if close.is_tray() {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .setup(|app| {
            let show = MenuItem::with_id(app, "show", "显示主窗口", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;

            TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("TermDeck · 终端管理器")
                .icon(app.default_window_icon().unwrap().clone())
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.unminimize();
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;

            let cfg = config::config_load(app.handle().clone());
            app.state::<CloseBehavior>().set(&cfg.close_action);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            terminal::terminal_create,
            terminal::terminal_attach,
            terminal::terminal_write,
            terminal::terminal_resize,
            terminal::terminal_close,
            terminal::detect_shells,
            process::process_list,
            process::process_kill,
            config::config_load,
            config::config_save,
            clipboard::clipboard_read,
            clipboard::clipboard_write,
        ])
        .run(tauri::generate_context!())
        .expect("error while running TermDeck");
}
