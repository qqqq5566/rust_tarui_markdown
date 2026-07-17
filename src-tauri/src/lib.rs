mod commands;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{Emitter, Listener, Manager};

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            commands::read_file,
            commands::write_file,
            commands::file_exists,
        ])
        .setup(|app| {
            let close_confirmed = Arc::new(AtomicBool::new(false));
            let window = app.get_webview_window("main").unwrap();

            // 窗口关闭事件处理
            let w = window.clone();
            let cf = close_confirmed.clone();
            window.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    if cf.load(Ordering::SeqCst) {
                        return; // 前端已确认，直接关闭
                    }
                    api.prevent_close();
                    let _ = w.emit("close-requested", ());
                }
            });

            // 监听前端确认关闭
            let w = window.clone();
            window.listen("confirm-close", move |_| {
                close_confirmed.store(true, Ordering::SeqCst);
                let _ = w.close();
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
