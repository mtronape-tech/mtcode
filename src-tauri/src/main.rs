#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

fn main() {
  // Win7/legacy GPU safety: prevent blank WebView2 surface on problematic drivers.
  #[cfg(target_os = "windows")]
  std::env::set_var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", "--disable-gpu --disable-gpu-compositing");

  tauri::Builder::default()
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
      commands::get_xlsx_info,
      commands::ollama_query,
      commands::ollama_chat,
      commands::ollama_check,
      commands::ollama_is_installed,
      commands::ollama_install,
    ])
    .run(tauri::generate_context!())
    .expect("error while running mtcode");
}
