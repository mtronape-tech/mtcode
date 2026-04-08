import Editor, { type BeforeMount, type OnMount } from "@monaco-editor/react";
import type { editor as MonacoEditor, IRange } from "monaco-editor";
import { open, save } from "@tauri-apps/api/dialog";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";

import {
  listDir,
  loadSettings,
  openFile,
  openProject,
  saveFile,
  saveSettings,
  searchProject,
  watchProject,
  renameFile,
  deleteFile,
  moveToTrash,
  createFolder,
  runKillScript,
  readFileEncoding,
  saveFileEncoding,
  getXlsxInfo,
  type AppSettings,
  type AutosaveMode,
  type FileChangedEvent,
  type ProjectEntry,
  type ProjectSearchOptions,
  type SearchHit,
  type SearchProgressEvent,
  type XlsxWorkbookInfo,
  DEFAULT_SEARCH_OPTIONS,
} from "./services/ipc";

import type { BookmarkMap, EditorTab, EditorTabMode, MenuAction, MenuKey, TreeNode } from "./types";

import { EditorTabs } from "./components/EditorTabs";
import { ExternalChangeDialog } from "./components/ExternalChangeDialog";
import { FileTree } from "./components/FileTree";
import { FindBar } from "./components/FindBar";
import { MenuBar } from "./components/MenuBar";
import { ProjectSearchPanel } from "./components/ProjectSearchPanel";
import { StatusBar } from "./components/StatusBar";
import { SettingsModal, type SettingsDraft } from "./components/SettingsModal";
import { AboutDialog } from "./components/AboutDialog";
import { GoToDialog } from "./components/GoToDialog";
import { KillDialog } from "./components/KillDialog";
import { CommandPalette, type CommandPaletteItem } from "./components/CommandPalette";
import { UnsavedChangesDialog } from "./components/UnsavedChangesDialog";
import { Toaster, toast } from "./components/Toaster";
import { SpreadsheetView } from "./components/SpreadsheetView";
import { useTheme } from "./context/ThemeContext";
import { isValidThemeId, THEMES } from "./lib/theme";
import { HELP_CONTENT } from "./lib/helpContent";
import { matchesBinding, resolveHotkeys, HOTKEY_DEFAULTS, FKEY_DEFAULT_ACTIONS, FKEY_SHORT_LABELS, HOTKEY_LABELS, type HotkeyAction } from "./lib/hotkeys";
import { registerPlcLanguage, PLC_LANGUAGE_ID } from "./lib/plcLanguage";
import { registerPlcFormatter, validatePlc } from "./lib/plcFormatter";
import {
  applyRainbowColors,
  parseRainbowBlocks,
  createRainbowDecorations,
  DEFAULT_RAINBOW_COLORS,
  DARK_RAINBOW_COLORS,
  LIGHT_RAINBOW_COLORS,
} from "./lib/plcRainbowBlocks";


const MENU_KEYS: MenuKey[] = ["file", "edit", "search", "view", "encoding", "settings", "help"];
const FILE_SEARCH_TAB_ID = "__search_file__";
const PROJECT_SEARCH_TAB_ID = "__search_project__";

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  bat: "bat", c: "c", cpp: "cpp", cs: "csharp", css: "css",
  go: "go", h: "cpp", hpp: "cpp", htm: "html", html: "html",
  ini: "ini", java: "java", js: "javascript", json: "json", jsx: "javascript",
  less: "less", md: "markdown", php: "php", ps1: "powershell", py: "python",
  rs: "rust", scss: "scss", sh: "shell", sql: "sql", toml: "toml",
  ts: "typescript", tsx: "typescript", xml: "xml", yml: "yaml", yaml: "yaml",
  // Mechatronika MNC PLC language
  plc: "plc", cfg: "plc", pmc: "plc",
};

type SearchMode = "file" | "project";

function toNodes(entries: ProjectEntry[]): TreeNode[] {
  return entries.map((entry) => ({
    name: entry.name,
    path: entry.path,
    isDir: entry.isDir,
    expanded: false,
    loaded: false,
    children: [],
  }));
}

function updateNode(
  nodes: TreeNode[],
  targetPath: string,
  updater: (node: TreeNode) => TreeNode,
): TreeNode[] {
  return nodes.map((node) => {
    if (node.path === targetPath) return updater(node);
    if (!node.children.length) return node;
    return { ...node, children: updateNode(node.children, targetPath, updater) };
  });
}

function findNode(nodes: TreeNode[], targetPath: string): TreeNode | null {
  for (const node of nodes) {
    if (node.path === targetPath) return node;
    const hit = findNode(node.children, targetPath);
    if (hit) return hit;
  }
  return null;
}

function fileName(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}

function languageFromPath(path: string): string {
  const match = /\.([^.\\/]+)$/.exec(path.toLowerCase());
  if (!match) return "plaintext";
  return LANGUAGE_BY_EXTENSION[match[1]] ?? "plaintext";
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").toLowerCase();
}

function samePosition(range: IRange, lineNumber: number, column: number): boolean {
  return range.startLineNumber === lineNumber && range.startColumn === column;
}

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_IPC__" in window;
}

function isEditableTarget(target: EventTarget | null): boolean {
  const element = target instanceof HTMLElement ? target : null;
  if (!element) return false;
  if (element.closest(".monaco-editor")) return false;
  if (element.isContentEditable) return true;
  return Boolean(element.closest("input, textarea, select, [contenteditable='true']"));
}

function normalizeAutosaveMode(value: string): AutosaveMode {
  if (value === "focusChange" || value === "delayed" || value === "off") return value;
  if (value === "focus-change") return "focusChange";
  return "off";
}


export function App() {
  const { monacoTheme, themeId, setTheme, toggleTheme } = useTheme();

  const [projectRoot, setProjectRoot] = useState<string>("");
  const [treeNodes, setTreeNodes] = useState<TreeNode[]>([]);

  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>("");
  const [visibleTabId, setVisibleTabId] = useState<string>("");

  const [cursorText, setCursorText] = useState<string>("Ln 1, Col 1");
  const [busyPath, setBusyPath] = useState<string>("");
  // errorText/infoText replaced by toast notifications

  const [autosaveMode, setAutosaveMode] = useState<AutosaveMode>("off");
  const [autosaveDelayMs, setAutosaveDelayMs] = useState<number>(1200);
  const [settingsLoaded, setSettingsLoaded] = useState<boolean>(false);

  const [searchPanelOpen, setSearchPanelOpen] = useState<boolean>(false);
  const [searchMode, setSearchMode] = useState<SearchMode>("file");
  const [findQuery, setFindQuery] = useState<string>("");
  const [replaceText, setReplaceText] = useState<string>("");
  const [findRanges, setFindRanges] = useState<IRange[]>([]);
  const [findIndex, setFindIndex] = useState<number>(0);
  const [projectSearchQuery, setProjectSearchQuery] = useState<string>("");
  const [projectSearchOpts, setProjectSearchOpts] = useState<ProjectSearchOptions>(DEFAULT_SEARCH_OPTIONS);
  const [projectSearchBusy, setProjectSearchBusy] = useState<boolean>(false);
  const [projectSearchHits, setProjectSearchHits] = useState<SearchHit[]>([]);
  const [projectSearchScannedFiles, setProjectSearchScannedFiles] = useState<number>(0);
  const [projectSearchTotalHits, setProjectSearchTotalHits] = useState<number>(0);

  const [sidebarWidth, setSidebarWidth] = useState<number>(300);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [savedSidebarWidth, setSavedSidebarWidth] = useState<number>(300);

  // Tree selection & inline folder creation
  const [selectedTreePath, setSelectedTreePath] = useState<string | null>(null);
  const [creatingFolderIn, setCreatingFolderIn] = useState<string | null>(null);

  const [fontSize, setFontSize] = useState<number>(13);
  const [fontFamily, setFontFamily] = useState<string>("JetBrains Mono");
  const [tabSize, setTabSize] = useState<number>(4);
  const [wordWrap, setWordWrap] = useState<"off" | "on" | "wordWrapColumn">("off");
  const [hotkeys, setHotkeys] = useState(HOTKEY_DEFAULTS);
  const [searchCollapsedByDefault, setSearchCollapsedByDefault] = useState<boolean>(false);
  const [plcRainbowEnabled, setPlcRainbowEnabled] = useState<boolean>(true);
  const [plcValidationEnabled, setPlcValidationEnabled] = useState<boolean>(false);
  // [] = auto (picks dark/light palette based on theme); length 10 = user custom
  const [plcRainbowColors, setPlcRainbowColors] = useState<string[]>([]);

  // Always-current ref — avoids stale closure in the keydown useEffect (deps=[])
  const hotkeysRef = useRef(hotkeys);
  hotkeysRef.current = hotkeys;

  // Always-current refs for rainbow (avoid stale closures in Monaco callbacks)
  // Effective palette: user custom if length==10, else auto based on theme mode
  const effectivePalette = useMemo(() => {
    if (plcRainbowColors.length === 10) return plcRainbowColors;
    return THEMES[themeId]?.mode === "light" ? LIGHT_RAINBOW_COLORS : DARK_RAINBOW_COLORS;
  }, [plcRainbowColors, themeId]);

  const plcRainbowEnabledRef = useRef<boolean>(true);
  plcRainbowEnabledRef.current = plcRainbowEnabled;
  const plcValidationEnabledRef = useRef<boolean>(false);
  plcValidationEnabledRef.current = plcValidationEnabled;
  const plcRainbowColorsRef = useRef<string[]>(DARK_RAINBOW_COLORS);
  plcRainbowColorsRef.current = effectivePalette;

  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [aboutOpen, setAboutOpen] = useState<boolean>(false);
  const [goToOpen, setGoToOpen] = useState<boolean>(false);
  const [killDialogOpen, setKillDialogOpen] = useState<boolean>(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState<boolean>(false);
  const [fkeyActions, setFkeyActions] = useState<(string | null)[]>(FKEY_DEFAULT_ACTIONS);
  const [recentFiles, setRecentFiles] = useState<string[]>([]);
  const [bookmarks, setBookmarks] = useState<BookmarkMap>(new Map());
  const bookmarkDecorRef = useRef<import("monaco-editor").editor.IEditorDecorationsCollection | null>(null);

  const [openMenu, setOpenMenu] = useState<MenuKey | null>(null);
  const [focusedMenuIndex, setFocusedMenuIndex] = useState<number>(-1);
  const [focusedMenuActionIndex, setFocusedMenuActionIndex] = useState<number>(-1);

  const [pendingCursor, setPendingCursor] = useState<{ line: number; column: number; matchLength?: number } | null>(null);
  // Bumped each time Monaco mounts — lets the pendingCursor effect re-run after editor appears
  const [editorMountVersion, setEditorMountVersion] = useState(0);

  const [externalChangedPath, setExternalChangedPath] = useState<string | null>(null);
  const [unsavedCloseOpen, setUnsavedCloseOpen] = useState<boolean>(false);
  const [pendingCloseTabId, setPendingCloseTabId] = useState<string | null>(null);


  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof import("monaco-editor") | null>(null);
  const activeSearchRequestRef = useRef<string>("");
  // First hit of the current project search — for auto-navigation when done
  const autoNavHitRef = useRef<SearchHit | null>(null);
  // Always-current ref to openSearchHit (avoids stale closures in Monaco addAction / event listeners)
  const openSearchHitRef = useRef<(hit: SearchHit) => Promise<void>>(async () => {});
  // Always-current refs to search openers — used by Monaco context menu actions
  const editorActionsRef = useRef({
    openFindPanel: (_target: "find" | "replace" = "find", _query?: string) => {},
    openProjectSearchPanel: (_query?: string) => {},
    navigateFind: (_dir: 1 | -1) => {},
    closeSearchTabs: () => {},
    toggleBookmarkAtLine: (_line: number) => {},
    openCommandPalette: () => {},
    searchPanelOpen: false,
    searchMode: "file" as SearchMode,
  });
  const tabsRef = useRef<EditorTab[]>([]);
  const prevActiveTabRef = useRef<string>("");
  const menuRef = useRef<HTMLElement | null>(null);
  const menuButtonRefs = useRef<Record<MenuKey, HTMLButtonElement | null>>({
    file: null, edit: null, search: null, view: null, encoding: null, settings: null, help: null,
  });
  const menuActionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const findInputRef = useRef<HTMLInputElement | null>(null);
  const replaceInputRef = useRef<HTMLInputElement | null>(null);
  const projectSearchInputRef = useRef<HTMLInputElement | null>(null);
  const sidebarResizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const rainbowDecorRef = useRef<import("monaco-editor").editor.IEditorDecorationsCollection | null>(null);

  // ── Recent files ─────────────────────────────────────────────────────────────
  const pushRecentFile = (path: string) => {
    setRecentFiles((prev) => {
      const next = [path, ...prev.filter((p) => p !== path)].slice(0, 10);
      return next;
    });
  };

  // ── Save As ───────────────────────────────────────────────────────────────────
  const saveActiveTabAs = async () => {
    if (!activeTab) return;
    const { save: showSaveDialog } = await import("@tauri-apps/api/dialog");
    const chosen = await showSaveDialog({ defaultPath: activeTab.path });
    if (!chosen || typeof chosen !== "string") return;
    await saveFile({ path: chosen, content: activeTab.content });
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTab.id
          ? { ...t, path: chosen, name: fileName(chosen), savedContent: t.content, dirty: false }
          : t,
      ),
    );
    pushRecentFile(chosen);
  };

  // ── Save All ──────────────────────────────────────────────────────────────────
  const saveAllTabs = async () => {
    for (const tab of tabs) {
      if (tab.dirty && tab.path && !tab.path.startsWith("untitled://")) {
        await saveFile({ path: tab.path, content: tab.content });
        setTabs((prev) =>
          prev.map((t) => (t.id === tab.id ? { ...t, savedContent: t.content, dirty: false } : t)),
        );
      }
    }
  };

  const hasUnsavedChanges = useMemo(() => tabs.some((t) => t.dirty), [tabs]);

  const saveAllDirtyTabs = async () => {
    // Use tabsRef (always-current) so we don't race React state updates
    const currentTabs = tabsRef.current;
    for (const tab of currentTabs) {
      if (tab.dirty) {
        await saveTab(tab, "manual");
      }
    }
  };

  const requestAppClose = () => {
    if (!tabsRef.current.some((t) => t.dirty)) {
      void (async () => {
        if (!isTauriRuntime()) { window.close(); return; }
        const { appWindow } = await import("@tauri-apps/api/window");
        await appWindow.close();
      })();
      return;
    }
    setUnsavedCloseOpen(true);
  };

  const requestCloseAllTabs = () => {
    const dirtyTabs = tabsRef.current.filter((t) => t.dirty);
    if (dirtyTabs.length > 0) {
      setUnsavedCloseOpen(true);
    } else {
      closeAllTabs();
    }
  };

  const requestCloseAllButActive = () => {
    const dirtyOthers = tabsRef.current.filter((t) => t.id !== activeTabId && t.dirty);
    if (dirtyOthers.length > 0) {
      setUnsavedCloseOpen(true);
    } else {
      closeAllButActive();
    }
  };

  // ── Close All ────────────────────────────────────────────────────────────────
  const closeAllTabs = () => {
    setTabs([]);
    setActiveTabId("");
    setVisibleTabId("");
  };

  // ── Close All But This ───────────────────────────────────────────────────────
  const closeAllButActive = () => {
    setTabs((prev) => prev.filter((t) => t.id === activeTabId));
  };

  // ── Reload ───────────────────────────────────────────────────────────────────
  const reloadActiveTab = async () => {
    if (!activeTab || activeTab.path.startsWith("untitled://")) return;
    try {
      const result = await openFile(activeTab.path);
      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTab.id
            ? { ...t, content: result.content, savedContent: result.content, dirty: false }
            : t,
        ),
      );
    } catch (e) {
      toast.error(String(e));
    }
  };

  // ── Reload as Encoding ────────────────────────────────────────────────────────
  const reloadAsEncoding = async (encoding: string) => {
    if (!activeTab || activeTab.path.startsWith("untitled://")) return;
    try {
      const result = await readFileEncoding(activeTab.path, encoding);
      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTab.id
            ? { ...t, content: result.content, savedContent: result.content, dirty: false, encoding }
            : t,
        ),
      );
    } catch (e) {
      toast.error(String(e));
    }
  };

  // ── Convert encoding (re-save with different encoding) ────────────────────────
  const convertEncoding = async (encoding: string) => {
    if (!activeTab || activeTab.path.startsWith("untitled://")) return;
    try {
      await saveFileEncoding(activeTab.path, activeTab.content, encoding);
      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTab.id ? { ...t, savedContent: t.content, dirty: false, encoding } : t,
        ),
      );
      toast(`Saved as ${encoding.toUpperCase()}`);
    } catch (e) {
      toast.error(String(e));
    }
  };

  // ── Rename ────────────────────────────────────────────────────────────────────
  const renameActiveTab = async () => {
    if (!activeTab || activeTab.path.startsWith("untitled://")) return;
    const newName = window.prompt("New filename:", activeTab.name);
    if (!newName || newName === activeTab.name) return;
    const dir = activeTab.path.replace(/[/\\][^/\\]+$/, "");
    const newPath = `${dir}\\${newName}`;
    try {
      await renameFile(activeTab.path, newPath);
      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTab.id ? { ...t, path: newPath, name: newName } : t,
        ),
      );
    } catch (e) {
      toast.error(String(e));
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────────
  const deleteActiveTab = async () => {
    if (!activeTab || activeTab.path.startsWith("untitled://")) return;
    if (!window.confirm(`Delete ${activeTab.name}?`)) return;
    try {
      await deleteFile(activeTab.path);
      closeTabById(activeTab.id);
    } catch (e) {
      toast.error(String(e));
    }
  };

  // ── Move to Recycle Bin ────────────────────────────────────────────────────────
  const trashActiveTab = async () => {
    if (!activeTab || activeTab.path.startsWith("untitled://")) return;
    if (!window.confirm(`Move ${activeTab.name} to Recycle Bin?`)) return;
    try {
      await moveToTrash(activeTab.path);
      closeTabById(activeTab.id);
    } catch (e) {
      toast.error(String(e));
    }
  };

  // ── Bookmarks ─────────────────────────────────────────────────────────────────
  const updateBookmarkDecorations = () => {
    const ed = editorRef.current;
    if (!ed || !ed.getModel()) return;
    if (!bookmarkDecorRef.current) {
      bookmarkDecorRef.current = ed.createDecorationsCollection([]);
    }
    const path = activeTab?.path ?? "";
    const lines = bookmarks.get(path) ?? new Set<number>();
    const decors = Array.from(lines).map((ln) => ({
      range: { startLineNumber: ln, startColumn: 1, endLineNumber: ln, endColumn: 1 },
      options: {
        isWholeLine: false,
        glyphMarginClassName: "bookmark-glyph",
        glyphMarginHoverMessage: { value: "Bookmark" },
        overviewRuler: { color: "hsl(var(--primary))", position: 4 },
      },
    }));
    try {
      bookmarkDecorRef.current.set(decors);
    } catch {
      bookmarkDecorRef.current = null;
    }
  };

  const toggleBookmarkAtLine = (line: number) => {
    const path = tabsRef.current.find((t) => t.id === activeTabId)?.path ?? "";
    if (!path) return;
    setBookmarks((prev) => {
      const next = new Map(prev);
      const set = new Set(next.get(path) ?? []);
      if (set.has(line)) set.delete(line); else set.add(line);
      next.set(path, set);
      return next;
    });
  };

  const toggleBookmark = () => {
    const ed = editorRef.current;
    if (!ed || !activeTab) return;
    const line = ed.getPosition()?.lineNumber ?? 1;
    const path = activeTab.path;
    setBookmarks((prev) => {
      const next = new Map(prev);
      const set = new Set(next.get(path) ?? []);
      if (set.has(line)) set.delete(line); else set.add(line);
      next.set(path, set);
      return next;
    });
  };

  const navigateBookmark = (dir: 1 | -1) => {
    const ed = editorRef.current;
    if (!ed || !activeTab) return;
    const path = activeTab.path;
    const lines = Array.from(bookmarks.get(path) ?? []).sort((a, b) => a - b);
    if (!lines.length) return;
    const cur = ed.getPosition()?.lineNumber ?? 1;
    let next: number;
    if (dir === 1) {
      next = lines.find((l) => l > cur) ?? lines[0]!;
    } else {
      next = [...lines].reverse().find((l) => l < cur) ?? lines[lines.length - 1]!;
    }
    ed.revealLineInCenter(next);
    ed.setPosition({ lineNumber: next, column: 1 });
  };

  const clearBookmarks = () => {
    if (!activeTab) return;
    setBookmarks((prev) => {
      const next = new Map(prev);
      next.delete(activeTab.path);
      return next;
    });
  };

  // Update bookmark decorations when bookmarks or active tab changes
  useEffect(() => {
    if (editorRef.current) updateBookmarkDecorations();
  }, [bookmarks, activeTabId]);

  // ── Go To ────────────────────────────────────────────────────────────────────
  const handleGoTo = (line: number, col: number) => {
    const ed = editorRef.current;
    if (!ed) return;
    ed.revealLineInCenter(line);
    ed.setPosition({ lineNumber: line, column: col });
    ed.focus();
  };

  // ── Edit operations using Monaco editor commands ──────────────────────────────
  const editorCommand = (cmd: string) => {
    const ed = editorRef.current;
    if (!ed) return;
    try {
      ed.focus();
      // getAction().run() is safer than trigger() — goes through action system,
      // not the keybinding/view-command pipeline that can touch stale DOM nodes
      const action = ed.getAction(cmd);
      if (action) {
        void action.run();
      } else {
        ed.trigger("keyboard", cmd, null);
      }
    } catch {
      // Ignore unsupported commands (e.g. fold on non-folding languages)
    }
  };

  const transformSelection = (fn: (text: string) => string) => {
    const ed = editorRef.current;
    if (!ed) return;
    const model = ed.getModel();
    const sel = ed.getSelection();
    if (!model || !sel) return;
    const text = model.getValueInRange(sel);
    if (!text) return;
    ed.executeEdits("menu", [{ range: sel, text: fn(text) }]);
  };

  const toProperCase = (s: string) =>
    s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

  const toSentenceCase = (s: string) =>
    s.replace(/(^\s*\w|[.!?]\s+\w)/g, (c) => c.toUpperCase());

  const trimTrailingSpace = () => {
    const ed = editorRef.current;
    if (!ed) return;
    const model = ed.getModel();
    if (!model) return;
    const edits = [];
    for (let i = 1; i <= model.getLineCount(); i++) {
      const line = model.getLineContent(i);
      const trimmed = line.replace(/[ \t]+$/, "");
      if (trimmed !== line) {
        edits.push({
          range: { startLineNumber: i, startColumn: 1, endLineNumber: i, endColumn: line.length + 1 },
          text: trimmed,
        });
      }
    }
    if (edits.length) ed.executeEdits("menu", edits);
  };

  const trimLeadingSpace = () => {
    const ed = editorRef.current;
    if (!ed) return;
    const model = ed.getModel();
    if (!model) return;
    const sel = ed.getSelection();
    if (!sel) return;
    const edits = [];
    const start = sel.isEmpty() ? 1 : sel.startLineNumber;
    const end = sel.isEmpty() ? model.getLineCount() : sel.endLineNumber;
    for (let i = start; i <= end; i++) {
      const line = model.getLineContent(i);
      const trimmed = line.replace(/^[ \t]+/, "");
      if (trimmed !== line) {
        edits.push({
          range: { startLineNumber: i, startColumn: 1, endLineNumber: i, endColumn: line.length + 1 },
          text: trimmed,
        });
      }
    }
    if (edits.length) ed.executeEdits("menu", edits);
  };

  const removeEmptyLines = (keepBlankChars = false) => {
    const ed = editorRef.current;
    if (!ed) return;
    const model = ed.getModel();
    if (!model) return;
    const edits = [];
    for (let i = model.getLineCount(); i >= 1; i--) {
      const line = model.getLineContent(i);
      const isEmpty = keepBlankChars ? line.trim() === "" : line === "";
      if (isEmpty) {
        const start = i === 1 ? 1 : model.getLineMaxColumn(i - 1) + 1;
        const startLine = i === 1 ? 1 : i - 1;
        edits.push({
          range: { startLineNumber: startLine, startColumn: start, endLineNumber: i, endColumn: line.length + 1 },
          text: "",
        });
      }
    }
    if (edits.length) ed.executeEdits("menu", edits);
  };

  const toggleSidebar = () => {
    if (!sidebarCollapsed) {
      setSavedSidebarWidth(sidebarWidth);
      setSidebarCollapsed(true);
    } else {
      setSidebarWidth(savedSidebarWidth);
      setSidebarCollapsed(false);
    }
  };

  const applySettings = (draft: SettingsDraft) => {
    if (isValidThemeId(draft.themeId)) setTheme(draft.themeId);
    setFontSize(draft.fontSize);
    setFontFamily(draft.fontFamily);
    setTabSize(draft.tabSize);
    setWordWrap(draft.wordWrap);
    setAutosaveMode(draft.autosaveMode);
    setAutosaveDelayMs(draft.autosaveDelayMs);
    setHotkeys(resolveHotkeys(draft.hotkeys));
    setSearchCollapsedByDefault(draft.searchCollapsedByDefault);
    setPlcRainbowEnabled(draft.plcRainbowEnabled);
    // Keep [] if user reset to auto; otherwise use the full 10-color custom set
    setPlcRainbowColors(draft.plcRainbowColors.length === 10 ? draft.plcRainbowColors : []);
    if (Array.isArray(draft.fkeyActions) && draft.fkeyActions.length === 10) {
      setFkeyActions(draft.fkeyActions);
    }
  };

  // Keep action refs current every render (safe pattern for stable callbacks)
  // These are assigned here (not in useEffect) so they're always fresh before any render-triggered callbacks.

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId) ?? null,
    [tabs, activeTabId],
  );
  const activeLanguage = useMemo(
    () => (activeTab ? languageFromPath(activeTab.path) : "plaintext"),
    [activeTab?.path],
  );


  useEffect(() => { tabsRef.current = tabs; }, [tabs]);

  useEffect(() => {
    if (!visibleTabId && activeTabId) setVisibleTabId(activeTabId);
  }, [activeTabId, visibleTabId]);


  useEffect(() => {
    if (!openMenu) return;
    const onMouseDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    };
    window.addEventListener("mousedown", onMouseDown);
    return () => window.removeEventListener("mousedown", onMouseDown);
  }, [openMenu]);

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      const state = sidebarResizeRef.current;
      if (!state) return;
      const delta = event.clientX - state.startX;
      setSidebarWidth(Math.min(640, Math.max(220, state.startWidth + delta)));
    };
    const onMouseUp = () => {
      if (!sidebarResizeRef.current) return;
      sidebarResizeRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  useEffect(() => {
    void (async () => {
      if (!isTauriRuntime()) { setSettingsLoaded(true); return; }
      try {
        const settings = await loadSettings();
        setAutosaveMode(normalizeAutosaveMode(settings.autosaveMode));
        setAutosaveDelayMs(Math.max(250, Number(settings.autosaveDelayMs || 1200)));
        if (settings.themeId && isValidThemeId(settings.themeId)) setTheme(settings.themeId);
        if (settings.fontSize && settings.fontSize >= 9 && settings.fontSize <= 24) setFontSize(settings.fontSize);
        if (settings.fontFamily) setFontFamily(settings.fontFamily);
        if (settings.tabSize && settings.tabSize >= 1 && settings.tabSize <= 8) setTabSize(settings.tabSize);
        if (settings.wordWrap === "on" || settings.wordWrap === "wordWrapColumn") setWordWrap(settings.wordWrap);
        if (settings.hotkeys) setHotkeys(resolveHotkeys(settings.hotkeys));
        if (settings.searchCollapsedByDefault) setSearchCollapsedByDefault(true);
        if (settings.plcRainbowEnabled === false) setPlcRainbowEnabled(false);
        if (Array.isArray(settings.plcRainbowColors) && settings.plcRainbowColors.length === 10) {
          setPlcRainbowColors(settings.plcRainbowColors);
        }
        if (Array.isArray(settings.fkeyActions) && settings.fkeyActions.length === 10) {
          setFkeyActions(settings.fkeyActions);
        }
      } catch {
        setAutosaveMode("off");
        setAutosaveDelayMs(1200);
      } finally {
        setSettingsLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!settingsLoaded || !isTauriRuntime()) return;
    const payload: AppSettings = { autosaveMode, autosaveDelayMs, themeId, fontSize, fontFamily, tabSize, wordWrap, hotkeys, searchCollapsedByDefault, plcRainbowEnabled, plcRainbowColors, fkeyActions };
    void saveSettings(payload);
  }, [autosaveMode, autosaveDelayMs, themeId, fontSize, tabSize, wordWrap, hotkeys, searchCollapsedByDefault, plcRainbowEnabled, plcRainbowColors, fkeyActions, settingsLoaded]);

  // Re-apply rainbow decorations when toggle, colors, or theme changes
  useEffect(() => {
    applyRainbowColors(effectivePalette);
    if (editorRef.current) updateRainbowDecorations(editorRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plcRainbowEnabled, effectivePalette]);

  // Clear or re-run validation markers when toggle changes
  useEffect(() => {
    const monaco = monacoRef.current;
    const model = editorRef.current?.getModel();
    if (!model || !monaco) return;
    if (!plcValidationEnabled) {
      // Clear all markers when disabled
      monaco.editor.setModelMarkers(model, "plc-validator", []);
    } else if (model.getLanguageId() === PLC_LANGUAGE_ID) {
      // Re-run immediately when enabled
      const errors = validatePlc(model.getValue());
      monaco.editor.setModelMarkers(model, "plc-validator", errors.map((e) => ({
        severity: e.severity === "error" ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
        message: e.message,
        startLineNumber: e.line, startColumn: e.col,
        endLineNumber: e.line, endColumn: model.getLineMaxColumn(e.line),
      })));
    }
  }, [plcValidationEnabled]);

  // Warn on browser unload if there are unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!tabsRef.current.some((t) => t.dirty)) return;
      e.preventDefault();
      // Required for some browsers to show the confirmation dialog
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // Auto-save all dirty tabs when window is hidden (Alt+Tab, X button, etc.)
  // This is a safety net for when close cannot be intercepted (Tauri v1 limitation)
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === "hidden") {
        const dirty = tabsRef.current.filter((t) => t.dirty && !t.path.startsWith("untitled://"));
        for (const tab of dirty) {
          void saveFile({ path: tab.path, content: tab.content }).catch(() => { /* ignore */ });
        }
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  useEffect(() => {
    const previousTabId = prevActiveTabRef.current;
    if (autosaveMode === "focusChange" && previousTabId && previousTabId !== activeTabId) {
      void saveTabById(previousTabId, "auto");
    }
    prevActiveTabRef.current = activeTabId;
  }, [activeTabId, autosaveMode]);

  useEffect(() => {
    if (autosaveMode !== "focusChange") return;
    const onWindowBlur = () => {
      if (activeTabId) void saveTabById(activeTabId, "auto");
    };
    window.addEventListener("blur", onWindowBlur);
    return () => window.removeEventListener("blur", onWindowBlur);
  }, [autosaveMode, activeTabId]);

  useEffect(() => {
    if (autosaveMode !== "delayed" || !activeTab || !activeTab.dirty) return;
    const handle = window.setTimeout(() => {
      const current = tabsRef.current.find((item) => item.id === activeTab.id);
      if (current && current.dirty) void saveTab(current, "auto");
    }, Math.max(250, autosaveDelayMs));
    return () => window.clearTimeout(handle);
  }, [autosaveMode, autosaveDelayMs, activeTab?.id, activeTab?.content, activeTab?.dirty]);

  useEffect(() => {
    setFindRanges([]);
    setFindIndex(0);
  }, [activeTabId]);

  useEffect(() => {
    menuActionRefs.current = [];
    if (!openMenu) { setFocusedMenuActionIndex(-1); return; }
    const handle = window.setTimeout(() => {
      if (focusedMenuActionIndex >= 0) {
        menuActionRefs.current[focusedMenuActionIndex]?.focus();
      } else {
        menuButtonRefs.current[openMenu]?.focus();
      }
    }, 0);
    return () => window.clearTimeout(handle);
  }, [openMenu, focusedMenuActionIndex]);

  useEffect(() => {
    if (!pendingCursor) return;
    const editor = editorRef.current;
    const model = editor?.getModel();
    // Editor may not have mounted yet — wait for editorMountVersion to tick
    if (!editor || !model) return;
    const { line: rawLine, column: rawCol, matchLength } = pendingCursor;
    const line = Math.min(Math.max(rawLine, 1), model.getLineCount());
    const maxCol = model.getLineMaxColumn(line);
    const column = Math.min(Math.max(rawCol, 1), maxCol);
    setTimeout(() => {
      editor.revealPositionInCenter({ lineNumber: line, column });
      if (matchLength && matchLength > 0) {
        // Select the matched text so it's highlighted
        const endColumn = Math.min(column + matchLength, model.getLineMaxColumn(line) + 1);
        editor.setSelection({ startLineNumber: line, startColumn: column, endLineNumber: line, endColumn });
      } else {
        editor.setPosition({ lineNumber: line, column });
      }
      editor.focus();
      setPendingCursor(null);
    }, 0);
  }, [pendingCursor, activeTabId, activeTab?.content, editorMountVersion]);

  useEffect(() => {
    let active = true;
    let detach: (() => void) | null = null;
    listen<SearchProgressEvent>("project-search-progress", (event) => {
      const payload = event.payload;
      if (!payload || payload.requestId !== activeSearchRequestRef.current) return;
      if (payload.error) { toast.error(payload.error); setProjectSearchBusy(false); return; }
      if (payload.hits.length) {
        setProjectSearchHits((prev) => [...prev, ...payload.hits]);
        // Navigate to the very first hit as soon as it arrives — no waiting for done
        if (!autoNavHitRef.current) {
          autoNavHitRef.current = payload.hits[0];
          void openSearchHitRef.current(payload.hits[0]);
        }
      }
      setProjectSearchScannedFiles(payload.scannedFiles);
      setProjectSearchTotalHits(payload.totalHits);
      if (payload.done) {
        setProjectSearchBusy(false);
        toast(`Search done: ${payload.totalHits} matches, files: ${payload.scannedFiles}`);
      }
    }).then((unlisten) => {
      if (!active) { unlisten(); return; }
      detach = unlisten;
    });
    return () => { active = false; if (detach) detach(); };
  }, []);

  // Auto-close search panel when all tabs are closed
  useEffect(() => {
    if (tabs.length === 0 && searchPanelOpen) {
      setSearchPanelOpen(false);
      setVisibleTabId("");
      setFindQuery("");
      setProjectSearchQuery("");
      setProjectSearchHits([]);
      setProjectSearchScannedFiles(0);
      setProjectSearchTotalHits(0);
      setProjectSearchBusy(false);
    }
  }, [tabs.length, searchPanelOpen]);

  useEffect(() => {
    let active = true;
    let detach: (() => void) | null = null;
    listen<FileChangedEvent>("file-changed", (event) => {
      if (!active) return;
      const changedPath = event.payload.path;
      const affectedTab = tabsRef.current.find(
        (t) => normalizePath(t.path) === normalizePath(changedPath),
      );
      if (!affectedTab) return;

      if (!affectedTab.dirty) {

        void (async () => {
          try {
            const result = await openFile(affectedTab.path);
            setTabs((prev) =>
              prev.map((t) =>
                t.id === affectedTab.id
                  ? { ...t, content: result.content, savedContent: result.content, dirty: false }
                  : t,
              ),
            );
            toast(`File updated: ${affectedTab.name}`);
          } catch { /* ignore */ }
        })();
      } else {

        setExternalChangedPath(changedPath);
      }
    }).then((unlisten) => {
      if (!active) { unlisten(); return; }
      detach = unlisten;
    });
    return () => { active = false; if (detach) detach(); };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key;
      const keyLower = key.toLowerCase();
      const typingInField = isEditableTarget(event.target);

      if (event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
        const menuByLetter = MENU_KEYS.findIndex((mk) => mk[0] === keyLower);
        if (menuByLetter >= 0) {
          event.preventDefault();
          openMenuWithFocus(MENU_KEYS[menuByLetter]);
          return;
        }
      }

      if (openMenu) {
        if (key === "Escape") { event.preventDefault(); closeMenu(true); return; }
        if (key === "ArrowLeft") { event.preventDefault(); moveMenuFocus(-1); return; }
        if (key === "ArrowRight") { event.preventDefault(); moveMenuFocus(1); return; }
        if (key === "ArrowDown") {
          event.preventDefault();
          if (focusedMenuActionIndex < 0) {
            const first = findNextEnabledActionIndex(openMenu, -1, 1);
            if (first >= 0) setFocusedMenuActionIndex(first);
          } else { moveMenuActionFocus(1); }
          return;
        }
        if (key === "ArrowUp") {
          event.preventDefault();
          if (focusedMenuActionIndex < 0) {
            const last = findNextEnabledActionIndex(openMenu, 0, -1);
            if (last >= 0) setFocusedMenuActionIndex(last);
          } else { moveMenuActionFocus(-1); }
          return;
        }
        if (key === "Tab") { event.preventDefault(); moveMenuFocus(event.shiftKey ? -1 : 1); return; }
        if (key === "Enter" || key === " ") { event.preventDefault(); activateFocusedMenuAction(); return; }
      }

      // Helper: get currently selected text from Monaco editor
      const editorSelection = (): string | undefined => {
        const ed = editorRef.current;
        const sel = ed?.getSelection();
        const model = ed?.getModel();
        if (sel && !sel.isEmpty() && model) return model.getValueInRange(sel) || undefined;
        return undefined;
      };

      // IDE-wide shortcuts (use hotkeysRef.current — avoids stale closure)
      const hk = hotkeysRef.current;
      if (matchesBinding(event, hk.findInProject)) { event.preventDefault(); event.stopPropagation(); openProjectSearchPanel(editorSelection()); return; }
      if (matchesBinding(event, hk.settings))        { event.preventDefault(); event.stopPropagation(); setSettingsOpen(true); return; }
      if (matchesBinding(event, hk.commandPalette))  { event.preventDefault(); event.stopPropagation(); setCommandPaletteOpen(true); return; }

      // Editor / non-input shortcuts
      if (!typingInField && matchesBinding(event, hk.openFile))      { event.preventDefault(); void openSingleFile(); }
      if (!typingInField && matchesBinding(event, hk.save))          { event.preventDefault(); void saveActiveTab(); }
      if (!typingInField && matchesBinding(event, hk.closeTab))      { event.preventDefault(); if (activeTabId) requestCloseTab(activeTabId); }
      if (!typingInField && matchesBinding(event, hk.findInFile))    { event.preventDefault(); openFindPanel("find", editorSelection()); }
      if (!typingInField && matchesBinding(event, hk.replaceInFile)) { event.preventDefault(); openFindPanel("replace", editorSelection()); }

      // F-key bar actions (bare F1–F10, no modifiers)
      if (!event.ctrlKey && !event.altKey && !event.shiftKey && /^F\d+$/.test(key)) {
        const fIdx = parseInt(key.slice(1), 10) - 1;
        if (fIdx >= 0 && fIdx < fkeyActions.length) {
          const action = fkeyActions[fIdx];
          if (action) { event.preventDefault(); event.stopPropagation(); executeAction(action); return; }
        }
      }

      if (searchPanelOpen && key === "Escape") { event.preventDefault(); closeSearchTabs(); }

      // Tab cycling — uses hk.nextTab / prevTab
      const isTabNext = matchesBinding(event, hk.nextTab);
      const isTabPrev = matchesBinding(event, hk.prevTab);
      if (isTabNext || isTabPrev) {
        event.preventDefault();
        const allIds = [
          ...tabsRef.current.map((t) => t.id),
          ...(searchPanelOpen
            ? [searchMode === "file" ? FILE_SEARCH_TAB_ID : PROJECT_SEARCH_TAB_ID]
            : []),
        ];
        if (allIds.length < 2) return;
        const current = visibleTabId || activeTabId;
        const idx = allIds.indexOf(current);
        const next = isTabPrev
          ? (idx - 1 + allIds.length) % allIds.length
          : (idx + 1) % allIds.length;
        handleTabSelect(allIds[next]);
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [searchPanelOpen, searchMode, openMenu, focusedMenuIndex, focusedMenuActionIndex, activeTab, activeTabId, visibleTabId]); // menuActions excluded: it's a useMemo declared below; its real deps are included in deps


  const findNextEnabledActionIndex = (menuKey: MenuKey, startIndex: number, direction: 1 | -1): number => {
    const actions = menuActions[menuKey];
    if (!actions.length) return -1;
    let index = startIndex;
    for (let i = 0; i < actions.length; i += 1) {
      index = (index + direction + actions.length) % actions.length;
      if (!actions[index].disabled) return index;
    }
    return -1;
  };

  const openMenuWithFocus = (menuKey: MenuKey, preferredActionIndex?: number) => {
    const menuIndex = MENU_KEYS.indexOf(menuKey);
    setOpenMenu(menuKey);
    setFocusedMenuIndex(menuIndex);
    if (typeof preferredActionIndex === "number" && preferredActionIndex >= 0 && !menuActions[menuKey][preferredActionIndex]?.disabled) {
      setFocusedMenuActionIndex(preferredActionIndex);
      return;
    }
    setFocusedMenuActionIndex(findNextEnabledActionIndex(menuKey, -1, 1));
  };

  const closeMenu = (restoreFocus = false) => {
    const menuToFocus = openMenu;
    setOpenMenu(null);
    setFocusedMenuActionIndex(-1);
    if (restoreFocus && menuToFocus) {
      setTimeout(() => { menuButtonRefs.current[menuToFocus]?.focus(); }, 0);
    }
  };

  const runMenuAction = (action: () => void) => { closeMenu(); action(); };

  const moveMenuFocus = (direction: 1 | -1) => {
    const currentIndex = openMenu ? MENU_KEYS.indexOf(openMenu) : Math.max(focusedMenuIndex, 0);
    const nextIndex = (currentIndex + direction + MENU_KEYS.length) % MENU_KEYS.length;
    openMenuWithFocus(MENU_KEYS[nextIndex]);
  };

  const moveMenuActionFocus = (direction: 1 | -1) => {
    if (!openMenu) return;
    const nextIndex = findNextEnabledActionIndex(openMenu, focusedMenuActionIndex, direction);
    if (nextIndex >= 0) setFocusedMenuActionIndex(nextIndex);
  };

  const activateFocusedMenuAction = () => {
    if (!openMenu || focusedMenuActionIndex < 0) return;
    const action = menuActions[openMenu][focusedMenuActionIndex];
    if (action && !action.disabled) runMenuAction(action.onSelect);
  };


  const openSingleFile = async () => {
    if (!isTauriRuntime()) {
      toast.error("This action is available only in Tauri runtime. Run: npm run tauri -- dev");
      return;
    }
    try {
      const selected = await open({ directory: false, multiple: false });
      if (!selected || Array.isArray(selected)) return;
      await openFileFromTree(selected);
    } catch (error) {
      toast.error(`Operation failed: ${String(error)}`);
    }
  };

  const openProjectFolder = async () => {
    if (!isTauriRuntime()) {
      toast.error("This action is available only in Tauri runtime. Run: npm run tauri -- dev");
      return;
    }
    try {
      const selected = await open({ directory: true, multiple: false });
      if (!selected || Array.isArray(selected)) return;
      const result = await openProject(selected);
      setProjectRoot(result.rootPath);
      setTreeNodes(toNodes(result.entries));

      void watchProject(result.rootPath).catch(() => { /* watcher is optional */ });
    } catch (error) {
      toast.error(`Operation failed: ${String(error)}`);
    }
  };

  const createFolderHandler = async () => {
    if (!projectRoot) {
      toast.error("Open a project folder first to create a new folder.");
      return;
    }
    if (!isTauriRuntime()) {
      toast.error("This action is available only in Tauri runtime. Run: npm run tauri -- dev");
      return;
    }
    // Determine target: selected folder, or project root
    let targetPath = projectRoot;
    if (selectedTreePath) {
      const node = findNode(treeNodes, selectedTreePath);
      if (node?.isDir) {
        targetPath = selectedTreePath;
        // Ensure the folder is expanded so the inline input is visible
        if (!node.expanded) {
          await toggleFolder(selectedTreePath);
        }
      }
    }
    setCreatingFolderIn(targetPath);
  };

  /** Generate a unique folder name by appending _N suffix if needed */
  const getUniqueFolderName = (baseName: string, parentPath: string): string => {
    const parentNode = findNode(treeNodes, parentPath);
    if (!parentNode) return baseName;
    const existingNames = new Set(parentNode.children.map((c) => c.name));
    if (!existingNames.has(baseName)) return baseName;
    let i = 2;
    while (existingNames.has(`${baseName}_${i}`)) i++;
    return `${baseName}_${i}`;
  };

  const confirmCreateFolder = async (name: string) => {
    if (!creatingFolderIn) return;
    const trimmed = name.trim();
    if (!trimmed) { setCreatingFolderIn(null); return; }
    try {
      const uniqueName = getUniqueFolderName(trimmed, creatingFolderIn);
      const newPath = `${creatingFolderIn}/${uniqueName}`;
      await createFolder(newPath);
      setCreatingFolderIn(null);
      // Refresh the tree to show the new folder
      const result = await openProject(projectRoot!);
      setTreeNodes(toNodes(result.entries));
    } catch (error) {
      toast.error(`Operation failed: ${String(error)}`);
      setCreatingFolderIn(null);
    }
  };

  const cancelCreateFolder = () => {
    setCreatingFolderIn(null);
  };

  const runKill = async () => {
    if (!isTauriRuntime()) {
      toast.error("This action is available only in Tauri runtime.");
      return;
    }
    try {
      const result = await runKillScript();
      toast(result);
    } catch (error) {
      const msg = String(error);
      if (msg.includes("not found") || msg.includes("NOT_FOUND")) {
        toast("CNC processes are not running — nothing to kill.");
      } else {
        toast.error(`Kill script failed: ${msg}`);
      }
    }
  };

  const handleKillConfirm = () => {
    setKillDialogOpen(false);
    void runKill();
  };

  const toggleFolder = async (path: string) => {
    setSelectedTreePath(path);
    const nodeSnapshot = findNode(treeNodes, path);
    if (!nodeSnapshot || !nodeSnapshot.isDir) return;
    const willExpand = !nodeSnapshot.expanded;
    setTreeNodes((prev) => updateNode(prev, path, (node) => ({ ...node, expanded: willExpand })));
    if (!willExpand || nodeSnapshot.loaded) return;
    setBusyPath(path);
    try {
      const result = await listDir(path);
      setTreeNodes((prev) =>
        updateNode(prev, path, (node) => ({
          ...node, loaded: true, expanded: true, children: toNodes(result.entries),
        })),
      );
    } catch (error) {
      toast.error(`Operation failed: ${String(error)}`);
    } finally {
      setBusyPath("");
    }
  };

  const activateOrAddTab = (path: string, content: string, switchVisible = true, mode: EditorTabMode = "text", xlsxInfo?: XlsxWorkbookInfo) => {
    // Use tabsRef (always current) to avoid calling setState inside a setState updater
    const existing = tabsRef.current.find((tab) => tab.path === path);
    if (existing) {
      setActiveTabId(existing.id);
      if (switchVisible) setVisibleTabId(existing.id);
      if (existing.path.startsWith("help://")) {
        setTimeout(() => {
          const model = editorRef.current?.getModel();
          if (model) {
            monacoRef.current?.editor.setModelLanguage(model, "markdown");
          }
        }, 0);
      }
    } else {
      const newTab: EditorTab = {
        id: `${Date.now()}-${path}`, path, name: fileName(path),
        content, savedContent: content, dirty: false, mode, xlsxInfo,
      };
      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(newTab.id);
      if (switchVisible) setVisibleTabId(newTab.id);
      // Set language for virtual tabs (help:// etc.)
      if (path.startsWith("help://")) {
        // Will be set on next model change or via editor ref
        setTimeout(() => {
          const model = editorRef.current?.getModel();
          if (model && path.startsWith("help://")) {
            monacoRef.current?.editor.setModelLanguage(model, "markdown");
          }
        }, 0);
      }
    }
  };

  const isSpreadsheet = (path: string) => {
    const ext = path.split(".").pop()?.toLowerCase();
    return ext === "xlsx" || ext === "xls";
  };

  const openFileFromTree = async (
    path: string,
    cursor?: { line: number; column: number; matchLength?: number },
    switchVisible = true,
  ) => {
    setSelectedTreePath(path);
    try {
      if (isSpreadsheet(path)) {
        try {
          const info = await getXlsxInfo(path);
          activateOrAddTab(path, "", switchVisible, "spreadsheet", info);
        } catch (xlsxError) {
          // Create tab with error info so user sees something
          console.error("Failed to get xlsx info:", xlsxError);
          activateOrAddTab(path, "", switchVisible, "spreadsheet", { sheets: [] });
          toast.error(`XLSX Error: ${String(xlsxError)}`);
        }
      } else {
        const result = await openFile(path);
        activateOrAddTab(result.path, result.content, switchVisible, "text");
      }
      if (cursor) setPendingCursor(cursor);
      pushRecentFile(path);
    } catch (error) {
      toast.error(`Operation failed: ${String(error)}`);
    }
  };

  const updateActiveContent = (nextValue: string) => {
    if (!activeTabId) return;
    setTabs((prev) =>
      prev.map((tab) => {
        if (tab.id !== activeTabId) return tab;
        return { ...tab, content: nextValue, dirty: nextValue !== tab.savedContent };
      }),
    );
  };

  const openNewUntitledTab = () => {
    const id = `untitled-${Date.now()}`;
    const newTab: EditorTab = {
      id,
      path: `untitled://${id}`,
      name: "untitled",
      content: "",
      savedContent: "",
      dirty: false,
      mode: "text",
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(id);
    setVisibleTabId(id);
  };

  const saveTab = async (tab: EditorTab, mode: "manual" | "auto") => {
    if (tab.path.startsWith("help://")) return; // virtual tab, not savable
    if (!tab.dirty && !tab.path.startsWith("untitled://")) return;
    try {
      let targetPath = tab.path;
      if (tab.path.startsWith("untitled://")) {
        if (!isTauriRuntime()) { toast.error("Save As requires Tauri runtime."); return; }
        const selected = await save({ defaultPath: "untitled.txt" });
        if (!selected) return;
        targetPath = selected;
        const newName = selected.split(/[\\/]/).pop() ?? "untitled";
        setTabs((prev) => prev.map((t) =>
          t.id === tab.id ? { ...t, path: targetPath, name: newName } : t,
        ));
      }
      await saveFile({ path: targetPath, content: tab.content });
      setTabs((prev) => prev.map((item) =>
        item.id !== tab.id ? item : { ...item, savedContent: item.content, dirty: false },
      ));
      if (mode === "manual") toast(`Saved: ${targetPath}`);
    } catch (error) {
      toast.error(`Operation failed: ${String(error)}`);
    }
  };

  const saveActiveTab = async () => { if (activeTab) await saveTab(activeTab, "manual"); };

  const saveTabById = async (tabId: string, mode: "manual" | "auto") => {
    const tab = tabsRef.current.find((item) => item.id === tabId);
    if (tab) await saveTab(tab, mode);
  };

  const closeTabById = (tabId: string) => {
    setTabs((prev) => {
      const idx = prev.findIndex((tab) => tab.id === tabId);
      if (idx < 0) return prev;
      const next = [...prev.slice(0, idx), ...prev.slice(idx + 1)];

      // If closing the last tab, reset all tab-related state to prevent
      // stale references to search tabs or non-existent models.
      if (next.length === 0) {
        setActiveTabId("");
        setVisibleTabId("");
        return next;
      }

      const fallback = next[idx] ?? next[idx - 1] ?? null;
      if (activeTabId === tabId) {
        setActiveTabId(fallback ? fallback.id : "");
      }
      if (visibleTabId === tabId) {
        setVisibleTabId(fallback ? fallback.id : "");
      }
      return next;
    });
    // Reset search state after close — done outside setTabs so it fires reliably
    if (tabs.length <= 1) {
      setSearchPanelOpen(false);
      setFindQuery("");
      setProjectSearchQuery("");
      setProjectSearchHits([]);
      setProjectSearchScannedFiles(0);
      setProjectSearchTotalHits(0);
      setProjectSearchBusy(false);
      // Ensure visibleTabId doesn't point to a search tab that no longer exists
      setVisibleTabId("");
      setEditorMountVersion((v) => v + 1);
    }
  };

  const requestCloseTab = (tabId: string) => {
    const tab = tabsRef.current.find((t) => t.id === tabId);
    if (tab?.dirty) {
      setPendingCloseTabId(tabId);
    } else {
      closeTabById(tabId);
    }
  };


  const focusRange = (range: IRange) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.setSelection(range);
    editor.revealRangeInCenter(range);
    editor.focus();
  };

  const runFind = (query: string): IRange[] => {
    const editor = editorRef.current;
    const model = editor?.getModel();
    if (!editor || !model || !query) { setFindRanges([]); setFindIndex(0); return []; }
    const matches = model.findMatches(query, true, false, false, null, false);
    const ranges = matches.map((m) => m.range);
    setFindRanges(ranges);
    const selStart = editor.getSelection()?.getStartPosition();
    let idx = 0;
    if (selStart) {
      const found = ranges.findIndex((r) => samePosition(r, selStart.lineNumber, selStart.column));
      idx = found >= 0 ? found : 0;
    }
    setFindIndex(idx);
    if (ranges[idx]) focusRange(ranges[idx]);
    return ranges;
  };

  const navigateFind = (direction: 1 | -1) => {
    // If no ranges yet and we have a query, run find first
    let ranges = findRanges;
    if (!ranges.length && findQuery.trim()) {
      ranges = runFind(findQuery);
    }
    if (!ranges.length) return;
    const nextIndex = (findIndex + direction + ranges.length) % ranges.length;
    setFindIndex(nextIndex);
    focusRange(ranges[nextIndex]);
  };

  const replaceCurrent = () => {
    const editor = editorRef.current;
    const model = editor?.getModel();
    if (!editor || !model || !findRanges.length) return;
    editor.executeEdits("mtcode-replace-one", [{ range: findRanges[findIndex], text: replaceText }]);
    const ranges = runFind(findQuery);
    if (ranges.length) {
      const nextIndex = Math.min(findIndex, ranges.length - 1);
      setFindIndex(nextIndex);
      focusRange(ranges[nextIndex]);
    }
  };

  const replaceAll = () => {
    const editor = editorRef.current;
    const model = editor?.getModel();
    if (!editor || !model || !findQuery) return;
    const matches = model.findMatches(findQuery, true, false, false, null, false);
    if (!matches.length) return;
    editor.executeEdits("mtcode-replace-all", matches.map((m) => ({ range: m.range, text: replaceText })));
    toast(`Replaced: ${matches.length}`);
    runFind(findQuery);
  };

  const closeSearchTabs = () => {
    setSearchPanelOpen(false);
    if (visibleTabId === FILE_SEARCH_TAB_ID || visibleTabId === PROJECT_SEARCH_TAB_ID) {
      setVisibleTabId(activeTabId || "");
    }
  };

  const handleTabSelect = (id: string) => {
    if (id === FILE_SEARCH_TAB_ID) {
      setSearchPanelOpen(true);
      setSearchMode("file");
      setVisibleTabId(FILE_SEARCH_TAB_ID);
      setTimeout(() => {
        findInputRef.current?.focus();
        findInputRef.current?.select();
      }, 0);
      return;
    }
    if (id === PROJECT_SEARCH_TAB_ID) {
      setSearchPanelOpen(true);
      setSearchMode("project");
      setVisibleTabId(PROJECT_SEARCH_TAB_ID);
      setTimeout(() => {
        projectSearchInputRef.current?.focus();
        projectSearchInputRef.current?.select();
      }, 0);
      return;
    }
    setActiveTabId(id);
    setVisibleTabId(id);
  };

  const openFindPanel = (focusTarget: "find" | "replace" = "find", initialQuery?: string) => {
    setSearchMode("file");
    setSearchPanelOpen(true);
    setVisibleTabId(FILE_SEARCH_TAB_ID);
    const query = initialQuery !== undefined ? initialQuery : findQuery;
    if (initialQuery !== undefined) setFindQuery(initialQuery);
    // Delay runFind so Monaco has time to apply the new model after a tab switch
    setTimeout(() => {
      if (query) runFind(query);
      const target = focusTarget === "replace" ? replaceInputRef.current : findInputRef.current;
      target?.focus();
      target?.select();
    }, 0);
  };

  const openProjectSearchPanel = (initialQuery?: string) => {
    // Guard: onSelect handlers may pass a MouseEvent — ignore non-string arguments
    const query = typeof initialQuery === "string" ? initialQuery : undefined;
    setSearchMode("project");
    setSearchPanelOpen(true);
    setVisibleTabId(PROJECT_SEARCH_TAB_ID);
    if (query !== undefined) setProjectSearchQuery(query);
    setTimeout(() => {
      projectSearchInputRef.current?.focus();
      projectSearchInputRef.current?.select();
      // Auto-run when opened with a pre-filled word (e.g. from Ctrl+Shift+F or context menu)
      if (query?.trim()) {
        void runProjectSearch(projectSearchOpts, query);
      }
    }, 0);
  };

  const runProjectSearch = async (opts: ProjectSearchOptions, queryOverride?: string) => {
    if (!projectRoot) { toast.error("Open a project folder first."); return; }
    const query = (queryOverride !== undefined ? queryOverride : projectSearchQuery).trim();
    if (!query) { toast.error("Search query is empty."); return; }
    setProjectSearchBusy(true);
    setProjectSearchHits([]); setProjectSearchScannedFiles(0); setProjectSearchTotalHits(0);
    autoNavHitRef.current = null;
    try {
      const requestId = await searchProject({
        rootPath: projectRoot, query, maxResults: 5000,
        caseSensitive: opts.caseSensitive,
        wholeWord: opts.wholeWord,
        useRegex: opts.useRegex,
        invertMatch: opts.invertMatch,
        encUtf8: opts.encUtf8,
        encAnsi: opts.encAnsi,
        encAscii: opts.encAscii,
        encUtf16: opts.encUtf16,
      });
      activeSearchRequestRef.current = requestId;
    } catch (error) {
      setProjectSearchBusy(false);
      toast.error(`Operation failed: ${String(error)}`);
    }
  };

  const openSearchHit = async (hit: SearchHit, switchVisible = true) => {
    const query = projectSearchQuery.trim();
    const matchLength = query.length;
    await openFileFromTree(hit.path, { line: hit.line, column: hit.column, matchLength }, switchVisible);
    if (switchVisible && query) {
      // Open the in-file find bar so F3 / Shift+F3 navigate between matches
      openFindPanel("find", query);
    }
  };

  // Update always-current refs (called on every render before callbacks fire)
  // Auto-nav keeps the search panel visible (switchVisible=false)
  openSearchHitRef.current = (hit) => openSearchHit(hit, false);
  editorActionsRef.current.openFindPanel = openFindPanel;
  editorActionsRef.current.openProjectSearchPanel = openProjectSearchPanel;
  editorActionsRef.current.navigateFind = navigateFind;
  editorActionsRef.current.closeSearchTabs = closeSearchTabs;
  editorActionsRef.current.toggleBookmarkAtLine = toggleBookmarkAtLine;
  editorActionsRef.current.openCommandPalette = () => setTimeout(() => setCommandPaletteOpen(true), 0);
  editorActionsRef.current.searchPanelOpen = searchPanelOpen;
  editorActionsRef.current.searchMode = searchMode;


  const beforeEditorMount: BeforeMount = (monaco) => {
    // Register all themes from JSON
    for (const t of Object.values(THEMES)) {
      monaco.editor.defineTheme(t.monacoTheme, {
        base: t.monaco.base,
        inherit: t.monaco.inherit,
        rules: t.monaco.rules,
        colors: t.monaco.colors,
      });
    }
    registerPlcLanguage(monaco);
    registerPlcFormatter(monaco, plcValidationEnabledRef);
  };

  // ── Rainbow decoration updater — called on mount and every content change ──
  const updateRainbowDecorations = (editor: import("monaco-editor").editor.IStandaloneCodeEditor) => {
    const model = editor.getModel();
    if (!model) return;
    if (!rainbowDecorRef.current) {
      rainbowDecorRef.current = editor.createDecorationsCollection([]);
    }
    if (!plcRainbowEnabledRef.current || model.getLanguageId() !== PLC_LANGUAGE_ID) {
      try { rainbowDecorRef.current.clear(); } catch { rainbowDecorRef.current = null; }
      return;
    }
    const next = createRainbowDecorations(parseRainbowBlocks(model.getValue()));
    try {
      rainbowDecorRef.current.set(next);
    } catch {
      rainbowDecorRef.current = null;
    }
  };

  const onEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    setEditorMountVersion((v) => v + 1);

    // Remove Monaco's default F1 / Ctrl+Shift+P keybindings for quickCommand,
    // then attach our own handlers. The "-actionId" prefix is the official
    // Monaco API for removing a built-in keybinding.
    try {
      const kbs = (editor as unknown as { _standaloneKeybindingService: { addDynamicKeybinding: (id: string, k: undefined, h: () => void) => void } })
        ._standaloneKeybindingService;
      kbs.addDynamicKeybinding("-editor.action.quickCommand", undefined, () => {});
    } catch { /* ignore if internal API changes */ }
    // F1 is handled by the window-level keydown listener (capture phase) before
    // Monaco sees it, so no editor.addCommand needed for F1.
    // Ctrl+Shift+P is not in the window listener, so keep it here as a fallback.
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyP,
      () => { editorActionsRef.current.openCommandPalette(); },
    );

    // ── F7: format document (all languages) + PLC validation toast ────────
    editor.addCommand(monaco.KeyCode.F7, () => {
      const model = editor.getModel();
      if (!model) return;

      // For PLC files: validate first, show errors as toasts with navigation
      // (only when validation is enabled)
      if (model.getLanguageId() === PLC_LANGUAGE_ID && plcValidationEnabledRef.current) {
        const errors = validatePlc(model.getValue());
        if (errors.length > 0) {
          const first = errors[0];
          // Navigate to first error
          editor.revealLineInCenter(first.line);
          editor.setPosition({ lineNumber: first.line, column: first.col });
          editor.focus();
          // Show all errors as toasts
          for (const err of errors) {
            toast.error(`Ln ${err.line}: ${err.message}`, { duration: 6000 });
          }
          return;
        }
      }

      // Format document
      void editor.getAction("editor.action.formatDocument")?.run().then(() => {
        if (editor.getModel()?.getLanguageId() === PLC_LANGUAGE_ID) {
          toast("Formatted", { duration: 2000 });
        }
      });
    });

    // ── Disable Monaco's built-in find widget ──
    editor.updateOptions({
      find: {
        addExtraSpaceOnTop: false,
        autoFindInSelection: "never",
        seedSearchStringFromSelection: "never",
      },
    });

    const pos = editor.getPosition();
    if (pos) setCursorText(`Ln ${pos.lineNumber}, Col ${pos.column}`);
    editor.onDidChangeCursorPosition((event) => {
      setCursorText(`Ln ${event.position.lineNumber}, Col ${event.position.column}`);
    });

    // Click on line number or glyph margin → toggle bookmark
    editor.onMouseDown((e) => {
      // MouseTargetType.GUTTER_GLYPH_MARGIN = 2, GUTTER_LINE_NUMBERS = 3
      if ((e.target.type === 2 || e.target.type === 3) && e.target.position) {
        editorActionsRef.current.toggleBookmarkAtLine(e.target.position.lineNumber);
      }
    });

    // Initial rainbow pass
    updateRainbowDecorations(editor);

    // Attach PLC validator to the initial model (onDidCreateModel fires only for new models)
    const initialModel = editor.getModel();
    if (initialModel && initialModel.getLanguageId() === PLC_LANGUAGE_ID && plcValidationEnabledRef.current) {
      const initErrors = validatePlc(initialModel.getValue());
      monaco.editor.setModelMarkers(
        initialModel,
        "plc-validator",
        initErrors.map((e) => ({
          severity: e.severity === "error" ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
          message: e.message,
          startLineNumber: e.line, startColumn: e.col,
          endLineNumber: e.line, endColumn: initialModel.getLineMaxColumn(e.line),
        })),
      );
    }

    // Re-run on content change (debounced 200 ms)
    let rainbowTimer: ReturnType<typeof setTimeout> | null = null;
    editor.onDidChangeModelContent(() => {
      if (rainbowTimer) clearTimeout(rainbowTimer);
      rainbowTimer = setTimeout(() => updateRainbowDecorations(editor), 200);
    });

    // Re-run when the model is swapped (tab switch)
    editor.onDidChangeModel(() => {
      try { rainbowDecorRef.current?.clear(); } catch { /* ignore */ }
      rainbowDecorRef.current = null;
      try { bookmarkDecorRef.current?.clear(); } catch { /* ignore */ }
      bookmarkDecorRef.current = null;
      updateRainbowDecorations(editor);
      updateBookmarkDecorations();
      // If validation is currently disabled, ensure markers are cleared on the new model
      const model = editor.getModel();
      if (model && !plcValidationEnabledRef.current) {
        monaco.editor.setModelMarkers(model, "plc-validator", []);
      }
    });

    // Intercept keys inside Monaco before its own handlers
    editor.onKeyDown((e) => {
      const ref = editorActionsRef.current;

      // Ctrl+F → our find in file
      if (e.ctrlKey && !e.shiftKey && e.code === "KeyF") {
        e.preventDefault();
        e.stopPropagation();
        const sel = editor.getSelection();
        const model = editor.getModel();
        const query = (sel && !sel.isEmpty() && model) ? model.getValueInRange(sel) || undefined : undefined;
        ref.openFindPanel("find", query);
        return;
      }

      // Ctrl+H → our replace
      if (e.ctrlKey && !e.shiftKey && e.code === "KeyH") {
        e.preventDefault();
        e.stopPropagation();
        const sel = editor.getSelection();
        const model = editor.getModel();
        const query = (sel && !sel.isEmpty() && model) ? model.getValueInRange(sel) || undefined : undefined;
        ref.openFindPanel("replace", query);
        return;
      }

      // Ctrl+Shift+F → project search
      if (e.ctrlKey && e.shiftKey && e.code === "KeyF") {
        e.preventDefault();
        e.stopPropagation();
        const sel = editor.getSelection();
        const model = editor.getModel();
        const query = (sel && !sel.isEmpty() && model) ? model.getValueInRange(sel) || undefined : undefined;
        editorActionsRef.current.openProjectSearchPanel(query);
        return;
      }

      // Alt+↓ / Alt+↑ → navigate find results (when file search is open)
      if (e.altKey && !e.ctrlKey && !e.shiftKey && (e.code === "ArrowDown" || e.code === "ArrowUp")) {
        if (ref.searchPanelOpen && ref.searchMode === "file") {
          e.preventDefault();
          e.stopPropagation();
          ref.navigateFind(e.code === "ArrowDown" ? 1 : -1);
        }
        return;
      }

      // Escape → close find bar
      if (e.code === "Escape" && ref.searchPanelOpen) {
        e.preventDefault();
        e.stopPropagation();
        ref.closeSearchTabs();
      }
    });

    // Context menu: Find in File
    editor.addAction({
      id: "mtcode.findInFile",
      label: "Find in File",
      contextMenuGroupId: "mtcode_search",
      contextMenuOrder: 1,
      run: (ed) => {
        const sel = ed.getSelection();
        const model = ed.getModel();
        const query = (sel && !sel.isEmpty() && model) ? model.getValueInRange(sel) || undefined : undefined;
        editorActionsRef.current.openFindPanel("find", query);
      },
    });

    // Context menu: Find in Project
    editor.addAction({
      id: "mtcode.findInProject",
      label: "Find in Project",
      contextMenuGroupId: "mtcode_search",
      contextMenuOrder: 2,
      run: (ed) => {
        const sel = ed.getSelection();
        const model = ed.getModel();
        const query = (sel && !sel.isEmpty() && model) ? model.getValueInRange(sel) || undefined : undefined;
        editorActionsRef.current.openProjectSearchPanel(query);
      },
    });
  };


  const executeAction = (action: string) => {
    // Defer state updates so Monaco finishes its current event cycle before React re-renders
    const defer = (fn: () => void) => setTimeout(fn, 0);
    switch (action as HotkeyAction) {
      case "commandPalette":  defer(() => setCommandPaletteOpen(true)); break;
      case "save":            void saveActiveTab(); break;
      case "saveAs":          defer(() => void saveActiveTabAs()); break;
      case "saveAll":         void saveAllTabs(); break;
      case "openFile":        defer(() => void openSingleFile()); break;
      case "closeTab":        if (activeTabId) requestCloseTab(activeTabId); break;
      case "closeAll":        requestCloseAllTabs(); break;
      case "findInFile":      defer(() => openFindPanel("find")); break;
      case "replaceInFile":   defer(() => openFindPanel("replace")); break;
      case "findInProject":   defer(() => openProjectSearchPanel()); break;
      case "findNext":        navigateFind(1); break;
      case "findPrev":        navigateFind(-1); break;
      case "goTo":            defer(() => setGoToOpen(true)); break;
      case "toggleBookmark":  toggleBookmark(); break;
      case "nextBookmark":    navigateBookmark(1); break;
      case "prevBookmark":    navigateBookmark(-1); break;
      case "settings":        defer(() => setSettingsOpen(true)); break;
      case "toggleFold":      editorCommand("editor.toggleFold"); break;
      case "wordWrap":        setWordWrap((w) => (w === "off" ? "on" : "off")); break;
      case "killScript":      defer(() => setKillDialogOpen(true)); break;
      case "beautify":        defer(() => editorRef.current?.getAction("editor.action.formatDocument")?.run()); break;
    }
  };


  const handleReloadExternal = async () => {
    const path = externalChangedPath;
    if (!path) return;
    const tab = tabsRef.current.find((t) => normalizePath(t.path) === normalizePath(path));
    if (!tab) { setExternalChangedPath(null); return; }
    try {
      const result = await openFile(tab.path);
      setTabs((prev) =>
        prev.map((t) =>
          t.id === tab.id
            ? { ...t, content: result.content, savedContent: result.content, dirty: false }
            : t,
        ),
      );
      toast(`File reloaded: ${tab.name}`);
    } catch {
      toast.error(`Failed to reload file: ${path}`);
    }
    setExternalChangedPath(null);
  };

  const handleKeepExternal = () => { setExternalChangedPath(null); };


  const startSidebarResize = (event: ReactMouseEvent<HTMLDivElement>) => {
    sidebarResizeRef.current = { startX: event.clientX, startWidth: sidebarWidth };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    event.preventDefault();
  };


  const menuActions: Record<MenuKey, MenuAction[]> = useMemo(
  () => ({
    // ── FILE ──────────────────────────────────────────────────────────────────
    file: [
      { label: "New",                                    onSelect: () => openNewUntitledTab() },
      { label: "Open...",           shortcut: "Ctrl+O",  onSelect: () => void openSingleFile() },
      { label: "Open Folder...",                         onSelect: () => void openProjectFolder() },
      ...(recentFiles.length ? [{
        label: "Open Recent ▸",
        separatorBefore: false,
        onSelect: () => {},
        disabled: true,
      }, ...recentFiles.map((p) => ({
        label: `  ${p.split(/[\\/]/).pop() ?? p}`,
        onSelect: () => void openFileFromTree(p),
      }))] : []),
      { label: "Reload",            separatorBefore: true, onSelect: () => void reloadActiveTab(), disabled: !activeTab },
      { label: "Save",              shortcut: "Ctrl+S",   onSelect: () => void saveActiveTab(),    disabled: !activeTab },
      { label: "Save As...",        shortcut: "Ctrl+Shift+S", onSelect: () => void saveActiveTabAs(), disabled: !activeTab },
      { label: "Save a Copy As...",                       onSelect: () => void saveActiveTabAs(),  disabled: !activeTab },
      { label: "Save All",          shortcut: "Ctrl+Alt+S", onSelect: () => void saveAllTabs() },
      { label: "Rename...",         separatorBefore: true, onSelect: () => void renameActiveTab(), disabled: !activeTab || activeTab.path.startsWith("untitled://") },
      { label: "Delete",                                  onSelect: () => void deleteActiveTab(),  disabled: !activeTab || activeTab.path.startsWith("untitled://") },
      { label: "Move to Recycle Bin",                     onSelect: () => void trashActiveTab(),   disabled: !activeTab || activeTab.path.startsWith("untitled://") },
      { label: "Print...",          separatorBefore: true, onSelect: () => window.print(),          disabled: !activeTab },
      { label: "Close",             shortcut: "Ctrl+W",   onSelect: () => activeTab && requestCloseTab(activeTab.id), disabled: !activeTab, separatorBefore: true },
      { label: "Close All",         shortcut: "Ctrl+Shift+W", onSelect: requestCloseAllTabs },
      { label: "Close All But This",                      onSelect: requestCloseAllButActive,              disabled: tabs.length <= 1 },
      { label: "Exit",              separatorBefore: true, onSelect: requestAppClose },
    ],

    // ── EDIT ──────────────────────────────────────────────────────────────────
    edit: [
      { label: "Undo",              shortcut: "Ctrl+Z",   onSelect: () => editorCommand("undo"),                         disabled: !activeTab },
      { label: "Redo",              shortcut: "Ctrl+Y",   onSelect: () => editorCommand("redo"),                         disabled: !activeTab },
      { label: "Cut",               shortcut: "Ctrl+X",   onSelect: () => editorCommand("editor.action.clipboardCutAction"),    disabled: !activeTab, separatorBefore: true },
      { label: "Copy",              shortcut: "Ctrl+C",   onSelect: () => editorCommand("editor.action.clipboardCopyAction"),   disabled: !activeTab },
      { label: "Paste",             shortcut: "Ctrl+V",   onSelect: () => editorCommand("editor.action.clipboardPasteAction"),  disabled: !activeTab },
      { label: "Delete",            shortcut: "Del",      onSelect: () => editorCommand("deleteRight"),                   disabled: !activeTab },
      { label: "Select All",        shortcut: "Ctrl+A",   onSelect: () => editorCommand("editor.action.selectAll"),       disabled: !activeTab },
      // Blank operations
      { label: "Trim Trailing Space",  separatorBefore: true, onSelect: trimTrailingSpace,  disabled: !activeTab },
      { label: "Trim Leading Space",                         onSelect: trimLeadingSpace,     disabled: !activeTab },
      { label: "Remove Empty Lines",                         onSelect: () => removeEmptyLines(false), disabled: !activeTab },
      // Comment
      { label: "Toggle Line Comment",  shortcut: "Ctrl+/",  separatorBefore: true, onSelect: () => editorCommand("editor.action.commentLine"),      disabled: !activeTab },
      { label: "Toggle Block Comment", shortcut: "Ctrl+Shift+/",                   onSelect: () => editorCommand("editor.action.blockComment"),      disabled: !activeTab },
      // Case
      { label: "UPPERCASE",            separatorBefore: true, onSelect: () => transformSelection((s) => s.toUpperCase()), disabled: !activeTab },
      { label: "lowercase",                                   onSelect: () => transformSelection((s) => s.toLowerCase()), disabled: !activeTab },
      { label: "Proper Case",                                 onSelect: () => transformSelection(toProperCase),           disabled: !activeTab },
      { label: "Sentence case",                               onSelect: () => transformSelection(toSentenceCase),         disabled: !activeTab },
    ],

    // ── SEARCH ────────────────────────────────────────────────────────────────
    search: [
      { label: "Find in File...",   shortcut: "Ctrl+F",       onSelect: () => openFindPanel("find") },
      { label: "Global Search...",  shortcut: "Ctrl+Shift+F", onSelect: () => openProjectSearchPanel() },
      { label: "Replace...",        shortcut: "Ctrl+H",       onSelect: () => openFindPanel("replace"), disabled: !activeTab },
      { label: "Find Next",         shortcut: "Alt+↓",  onSelect: () => navigateFind(1),  disabled: !searchPanelOpen || searchMode !== "file", separatorBefore: true },
      { label: "Find Previous",     shortcut: "Alt+↑", onSelect: () => navigateFind(-1), disabled: !searchPanelOpen || searchMode !== "file" },
      { label: "Go To...",          shortcut: "Ctrl+G",       onSelect: () => setGoToOpen(true), disabled: !activeTab, separatorBefore: true },
      // Bookmarks
      { label: "Toggle Bookmark",   shortcut: "Ctrl+F2",      onSelect: toggleBookmark,         disabled: !activeTab, separatorBefore: true },
      { label: "Next Bookmark",     shortcut: "F2",           onSelect: () => navigateBookmark(1) },
      { label: "Previous Bookmark", shortcut: "Shift+F2",     onSelect: () => navigateBookmark(-1) },
      { label: "Clear All Bookmarks",                         onSelect: clearBookmarks },
    ],

    // ── VIEW ──────────────────────────────────────────────────────────────────
    view: [
      { label: "Command Palette",    shortcut: "F1",          onSelect: () => setCommandPaletteOpen(true) },
      { label: "Fold All",           separatorBefore: true,   onSelect: () => editorCommand("editor.foldAll"),   disabled: !activeTab },
      { label: "Unfold All",                                   onSelect: () => editorCommand("editor.unfoldAll"), disabled: !activeTab },
      { label: "Collapse Current Level",                       onSelect: () => editorCommand("editor.fold"),     disabled: !activeTab },
      { label: wordWrap === "off" ? "Word Wrap: On" : "Word Wrap: Off", shortcut: "Alt+Z",
        onSelect: () => setWordWrap((w) => w === "off" ? "on" : "off"), separatorBefore: true },
      { label: searchPanelOpen ? "Hide Search Panel" : "Show Search Panel",
        onSelect: () => { if (searchPanelOpen) closeSearchTabs(); else openFindPanel("find"); }, separatorBefore: true },
      { label: sidebarCollapsed ? "Show Project Tree" : "Hide Project Tree",
        onSelect: toggleSidebar },
      { label: "Dark/Light Mode",    separatorBefore: true,   onSelect: toggleTheme },
    ],

    // ── ENCODING ──────────────────────────────────────────────────────────────
    encoding: [
      { label: "Encode in UTF-8",       onSelect: () => void reloadAsEncoding("utf-8"),     disabled: !activeTab },
      { label: "Encode in ANSI",        onSelect: () => void reloadAsEncoding("ansi"),      disabled: !activeTab },
      { label: "Encode in UTF-8 BOM",   onSelect: () => void reloadAsEncoding("utf-8-bom"), disabled: !activeTab },
      { label: "Encode in UCS-2 LE",    onSelect: () => void reloadAsEncoding("utf-16le"),  disabled: !activeTab },
      { label: "Encode in UCS-2 BE",    onSelect: () => void reloadAsEncoding("utf-16be"),  disabled: !activeTab },
      { label: "Convert to UTF-8",      separatorBefore: true, onSelect: () => void convertEncoding("utf-8"),     disabled: !activeTab },
      { label: "Convert to ANSI",                              onSelect: () => void convertEncoding("ansi"),      disabled: !activeTab },
      { label: "Convert to UTF-8 BOM",                        onSelect: () => void convertEncoding("utf-8-bom"), disabled: !activeTab },
      { label: "Convert to UCS-2 LE",                         onSelect: () => void convertEncoding("utf-16le"),  disabled: !activeTab },
      { label: "Convert to UCS-2 BE",                         onSelect: () => void convertEncoding("utf-16be"),  disabled: !activeTab },
    ],

    // ── SETTINGS ──────────────────────────────────────────────────────────────
    settings: [
      { label: "Open Settings...", shortcut: "Ctrl+,", onSelect: () => setSettingsOpen(true) },
    ],

    // ── HELP ──────────────────────────────────────────────────────────────────
    help: [
      { label: "Help", onSelect: () => {
        const HELP_TAB = "help://guide";
        activateOrAddTab(HELP_TAB, HELP_CONTENT, true);
      }},
      { label: "About MTCode...", separatorBefore: true, onSelect: () => setAboutOpen(true) },
    ],
  }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [activeTab, findRanges.length, projectRoot, searchPanelOpen, searchMode, activeTabId, visibleTabId, recentFiles, tabs.length, wordWrap, sidebarCollapsed],
);


  const commandPaletteItems = useMemo<CommandPaletteItem[]>(() => {
    const result: CommandPaletteItem[] = [];
    for (const [menuKey, actions] of Object.entries(menuActions)) {
      for (const action of actions as MenuAction[]) {
        if (!action.label) continue;
        result.push({
          label: action.label,
          group: menuKey.toUpperCase(),
          shortcut: action.shortcut,
          disabled: action.disabled,
          onSelect: action.onSelect,
        });
      }
    }
    return result;
  }, [menuActions]);

  return (
    <div className="h-full grid" style={{ gridTemplateRows: "38px 1fr 20px 26px" }}>
      <MenuBar
        isDesktop={isTauriRuntime()}
        menuRef={menuRef as React.RefObject<HTMLElement>}
        menuButtonRefs={menuButtonRefs}
        menuActionRefs={menuActionRefs}
        menuActions={menuActions}
        openMenu={openMenu}
        focusedMenuIndex={focusedMenuIndex}
        focusedMenuActionIndex={focusedMenuActionIndex}
        onMenuOpen={openMenuWithFocus}
        onMenuClose={closeMenu}
        onRunAction={runMenuAction}
        onFocusMenuIndex={setFocusedMenuIndex}
        onFocusActionIndex={setFocusedMenuActionIndex}
      />

      <main className="flex min-h-0 overflow-hidden">
        {sidebarCollapsed ? (
          /* Collapsed sidebar strip */
          <div className="w-[28px] shrink-0 border-r border-border bg-card flex flex-col items-center pt-1">
            <button
              className="w-[20px] h-[20px] border border-border bg-transparent text-muted-foreground inline-flex items-center justify-center hover:text-foreground transition-colors"
              title="Show project tree"
              onClick={toggleSidebar}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" shapeRendering="crispEdges">
                <polyline points="3,1 7,5 3,9" stroke="currentColor" strokeWidth="1.5" fill="none" />
              </svg>
            </button>
          </div>
        ) : (
          <FileTree
            headerName={projectRoot ? fileName(projectRoot) : "No project"}
            treeNodes={treeNodes}
            busyPath={busyPath}
            sidebarWidth={sidebarWidth}
            onNewFile={() => openNewUntitledTab()}
            onCreateFolder={() => void createFolderHandler()}
            onToggleFolder={toggleFolder}
            onFileClick={openFileFromTree}
            onToggleCollapse={toggleSidebar}
            onOpenFolder={openProjectFolder}
            onStartResize={startSidebarResize}
            selectedTreePath={selectedTreePath}
            creatingFolderIn={creatingFolderIn}
            onConfirmCreateFolder={confirmCreateFolder}
            onCancelCreateFolder={cancelCreateFolder}
            projectRoot={projectRoot}
          />
        )}

        <section className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden bg-background">
                    <EditorTabs
            tabs={tabs}
            activeTabId={visibleTabId || activeTabId}
            searchTabs={searchPanelOpen ? [
              searchMode === "file"
                ? { id: FILE_SEARCH_TAB_ID, label: "Search: File", title: "Find and replace in current file" }
                : { id: PROJECT_SEARCH_TAB_ID, label: "Search: Project", title: "Search across project files" },
            ] : []}
            onTabClick={handleTabSelect}
            onTabClose={(id) => {
              if (id === FILE_SEARCH_TAB_ID || id === PROJECT_SEARCH_TAB_ID) {
                closeSearchTabs();
                return;
              }
              requestCloseTab(id);
            }}
            onNewTab={openNewUntitledTab}
          />

          {searchPanelOpen && searchMode === "file" && visibleTabId === FILE_SEARCH_TAB_ID ? (
            <FindBar
              query={findQuery}
              replaceText={replaceText}
              findRanges={findRanges}
              findIndex={findIndex}
              findInputRef={findInputRef as React.RefObject<HTMLInputElement>}
              replaceInputRef={replaceInputRef as React.RefObject<HTMLInputElement>}
              onQueryChange={(value) => {
                setFindQuery(value);
                runFind(value);
              }}
              onReplaceTextChange={setReplaceText}
              onNavigate={navigateFind}
              onReplaceCurrent={replaceCurrent}
              onReplaceAll={replaceAll}
              onClose={closeSearchTabs}
            />
          ) : null}

          <div className="editor-host flex-1 min-h-0 overflow-hidden">
            {searchPanelOpen && searchMode === "project" && visibleTabId === PROJECT_SEARCH_TAB_ID ? (
              <ProjectSearchPanel
                query={projectSearchQuery}
                busy={projectSearchBusy}
                hits={projectSearchHits}
                scannedFiles={projectSearchScannedFiles}
                totalHits={projectSearchTotalHits}
                inputRef={projectSearchInputRef as React.RefObject<HTMLInputElement>}
                opts={projectSearchOpts}
                onOptsChange={setProjectSearchOpts}
                onQueryChange={setProjectSearchQuery}
                onSearch={(opts) => void runProjectSearch(opts)}
                onHitClick={(hit) => void openSearchHit(hit)}
                collapsedByDefault={searchCollapsedByDefault}
              />
            ) : activeTab?.mode === "spreadsheet" && activeTab.xlsxInfo ? (
              <SpreadsheetView info={activeTab.xlsxInfo} path={activeTab.path} />
            ) : (
              <Editor
                theme={monacoTheme}
                height="100%"
                path={activeTab?.path || "untitled://new.txt"}
                language={activeLanguage}
                value={activeTab ? activeTab.content : "// Open a file from the project tree\n"}
                onChange={(value) => updateActiveContent(value ?? "")}
                beforeMount={beforeEditorMount}
                onMount={onEditorMount}
                options={{
                  minimap: { enabled: false },
                  glyphMargin: true,
                  scrollbar: {
                    vertical: "visible",
                    horizontal: "visible",
                    verticalScrollbarSize: 8,
                    horizontalScrollbarSize: 8,
                  },
                  fontFamily: `${fontFamily}, Consolas, monospace`,
                  fontSize: fontSize,
                  tabSize: tabSize,
                  wordWrap: wordWrap,
                  smoothScrolling: false,
                  automaticLayout: true,
                  readOnly: !activeTab,
                }}
              />
            )}
          </div>
        </section>
      </main>

      <div className="nc-fkeys border-t border-border">
        {fkeyActions.map((action, i) => {
          const label = action ? (FKEY_SHORT_LABELS[action as HotkeyAction] ?? action) : "";
          return (
            <button
              key={i}
              type="button"
              className="nc-fkey-btn"
              onClick={() => action && executeAction(action)}
              title={action ? `F${i + 1}: ${HOTKEY_LABELS[action as HotkeyAction] ?? action}` : `F${i + 1}`}
            >
              <span className="nc-fkey-num">{i + 1}</span>
              <span className="nc-fkey-label">{label}</span>
            </button>
          );
        })}
      </div>

      <StatusBar
        activeTab={activeTab}
        activeLanguage={activeLanguage}
        autosaveMode={autosaveMode}
        autosaveDelayMs={autosaveDelayMs}
        cursorText={cursorText}
        plcValidationEnabled={plcValidationEnabled}
        onAutosaveModeChange={setAutosaveMode}
        onDelayChange={setAutosaveDelayMs}
        onTogglePlcValidation={() => setPlcValidationEnabled((v) => !v)}
      />

      <ExternalChangeDialog
        path={externalChangedPath}
        isDirty={
          externalChangedPath
            ? (tabsRef.current.find(
                (t) => normalizePath(t.path) === normalizePath(externalChangedPath),
              )?.dirty ?? false)
            : false
        }
        onReload={() => void handleReloadExternal()}
        onKeep={handleKeepExternal}
      />

      <UnsavedChangesDialog
        open={unsavedCloseOpen}
        dirtyTabs={tabs.filter((t) => t.dirty)}
        onSaveAndExit={async () => {
          try {
            await saveAllDirtyTabs();
            setUnsavedCloseOpen(false);
            if (tabsRef.current.some((t) => t.dirty)) return;
            if (!isTauriRuntime()) { window.close(); return; }
            const { appWindow } = await import("@tauri-apps/api/window");
            await appWindow.close();
          } catch (e) {
            toast.error(String(e));
          }
        }}
        onDiscardAndExit={async () => {
          setUnsavedCloseOpen(false);
          if (!isTauriRuntime()) { window.close(); return; }
          const { appWindow } = await import("@tauri-apps/api/window");
          await appWindow.close();
        }}
        onCancel={() => setUnsavedCloseOpen(false)}
      />

      {/* Per-tab unsaved changes dialog */}
      {pendingCloseTabId && (() => {
        const tab = tabs.find((t) => t.id === pendingCloseTabId);
        if (!tab) return null;
        return (
          <div
            className="fixed inset-0 z-50 bg-background flex items-center justify-center"
            style={{
              backgroundImage: "radial-gradient(circle, hsl(var(--muted-foreground) / 0.12) 1px, transparent 1px)",
              backgroundSize: "14px 14px",
            }}
            onClick={() => setPendingCloseTabId(null)}
            role="dialog"
            aria-modal="true"
            aria-label="Unsaved changes"
          >
            <div
              className="bg-card border-2 border-border flex flex-col"
              style={{ width: 420, maxWidth: "95vw", boxShadow: "6px 6px 0 hsl(var(--border))" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted shrink-0">
                <span className="font-mono text-[11px] font-bold tracking-widest text-foreground select-none">
                  // UNSAVED CHANGES
                </span>
                <button
                  className="font-mono text-[11px] text-muted-foreground hover:text-foreground border border-border px-2 h-[22px] hover:bg-accent/10 transition-colors"
                  onClick={() => setPendingCloseTabId(null)}
                >
                  ×
                </button>
              </div>

              <div className="flex flex-col p-6 gap-4">
                <div className="font-mono text-[11px] text-muted-foreground leading-relaxed">
                  <div>{"> Есть несохранённые изменения в файле:"}</div>
                  <div className="mt-2 text-foreground">• {tab.name || tab.path}</div>
                  <div className="mt-3 opacity-80">
                    Сохранить перед закрытием?
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    className="font-mono text-[11px] tracking-wider text-muted-foreground border border-border px-4 h-[26px] hover:text-foreground hover:bg-accent/10 transition-colors"
                    onClick={() => setPendingCloseTabId(null)}
                  >
                    CANCEL
                  </button>
                  <button
                    className="font-mono text-[11px] tracking-wider text-muted-foreground border border-border px-4 h-[26px] hover:text-foreground hover:bg-accent/10 transition-colors"
                    onClick={() => {
                      closeTabById(pendingCloseTabId);
                      setPendingCloseTabId(null);
                    }}
                    title="Закрыть без сохранения"
                  >
                    DISCARD
                  </button>
                  <button
                    className="font-mono text-[11px] tracking-wider text-primary-foreground bg-primary border border-primary px-4 h-[26px] hover:opacity-90 transition-opacity"
                    onClick={async () => {
                      const currentTab = tabsRef.current.find((t) => t.id === pendingCloseTabId);
                      if (currentTab) {
                        await saveTab(currentTab, "manual");
                        // If save succeeded (tab no longer dirty or path changed), close it
                        const stillDirty = tabsRef.current.some((t) => t.id === pendingCloseTabId && t.dirty);
                        if (!stillDirty) {
                          closeTabById(pendingCloseTabId);
                        }
                      }
                      setPendingCloseTabId(null);
                    }}
                  >
                    SAVE & CLOSE
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      <SettingsModal
        open={settingsOpen}
        initial={{
          themeId,
          fontSize,
          fontFamily,
          tabSize,
          wordWrap,
          autosaveMode,
          autosaveDelayMs,
          hotkeys,
          searchCollapsedByDefault,
          plcRainbowEnabled,
          plcRainbowColors,
          fkeyActions,
        }}
        onSave={applySettings}
        onClose={() => setSettingsOpen(false)}
      />

      <AboutDialog
        open={aboutOpen}
        onClose={() => setAboutOpen(false)}
        version="0.1.0"
      />

      <GoToDialog
        open={goToOpen}
        onClose={() => setGoToOpen(false)}
        currentLine={parseInt(cursorText.match(/Ln\s*(\d+)/)?.[1] ?? "1", 10)}
        currentCol={parseInt(cursorText.match(/Col\s*(\d+)/)?.[1] ?? "1", 10)}
        maxLine={editorRef.current?.getModel()?.getLineCount() ?? 1}
        maxCol={editorRef.current?.getModel()?.getLineMaxColumn(
          parseInt(cursorText.match(/Ln\s*(\d+)/)?.[1] ?? "1", 10)) ?? 1}
        onGoTo={handleGoTo}
      />

      <KillDialog
        open={killDialogOpen}
        onConfirm={handleKillConfirm}
        onCancel={() => setKillDialogOpen(false)}
      />

      <CommandPalette
        open={commandPaletteOpen}
        items={commandPaletteItems}
        onClose={() => setCommandPaletteOpen(false)}
      />

      <Toaster />
    </div>
  );
}





































