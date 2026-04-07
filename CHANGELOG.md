# Changelog

All notable changes to MTCode are documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- File menu: Save As, Save All, Reload, Close All, Close All But This, Open Recent
- Edit menu: Undo/Redo, Cut/Copy/Paste, Select All, Toggle Comment,
  Trim Trailing/Leading Space, Remove Empty Lines, Case Conversion
- Search menu: Go To Line/Column dialog, Bookmarks (toggle/next/prev/clear)
- View menu: Fold All / Unfold All, Word Wrap toggle, Dark↔Light mode switch
- Encoding menu: Convert to UTF-8 / ANSI / UTF-16 LE/BE
- Help → About dialog with ASCII art
- VSCode Monokai theme (dark + light)
- Rename file, Delete file, Move to Recycle Bin

---

## [0.1.0] — 2026-04-07

### Added
- Monaco-based code editor with multi-tab support and tab dirty indicator
- Project tree (sidebar) with drag-resize and collapsible panel
- File open / save / autosave (off / focus-change / delayed)
- Project folder search with regex, case-sensitive, whole-word, encoding filters
- In-file find & replace with highlight navigation (F3 / Shift+F3)
- External-change detection — reload or keep dialog
- Settings modal: theme, font size, tab size, word wrap, autosave, hotkeys,
  search defaults, PLC rainbow block colors
- Norton Commander theme (dark + light) with F-key bar, NC-style header
- MTCode Mahogany (dark) and Linen (light) themes
- PLC / CFG / PMC language support (Mechatronika MNC):
  - Monarch syntax tokenizer (keywords, macros, comments, preprocessor)
  - Rainbow block highlighting (IF/WHILE/OPEN nesting depth colors 0-9)
  - Theme-adaptive palettes (auto dark / light)
  - Settings: enable/disable, per-level color pickers
- Custom themed scrollbars matching Monaco scrollbars
- Status bar: file path, encoding (UTF-8), cursor position, autosave mode,
  dark↔light mode toggle
- F-key bar (all themes): F2 Save, F3 Find, F4 Replace, F5 Project Search,
  F8 Close, F10 Settings
- SemVer versioning starting at v0.1.0

[0.1.0]: https://github.com/mtronape-tech/mtcode/releases/tag/v0.1.0
