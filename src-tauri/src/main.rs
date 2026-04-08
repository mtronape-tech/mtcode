#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

use std::sync::atomic::{AtomicBool, Ordering};

static ALLOW_CLOSE: AtomicBool = AtomicBool::new(false);

fn main() {
  // Win7/legacy GPU safety: prevent blank WebView2 surface on problematic drivers.
  #[cfg(target_os = "windows")]
  std::env::set_var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", "--disable-gpu --disable-gpu-compositing");

  tauri::Builder::default()
    .setup(|app| {
      // Intercept close to check for unsaved changes on JS side.
      // If ALLOW_CLOSE is true (set via JS invoke), let it through.
      // Otherwise prevent default so JS can show the unsaved dialog.
      let window = app.get_window("main").unwrap();
      let win_clone = window.clone();
      window.on_close_requested(move |event| {
        if ALLOW_CLOSE.load(Ordering::SeqCst) {
          return; // allow close
        }
        event.prevent_default();
        // Tell JS to show unsaved dialog
        let _ = win_clone.emit("request-close", ());
      });
      Ok(())
    })
    .manage(commands::AppState::new())
    .invoke_handler(tauri::generate_handler![
      commands::open_file,
      commands::save_file,
      commands::open_project,
      commands::list_dir,
      commands::load_settings,
      commands::save_settings,
      commands::search_project,
      commands::watch_project,
      commands::stop_watch,
      commands::rename_file,
      commands::delete_file,
      commands::move_to_trash,
      commands::create_folder,
      commands::run_kill_script,
      commands::read_file_encoding,
      commands::save_file_encoding,
      allow_close
    ])
    .run(tauri::generate_context!())
    .expect("error while running mtcode");
}

/// Tauri command to allow the window close from JS side
#[tauri::command]
fn allow_close() {
  ALLOW_CLOSE.store(true, Ordering::SeqCst);
}
