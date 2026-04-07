import { invoke } from "@tauri-apps/api/tauri";

export type FileOpenResult = {
  path: string;
  content: string;
};

export type SaveFileRequest = {
  path: string;
  content: string;
};

export type ProjectEntry = {
  name: string;
  path: string;
  isDir: boolean;
};

export type ProjectOpenResult = {
  rootPath: string;
  entries: ProjectEntry[];
};

export type ListDirResult = {
  path: string;
  entries: ProjectEntry[];
};

export type ProjectSearchOptions = {
  caseSensitive: boolean;
  wholeWord: boolean;
  useRegex: boolean;
  invertMatch: boolean;
  encUtf8: boolean;
  encAnsi: boolean;
  encAscii: boolean;
  encUtf16: boolean;
};

export const DEFAULT_SEARCH_OPTIONS: ProjectSearchOptions = {
  caseSensitive: false,
  wholeWord: false,
  useRegex: false,
  invertMatch: false,
  encUtf8: true,
  encAnsi: true,
  encAscii: true,
  encUtf16: true,
};

export type SearchProjectRequest = {
  rootPath: string;
  query: string;
  caseSensitive: boolean;
  wholeWord: boolean;
  useRegex: boolean;
  invertMatch: boolean;
  encUtf8: boolean;
  encAnsi: boolean;
  encAscii: boolean;
  encUtf16: boolean;
  maxResults?: number;
};

export type SearchHit = {
  path: string;
  line: number;
  column: number;
  preview: string;
};

export type SearchProgressEvent = {
  requestId: string;
  hits: SearchHit[];
  scannedFiles: number;
  totalHits: number;
  done: boolean;
  error?: string | null;
};

export type AutosaveMode = "off" | "focusChange" | "delayed";

export type AppSettings = {
  autosaveMode: AutosaveMode;
  autosaveDelayMs: number;
  themeId: string;
  fontSize: number;
  tabSize: number;
  wordWrap: "off" | "on" | "wordWrapColumn";
  hotkeys: Record<string, string>;
  searchCollapsedByDefault: boolean;
  /** PLC rainbow block highlighting toggle */
  plcRainbowEnabled: boolean;
  /** 10 hex color strings for rainbow nesting levels 0-9 */
  plcRainbowColors: string[];
};

/** Emitted by the Rust file watcher when a file is modified outside the editor. */
export type FileChangedEvent = {
  path: string;
};

export function openFile(path: string) {
  return invoke<FileOpenResult>("open_file", { path });
}

export function saveFile(request: SaveFileRequest) {
  return invoke<void>("save_file", { request });
}

export function openProject(rootPath: string) {
  return invoke<ProjectOpenResult>("open_project", { rootPath });
}

export function listDir(path: string) {
  return invoke<ListDirResult>("list_dir", { path });
}

export function searchProject(request: SearchProjectRequest) {
  return invoke<string>("search_project", { request });
}

export function loadSettings() {
  return invoke<AppSettings>("load_settings");
}

export function saveSettings(settings: AppSettings) {
  return invoke<void>("save_settings", { settings });
}

/** Start watching a project root for external file modifications. */
export function watchProject(rootPath: string) {
  return invoke<void>("watch_project", { rootPath });
}

/** Stop the active file watcher. */
export function stopWatch() {
  return invoke<void>("stop_watch");
}

export function renameFile(oldPath: string, newPath: string) {
  return invoke<void>("rename_file", { oldPath, newPath });
}

export function deleteFile(path: string) {
  return invoke<void>("delete_file", { path });
}

export function moveToTrash(path: string) {
  return invoke<void>("move_to_trash", { path });
}

export function readFileEncoding(path: string, encoding: string) {
  return invoke<FileOpenResult>("read_file_encoding", { path, encoding });
}

export function saveFileEncoding(path: string, content: string, encoding: string) {
  return invoke<void>("save_file_encoding", { path, content, encoding });
}
