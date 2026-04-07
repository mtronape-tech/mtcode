/**
 * Hotkey system — action definitions, defaults, and runtime matching.
 */

export type HotkeyAction =
  | "openFile" | "save" | "saveAs" | "saveAll" | "closeTab" | "closeAll"
  | "findInFile" | "replaceInFile" | "findInProject" | "findNext" | "findPrev"
  | "goTo" | "toggleBookmark" | "nextBookmark" | "prevBookmark"
  | "settings" | "nextTab" | "prevTab" | "toggleFold" | "wordWrap"
  | "commandPalette";

export const HOTKEY_LABELS: Record<HotkeyAction, string> = {
  openFile:        "Open file",
  save:            "Save file",
  saveAs:          "Save As...",
  saveAll:         "Save All",
  closeTab:        "Close tab",
  closeAll:        "Close all tabs",
  findInFile:      "Find in file",
  replaceInFile:   "Replace in file",
  findInProject:   "Global Search",
  findNext:        "Find next",
  findPrev:        "Find previous",
  goTo:            "Go To line/column",
  toggleBookmark:  "Toggle bookmark",
  nextBookmark:    "Next bookmark",
  prevBookmark:    "Previous bookmark",
  settings:        "Open settings",
  nextTab:         "Next tab",
  prevTab:         "Previous tab",
  toggleFold:      "Fold/unfold current",
  wordWrap:        "Toggle word wrap",
  commandPalette:  "Command palette",
};

/** Short labels for the F-key bar (max ~5 chars). */
export const FKEY_SHORT_LABELS: Partial<Record<HotkeyAction, string>> = {
  commandPalette: "Cmd",
  save:           "Save",
  saveAs:         "SvAs",
  saveAll:        "SvAll",
  openFile:       "Open",
  closeTab:       "Close",
  closeAll:       "ClAll",
  findInFile:     "Find",
  replaceInFile:  "Rplce",
  findInProject:  "Srch",
  findNext:       "Next",
  findPrev:       "Prev",
  goTo:           "GoTo",
  toggleBookmark: "Mark",
  nextBookmark:   "NxMk",
  prevBookmark:   "PvMk",
  settings:       "Set",
  nextTab:        "NxTab",
  prevTab:        "PvTab",
  toggleFold:     "Fold",
  wordWrap:       "Wrap",
};

/** Default action assigned to each F-key (index 0 = F1 … index 9 = F10). null = unassigned. */
export const FKEY_DEFAULT_ACTIONS: (HotkeyAction | null)[] = [
  "commandPalette", // F1
  "save",           // F2
  "findInFile",     // F3
  "replaceInFile",  // F4
  "findInProject",  // F5
  "goTo",           // F6
  "toggleFold",     // F7
  "closeTab",       // F8
  "wordWrap",       // F9
  "settings",       // F10
];

export const HOTKEY_DEFAULTS: Record<HotkeyAction, string> = {
  openFile:        "Ctrl+O",
  save:            "Ctrl+S",
  saveAs:          "Ctrl+Shift+S",
  saveAll:         "Ctrl+Alt+S",
  closeTab:        "Ctrl+W",
  closeAll:        "Ctrl+Shift+W",
  findInFile:      "Ctrl+F",
  replaceInFile:   "Ctrl+H",
  findInProject:   "Ctrl+Shift+F",
  findNext:        "Alt+↓",
  findPrev:        "Alt+↑",
  goTo:            "Ctrl+G",
  toggleBookmark:  "Ctrl+F2",
  nextBookmark:    "F2",
  prevBookmark:    "Shift+F2",
  settings:        "Ctrl+,",
  nextTab:         "Ctrl+PageDown",
  prevTab:         "Ctrl+PageUp",
  toggleFold:      "Ctrl+Shift+[",
  wordWrap:        "Alt+Z",
  commandPalette:  "F1",
};

/** Merge stored hotkeys with defaults (stored values win). */
export function resolveHotkeys(stored: Partial<Record<string, string>>): Record<HotkeyAction, string> {
  const result = { ...HOTKEY_DEFAULTS };
  for (const key of Object.keys(HOTKEY_DEFAULTS) as HotkeyAction[]) {
    if (stored[key]) result[key] = stored[key]!;
  }
  return result;
}

/**
 * Returns true when a KeyboardEvent matches a binding string like "Ctrl+Shift+F".
 */
export function matchesBinding(e: KeyboardEvent, binding: string): boolean {
  if (!binding) return false;
  const parts = binding.split("+");
  const needsCtrl  = parts.includes("Ctrl");
  const needsShift = parts.includes("Shift");
  const needsAlt   = parts.includes("Alt");
  const keyPart    = parts.find((p) => !["Ctrl", "Shift", "Alt"].includes(p)) ?? "";

  if (!!e.ctrlKey  !== needsCtrl)  return false;
  if (!!e.shiftKey !== needsShift) return false;
  if (!!e.altKey   !== needsAlt)   return false;
  if (!keyPart)                    return false;

  if (keyPart === "↓" && e.key === "ArrowDown") return true;
  if (keyPart === "↑" && e.key === "ArrowUp")   return true;
  if (e.key.toLowerCase() === keyPart.toLowerCase()) return true;
  if (keyPart.length === 1 && e.code === `Key${keyPart.toUpperCase()}`) return true;
  if (e.code === keyPart) return true;

  return false;
}

/** Format a KeyboardEvent into a binding string for the key recorder. */
export function eventToBinding(e: KeyboardEvent): string | null {
  if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return null;

  const parts: string[] = [];
  if (e.ctrlKey)  parts.push("Ctrl");
  if (e.altKey)   parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");

  const key =
    e.key === "ArrowDown"  ? "↓" :
    e.key === "ArrowUp"    ? "↑" :
    e.key === "PageDown"   ? "PageDown" :
    e.key === "PageUp"     ? "PageUp" :
    e.key.length === 1     ? e.key.toUpperCase() :
    e.key;

  parts.push(key);
  return parts.join("+");
}
