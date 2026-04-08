use encoding_rs::WINDOWS_1251;
use notify::{EventKind, RecursiveMode, Watcher};
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader, Read};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::Manager;
use walkdir::WalkDir;

// ── Event names ──────────────────────────────────────────────────────────────

const SEARCH_EVENT_NAME: &str = "project-search-progress";
/// Emit a batch after this many hits (keeps IPC overhead low for large results)
const SEARCH_BATCH_SIZE: usize = 50;
/// Emit the very first hit immediately so the UI can navigate without waiting
const SEARCH_FIRST_EMIT: usize = 1;
const FILE_CHANGED_EVENT: &str = "file-changed";

/// Directories that should never be searched (build artefacts, VCS, caches…)
const SKIP_DIRS: &[&str] = &[
  "node_modules", ".git", ".svn", ".hg",
  "target",                          // Rust/Maven
  "dist", "build", "out", ".next", ".nuxt", ".svelte-kit",
  ".cache", ".parcel-cache", ".turbo",
  "__pycache__", ".tox", ".venv", "venv", "env",
  "vendor",                          // Go / PHP
  ".idea", ".vscode",
  "coverage", ".nyc_output",
];

// ── Shared app state (watcher + skip list) ───────────────────────────────────

/// Paths written by save_file within the last N seconds are suppressed in the
/// watcher callback so we don't false-trigger "external change" on our own saves.
pub struct AppState {
  pub watcher: Mutex<Option<notify::RecommendedWatcher>>,
  pub skip_next: Arc<Mutex<HashMap<PathBuf, Instant>>>,
}

impl AppState {
  pub fn new() -> Self {
    AppState {
      watcher: Mutex::new(None),
      skip_next: Arc::new(Mutex::new(HashMap::new())),
    }
  }
}

// ── IPC payload types ─────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileOpenResult {
  pub path: String,
  pub content: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectOpenResult {
  pub root_path: String,
  pub entries: Vec<ProjectEntry>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListDirResult {
  pub path: String,
  pub entries: Vec<ProjectEntry>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectEntry {
  pub name: String,
  pub path: String,
  pub is_dir: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveFileRequest {
  pub path: String,
  pub content: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchProjectRequest {
  pub root_path: String,
  pub query: String,
  #[serde(default)] pub case_sensitive: bool,
  #[serde(default)] pub whole_word: bool,
  #[serde(default)] pub use_regex: bool,
  #[serde(default)] pub invert_match: bool,
  /// Encoding filters: true = include files with this encoding. If ALL are true → no filtering.
  #[serde(default = "bool_true")] pub enc_utf8: bool,
  #[serde(default = "bool_true")] pub enc_ansi: bool,
  #[serde(default = "bool_true")] pub enc_ascii: bool,
  #[serde(default = "bool_true")] pub enc_utf16: bool,
  pub max_results: Option<usize>,
}
fn bool_true() -> bool { true }

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SearchHit {
  pub path: String,
  pub line: usize,
  pub column: usize,
  pub preview: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SearchProgressEvent {
  pub request_id: String,
  pub hits: Vec<SearchHit>,
  pub scanned_files: usize,
  pub total_hits: usize,
  pub done: bool,
  pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
  pub autosave_mode: String,
  pub autosave_delay_ms: u64,
  pub theme_id: String,
  #[serde(default = "default_font_size")]
  pub font_size: u32,
  #[serde(default = "default_tab_size")]
  pub tab_size: u32,
  #[serde(default = "default_word_wrap")]
  pub word_wrap: String,
  /// Custom keybindings: action name → binding string (e.g. "Ctrl+S").
  /// Missing keys fall back to frontend defaults.
  #[serde(default)]
  pub hotkeys: HashMap<String, String>,
  /// Whether project-search file groups start collapsed (true) or expanded (false).
  #[serde(default)]
  pub search_collapsed_by_default: bool,
  /// PLC rainbow block highlighting enabled/disabled.
  #[serde(default = "default_plc_rainbow_enabled")]
  pub plc_rainbow_enabled: bool,
  /// 10 hex color strings for PLC rainbow nesting levels 0-9 (e.g. "#FF5F5F").
  /// Missing entries fall back to frontend defaults.
  #[serde(default)]
  pub plc_rainbow_colors: Vec<String>,
}

fn default_font_size() -> u32 { 13 }
fn default_tab_size() -> u32 { 4 }
fn default_word_wrap() -> String { "off".to_string() }
fn default_plc_rainbow_enabled() -> bool { true }

/// Emitted by the file watcher when a file changes outside the editor.
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileChangedEvent {
  pub path: String,
}

// ── Commands ──────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn open_file(path: String) -> Result<FileOpenResult, String> {
  let bytes = fs::read(&path).map_err(|e| format!("read failed for {}: {}", path, e))?;
  let content = decode_text_content(&bytes);
  Ok(FileOpenResult { path, content })
}

/// save_file — writes to disk and records the path in skip_next so the watcher
/// won't fire a false "external change" notification for our own save.
#[tauri::command]
pub fn save_file(
  state: tauri::State<AppState>,
  request: SaveFileRequest,
) -> Result<(), String> {
  fs::write(&request.path, &request.content)
    .map_err(|e| format!("write failed for {}: {}", request.path, e))?;

  if let Ok(mut map) = state.skip_next.lock() {
    map.insert(PathBuf::from(&request.path), Instant::now());
  }

  Ok(())
}

#[tauri::command]
pub fn open_project(root_path: String) -> Result<ProjectOpenResult, String> {
  let root = PathBuf::from(&root_path);
  if !root.exists() {
    return Err(format!("project path does not exist: {}", root_path));
  }

  let entries = list_dir_entries(&root)?;
  Ok(ProjectOpenResult { root_path, entries })
}

#[tauri::command]
pub fn list_dir(path: String) -> Result<ListDirResult, String> {
  let dir = PathBuf::from(&path);
  if !dir.exists() {
    return Err(format!("directory does not exist: {}", path));
  }
  if !dir.is_dir() {
    return Err(format!("path is not a directory: {}", path));
  }

  let entries = list_dir_entries(&dir)?;
  Ok(ListDirResult { path, entries })
}

#[tauri::command]
pub fn load_settings() -> Result<AppSettings, String> {
  let settings_path = settings_file_path()?;
  if !settings_path.exists() {
    return Ok(default_settings());
  }

  let raw = fs::read_to_string(&settings_path)
    .map_err(|e| format!("failed to read settings {}: {}", settings_path.display(), e))?;

  let parsed: AppSettings = serde_json::from_str(&raw)
    .map_err(|e| format!("failed to parse settings {}: {}", settings_path.display(), e))?;

  Ok(parsed)
}

#[tauri::command]
pub fn save_settings(settings: AppSettings) -> Result<(), String> {
  let settings_path = settings_file_path()?;
  let dir = settings_path
    .parent()
    .ok_or_else(|| "invalid settings path".to_string())?;

  fs::create_dir_all(dir)
    .map_err(|e| format!("failed to create settings directory {}: {}", dir.display(), e))?;

  let data = serde_json::to_string_pretty(&settings)
    .map_err(|e| format!("failed to serialize settings: {}", e))?;

  fs::write(&settings_path, data)
    .map_err(|e| format!("failed to write settings {}: {}", settings_path.display(), e))
}

#[tauri::command]
pub fn search_project(
  app: tauri::AppHandle,
  request: SearchProjectRequest,
) -> Result<String, String> {
  let root = PathBuf::from(&request.root_path);
  if !root.exists() || !root.is_dir() {
    return Err(format!("invalid project root: {}", request.root_path));
  }

  let query = request.query.trim().to_string();
  if query.is_empty() {
    return Err("search query is empty".to_string());
  }

  let request_id = new_request_id();
  let worker_request_id = request_id.clone();
  let app_handle = app.clone();

  // Build regex matcher (or plain string) based on options
  let regex_matcher: Option<Regex> = if request.use_regex {
    let flags = if request.case_sensitive { "" } else { "(?i)" };
    let pattern = if request.whole_word {
      format!("{}\\b(?:{})\\b", flags, query)
    } else {
      format!("{}{}", flags, query)
    };
    match Regex::new(&pattern) {
      Ok(re) => Some(re),
      Err(e) => {
        emit_search_progress(&app_handle, SearchProgressEvent {
          request_id: request_id.clone(), hits: vec![], scanned_files: 0,
          total_hits: 0, done: true, error: Some(format!("invalid regex: {}", e)),
        });
        return Ok(request_id);
      }
    }
  } else {
    None
  };

  let query_norm = if request.case_sensitive || request.use_regex {
    query.clone()
  } else {
    query.to_lowercase()
  };

  let all_encodings = request.enc_utf8 && request.enc_ansi && request.enc_ascii && request.enc_utf16;

  thread::spawn(move || {
    let mut batch: Vec<SearchHit> = Vec::with_capacity(SEARCH_BATCH_SIZE);
    let mut scanned_files = 0usize;
    let mut total_hits = 0usize;
    let max_results = request.max_results.unwrap_or(5000).max(1);

    let walker = WalkDir::new(&root)
      .follow_links(false)
      .into_iter()
      .filter_entry(|e| {
        if e.depth() == 0 { return true; }
        let name = e.file_name().to_string_lossy();
        if e.file_type().is_dir() {
          if name.starts_with('.') { return false; }
          if SKIP_DIRS.contains(&name.as_ref()) { return false; }
        }
        true
      });

    for entry in walker.filter_map(Result::ok) {
      let path = entry.path();
      if !entry.file_type().is_file() { continue; }

      // Encoding filter (skip detection when all encodings are selected)
      if !all_encodings {
        let enc = detect_encoding(path);
        let include = match enc {
          FileEncoding::Utf16  => request.enc_utf16,
          FileEncoding::Ascii  => request.enc_ascii,
          FileEncoding::Utf8   => request.enc_utf8,
          FileEncoding::Ansi   => request.enc_ansi,
          FileEncoding::Unknown => true,
        };
        if !include { continue; }
      }

      scanned_files += 1;
      let file = match fs::File::open(path) { Ok(f) => f, Err(_) => continue };
      let reader = BufReader::new(file);
      let path_str = path.to_string_lossy().to_string();

      if request.invert_match {
        // Invert mode: emit the file only if it contains NO matches
        let mut found = false;
        let mut first_line = String::new();
        for (idx, line_result) in reader.lines().enumerate() {
          let line = match line_result { Ok(l) => l, Err(_) => break };
          if idx == 0 { first_line = line.chars().take(220).collect(); }
          if line_matches(&line, &query_norm, &regex_matcher, request.case_sensitive, request.whole_word) {
            found = true;
            break;
          }
        }
        if !found {
          total_hits += 1;
          batch.push(SearchHit { path: path_str, line: 1, column: 1, preview: first_line });
          let flush = total_hits <= SEARCH_FIRST_EMIT || batch.len() >= SEARCH_BATCH_SIZE;
          if flush {
            emit_search_progress(&app_handle, SearchProgressEvent {
              request_id: worker_request_id.clone(), hits: std::mem::take(&mut batch),
              scanned_files, total_hits, done: false, error: None,
            });
          }
          if total_hits >= max_results {
            emit_search_progress(&app_handle, SearchProgressEvent {
              request_id: worker_request_id.clone(), hits: std::mem::take(&mut batch),
              scanned_files, total_hits, done: true, error: None,
            });
            return;
          }
        }
      } else {
        // Normal mode: emit each matching line
        for (line_idx, line_result) in reader.lines().enumerate() {
          let line = match line_result { Ok(l) => l, Err(_) => break };
          if let Some(byte_idx) = match_byte_offset(&line, &query_norm, &regex_matcher, request.case_sensitive, request.whole_word) {
            total_hits += 1;
            let preview = line.chars().take(220).collect::<String>();
            batch.push(SearchHit { path: path_str.clone(), line: line_idx + 1, column: byte_idx + 1, preview });

            let flush = total_hits <= SEARCH_FIRST_EMIT || batch.len() >= SEARCH_BATCH_SIZE;
            if flush {
              emit_search_progress(&app_handle, SearchProgressEvent {
                request_id: worker_request_id.clone(), hits: std::mem::take(&mut batch),
                scanned_files, total_hits, done: false, error: None,
              });
            }
            if total_hits >= max_results {
              emit_search_progress(&app_handle, SearchProgressEvent {
                request_id: worker_request_id.clone(), hits: std::mem::take(&mut batch),
                scanned_files, total_hits, done: true, error: None,
              });
              return;
            }
          }
        }
      }
    }

    emit_search_progress(
      &app_handle,
      SearchProgressEvent {
        request_id: worker_request_id.clone(),
        hits: batch,
        scanned_files,
        total_hits,
        done: true,
        error: None,
      },
    );
  });

  Ok(request_id)
}

/// Start watching `root_path` recursively for file modifications.
/// Replaces any previously active watcher.
/// Events caused by our own saves are suppressed via the skip_next list.
#[tauri::command]
pub fn watch_project(
  app: tauri::AppHandle,
  state: tauri::State<AppState>,
  root_path: String,
) -> Result<(), String> {
  let root = PathBuf::from(&root_path);
  if !root.exists() || !root.is_dir() {
    return Err(format!("invalid project root: {}", root_path));
  }

  let app_handle = app.clone();
  let skip_next = Arc::clone(&state.skip_next);

  let mut watcher =
    notify::recommended_watcher(move |res: Result<notify::Event, notify::Error>| {
      let event = match res {
        Ok(e) => e,
        Err(_) => return,
      };

      // Only emit on actual content modifications (not metadata, not creates/deletes).
      if !matches!(event.kind, EventKind::Modify(notify::event::ModifyKind::Data(_))
        | EventKind::Modify(notify::event::ModifyKind::Any))
      {
        return;
      }

      for path in event.paths {
        if !path.is_file() {
          continue;
        }

        let now = Instant::now();
        {
          let mut map = match skip_next.lock() {
            Ok(m) => m,
            Err(_) => continue,
          };
          // Purge stale entries to keep the map small.
          map.retain(|_, saved_at| now.duration_since(*saved_at) < Duration::from_secs(5));

          if let Some(&saved_at) = map.get(&path) {
            if now.duration_since(saved_at) < Duration::from_secs(2) {
              continue; // This was our own save — skip.
            }
          }
        }

        let path_str = path.to_string_lossy().to_string();
        let _ = app_handle.emit_all(FILE_CHANGED_EVENT, FileChangedEvent { path: path_str });
      }
    })
    .map_err(|e| format!("watcher create failed: {}", e))?;

  watcher
    .watch(&root, RecursiveMode::Recursive)
    .map_err(|e| format!("watch failed for {}: {}", root_path, e))?;

  // Store new watcher, implicitly dropping (and stopping) the previous one.
  state
    .watcher
    .lock()
    .map_err(|e| format!("lock error: {}", e))
    .map(|mut guard| { *guard = Some(watcher); })
}

/// Stop the active file watcher (if any).
#[tauri::command]
pub fn stop_watch(state: tauri::State<AppState>) -> Result<(), String> {
  state
    .watcher
    .lock()
    .map_err(|e| format!("lock error: {}", e))
    .map(|mut guard| { *guard = None; })
}

#[tauri::command]
pub fn rename_file(old_path: String, new_path: String) -> Result<(), String> {
  std::fs::rename(&old_path, &new_path)
    .map_err(|e| format!("rename failed: {}", e))
}

#[tauri::command]
pub fn delete_file(path: String) -> Result<(), String> {
  std::fs::remove_file(&path)
    .map_err(|e| format!("delete failed for {}: {}", path, e))
}

#[tauri::command]
pub fn move_to_trash(path: String) -> Result<(), String> {
  // Windows: use PowerShell to send to recycle bin
  let script = format!(
    r#"Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile('{}', 'OnlyErrorDialogs', 'SendToRecycleBin')"#,
    path.replace('\'', "''")
  );
  let output = std::process::Command::new("powershell")
    .args(["-NoProfile", "-NonInteractive", "-Command", &script])
    .output()
    .map_err(|e| format!("powershell error: {}", e))?;
  if output.status.success() {
    Ok(())
  } else {
    Err(String::from_utf8_lossy(&output.stderr).to_string())
  }
}

#[tauri::command]
pub fn create_folder(path: String) -> Result<(), String> {
  std::fs::create_dir_all(&path)
    .map_err(|e| format!("create_folder failed for {}: {}", path, e))
}

#[tauri::command]
pub fn run_kill_script() -> Result<String, String> {
  // In production, kill.bat is bundled as a Tauri resource next to the exe.
  // In dev, it's in the project root.
  let exe_dir = std::env::current_exe()
    .ok()
    .and_then(|p| p.parent().map(|p| p.to_path_buf()))
    .unwrap_or_else(|| std::env::current_dir().unwrap_or_default());
  let bat_path = exe_dir.join("kill.bat");
  if !bat_path.exists() {
    // Fallback: try project root (dev mode)
    let project_root = exe_dir.join("..").join("..").join("..");
    let dev_bat = project_root.join("kill.bat");
    if dev_bat.exists() {
      return run_bat(&dev_bat);
    }
    return Err(format!("kill.bat not found at {}", bat_path.display()));
  }
  run_bat(&bat_path)
}

fn run_bat(path: &std::path::Path) -> Result<String, String> {
  let output = std::process::Command::new("cmd.exe")
    .args(["/C", path.to_str().unwrap_or("")])
    .output()
    .map_err(|e| format!("failed to execute kill.bat: {}", e))?;
  let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
  if stdout == "NOT_FOUND" {
    return Err("Processes not found — nothing to kill".to_string());
  }
  if output.status.success() {
    Ok("Processes terminated successfully".to_string())
  } else {
    let stderr = String::from_utf8_lossy(&output.stderr);
    Err(format!("kill.bat failed: {}", stderr))
  }
}

#[tauri::command]
pub fn read_file_encoding(path: String, encoding: String) -> Result<FileOpenResult, String> {
  let bytes = fs::read(&path).map_err(|e| format!("read failed: {}", e))?;
  let content = match encoding.to_lowercase().as_str() {
    "utf-8" | "utf8"  => String::from_utf8_lossy(&bytes).to_string(),
    "ansi" | "windows-1251" => {
      let (cow, _, _) = WINDOWS_1251.decode(&bytes);
      cow.to_string()
    }
    "utf-16le" | "ucs-2le" => decode_utf16le(&bytes),
    "utf-16be" | "ucs-2be" => decode_utf16be(&bytes),
    _ => decode_text_content(&bytes),
  };
  Ok(FileOpenResult { path, content })
}

fn decode_utf16le(bytes: &[u8]) -> String {
  let pairs: Vec<u16> = bytes.chunks_exact(2)
    .map(|b| u16::from_le_bytes([b[0], b[1]]))
    .collect();
  String::from_utf16_lossy(&pairs)
}

fn decode_utf16be(bytes: &[u8]) -> String {
  let pairs: Vec<u16> = bytes.chunks_exact(2)
    .map(|b| u16::from_be_bytes([b[0], b[1]]))
    .collect();
  String::from_utf16_lossy(&pairs)
}

#[tauri::command]
pub fn save_file_encoding(
  state: tauri::State<AppState>,
  path: String,
  content: String,
  encoding: String,
) -> Result<(), String> {
  let bytes: Vec<u8> = match encoding.to_lowercase().as_str() {
    "utf-8" | "utf8" => content.into_bytes(),
    "utf-8-bom" | "utf8-bom" => {
      let mut v = vec![0xEF, 0xBB, 0xBF];
      v.extend_from_slice(content.as_bytes());
      v
    }
    "ansi" | "windows-1251" => {
      let (cow, _, _) = WINDOWS_1251.encode(&content);
      cow.to_vec()
    }
    "utf-16le" | "ucs-2le" => {
      let mut v = vec![0xFF, 0xFE]; // BOM
      for ch in content.encode_utf16() {
        v.extend_from_slice(&ch.to_le_bytes());
      }
      v
    }
    "utf-16be" | "ucs-2be" => {
      let mut v = vec![0xFE, 0xFF]; // BOM
      for ch in content.encode_utf16() {
        v.extend_from_slice(&ch.to_be_bytes());
      }
      v
    }
    _ => content.into_bytes(),
  };

  fs::write(&path, &bytes)
    .map_err(|e| format!("write failed for {}: {}", path, e))?;

  if let Ok(mut map) = state.skip_next.lock() {
    map.insert(PathBuf::from(&path), Instant::now());
  }
  Ok(())
}

// ── Private helpers ───────────────────────────────────────────────────────────

fn decode_text_content(bytes: &[u8]) -> String {
  if let Ok(text) = String::from_utf8(bytes.to_vec()) {
    return text;
  }

  if bytes.starts_with(&[0xFF, 0xFE]) {
    let mut units = Vec::with_capacity((bytes.len().saturating_sub(2)) / 2);
    for chunk in bytes[2..].chunks_exact(2) {
      units.push(u16::from_le_bytes([chunk[0], chunk[1]]));
    }
    return String::from_utf16_lossy(&units);
  }

  if bytes.starts_with(&[0xFE, 0xFF]) {
    let mut units = Vec::with_capacity((bytes.len().saturating_sub(2)) / 2);
    for chunk in bytes[2..].chunks_exact(2) {
      units.push(u16::from_be_bytes([chunk[0], chunk[1]]));
    }
    return String::from_utf16_lossy(&units);
  }

  let (decoded, _, _) = WINDOWS_1251.decode(bytes);
  decoded.into_owned()
}

fn emit_search_progress(app: &tauri::AppHandle, payload: SearchProgressEvent) {
  let _ = app.emit_all(SEARCH_EVENT_NAME, payload);
}

// ── Search helpers ────────────────────────────────────────────────────────────

fn is_word_char(c: char) -> bool { c.is_alphanumeric() || c == '_' }

fn at_word_boundary(haystack: &str, start: usize, len: usize) -> bool {
  let before_ok = haystack[..start].chars().next_back().map(|c| !is_word_char(c)).unwrap_or(true);
  let after_ok  = haystack[start + len..].chars().next().map(|c| !is_word_char(c)).unwrap_or(true);
  before_ok && after_ok
}

/// Returns the byte offset of the match, or None.
fn match_byte_offset(
  line: &str,
  query_norm: &str,
  regex_matcher: &Option<Regex>,
  case_sensitive: bool,
  whole_word: bool,
) -> Option<usize> {
  if let Some(re) = regex_matcher {
    re.find(line).map(|m| m.start())
  } else {
    let haystack = if case_sensitive { line.to_string() } else { line.to_lowercase() };
    let mut start = 0;
    while let Some(idx) = haystack[start..].find(query_norm) {
      let abs = start + idx;
      if !whole_word || at_word_boundary(&haystack, abs, query_norm.len()) {
        return Some(abs);
      }
      start = abs + 1;
    }
    None
  }
}

/// Returns true if the line contains at least one match.
fn line_matches(
  line: &str,
  query_norm: &str,
  regex_matcher: &Option<Regex>,
  case_sensitive: bool,
  whole_word: bool,
) -> bool {
  match_byte_offset(line, query_norm, regex_matcher, case_sensitive, whole_word).is_some()
}

// ── Encoding detection ────────────────────────────────────────────────────────

enum FileEncoding { Utf16, Ascii, Utf8, Ansi, Unknown }

fn detect_encoding(path: &Path) -> FileEncoding {
  let mut buf = [0u8; 512];
  let mut file = match fs::File::open(path) { Ok(f) => f, Err(_) => return FileEncoding::Unknown };
  let n = match file.read(&mut buf) { Ok(n) => n, Err(_) => return FileEncoding::Unknown };
  let bytes = &buf[..n];
  if n == 0 { return FileEncoding::Ascii; }
  // UTF-16 BOM
  if n >= 2 && ((bytes[0] == 0xFF && bytes[1] == 0xFE) || (bytes[0] == 0xFE && bytes[1] == 0xFF)) {
    return FileEncoding::Utf16;
  }
  // UTF-8 BOM
  let data = if n >= 3 && bytes[0] == 0xEF && bytes[1] == 0xBB && bytes[2] == 0xBF { &bytes[3..] } else { bytes };
  // Pure ASCII
  if data.iter().all(|&b| b < 0x80) { return FileEncoding::Ascii; }
  // Valid UTF-8 (with high bytes)
  if std::str::from_utf8(data).is_ok() { return FileEncoding::Utf8; }
  // Has high bytes that aren't valid UTF-8 → ANSI
  FileEncoding::Ansi
}

fn new_request_id() -> String {
  let ts = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|d| d.as_millis())
    .unwrap_or(0);
  format!("search-{}", ts)
}

fn file_name_or_path(path: &Path) -> String {
  path.file_name()
    .and_then(|x| x.to_str())
    .map(|x| x.to_string())
    .unwrap_or_else(|| path.to_string_lossy().to_string())
}

fn list_dir_entries(dir: &Path) -> Result<Vec<ProjectEntry>, String> {
  let mut entries = Vec::new();
  let read_dir = fs::read_dir(dir).map_err(|e| format!("read_dir failed: {}", e))?;

  for item in read_dir {
    let item = item.map_err(|e| format!("dir entry failed: {}", e))?;
    let path = item.path();
    let metadata = item
      .metadata()
      .map_err(|e| format!("metadata failed for {}: {}", path.display(), e))?;

    entries.push(ProjectEntry {
      name: file_name_or_path(&path),
      path: path.to_string_lossy().to_string(),
      is_dir: metadata.is_dir(),
    });
  }

  entries.sort_by(|a, b| match (a.is_dir, b.is_dir) {
    (true, false) => std::cmp::Ordering::Less,
    (false, true) => std::cmp::Ordering::Greater,
    _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
  });

  Ok(entries)
}

fn default_settings() -> AppSettings {
  AppSettings {
    autosave_mode: "off".to_string(),
    autosave_delay_ms: 1200,
    theme_id: "mahogany".to_string(),
    font_size: 13,
    tab_size: 4,
    word_wrap: "off".to_string(),
    hotkeys: HashMap::new(),
    search_collapsed_by_default: false,
    plc_rainbow_enabled: true,
    plc_rainbow_colors: Vec::new(),
  }
}

fn settings_file_path() -> Result<PathBuf, String> {
  let base = std::env::var_os("APPDATA")
    .map(PathBuf::from)
    .or_else(|| std::env::current_dir().ok())
    .ok_or_else(|| "failed to resolve settings base directory".to_string())?;

  Ok(base.join("MTCode").join("settings.json"))
}

// ── XLSX Spreadsheet Support ────────────────────────────────────────────────

use calamine::{open_workbook_auto, Reader};

/// Metadata for a single sheet
#[derive(Serialize, Clone, Debug)]
pub struct XlsxSheetInfo {
  pub name: String,
  pub row_count: u32,
  pub col_count: u32,
}

/// Result of parsing spreadsheet structure
#[derive(Serialize, Debug)]
pub struct XlsxWorkbookInfo {
  pub sheets: Vec<XlsxSheetInfo>,
}

/// Read workbook structure without loading cell data
#[tauri::command]
pub fn get_xlsx_info(path: String) -> Result<XlsxWorkbookInfo, String> {
  eprintln!("[MTCode] Opening workbook at: {}", path);
  
  let mut workbook = open_workbook_auto(&path)
    .map_err(|e| {
      eprintln!("[MTCode] Failed to open workbook: {}", e);
      format!("Failed to open workbook: {}", e)
    })?;

  let sheet_names = workbook.sheet_names().to_vec();
  eprintln!("[MTCode] Found {} sheets: {:?}", sheet_names.len(), sheet_names);

  let mut sheets = Vec::new();
  for name in sheet_names {
    // We only need dimensions here, not data
    if let Ok(range) = workbook.worksheet_range(&name) {
      let (rows, cols) = range.get_size();
      eprintln!("[MTCode] Sheet '{}': {} rows x {} cols", name, rows, cols);
      sheets.push(XlsxSheetInfo {
        name: name.clone(),
        row_count: rows as u32,
        col_count: cols as u32,
      });
    } else {
      eprintln!("[MTCode] Failed to read range for sheet: {}", name);
    }
  }

  eprintln!("[MTCode] Returning {} sheets", sheets.len());
  Ok(XlsxWorkbookInfo { sheets })
}
