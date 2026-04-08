// Shared domain types — imported by App and components alike.
// DO NOT import from App.tsx here (would be circular).

export type TreeNode = {
  name: string;
  path: string;
  isDir: boolean;
  expanded: boolean;
  loaded: boolean;
  children: TreeNode[];
};

export type EditorTab = {
  id: string;
  path: string;
  name: string;
  content: string;
  savedContent: string;
  dirty: boolean;
  /** Detected or user-set encoding for save (default "utf-8") */
  encoding?: string;
};

export type MenuKey = "file" | "edit" | "search" | "view" | "encoding" | "settings" | "help";

export type MenuAction = {
  label: string;
  shortcut?: string;
  onSelect: () => void;
  disabled?: boolean;
  separatorBefore?: boolean;
  /** Sub-group title — renders as a small non-clickable header */
  groupTitle?: string;
};

/** Bookmark set: file path → sorted set of 1-based line numbers */
export type BookmarkMap = Map<string, Set<number>>;
