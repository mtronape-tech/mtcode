# Changelog

All notable changes to MTCode are documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned
- File menu: Open Recent
- Edit menu: Toggle Comment, Trim Trailing/Leading Space, Remove Empty Lines, Case Conversion
- Encoding menu: Convert to UTF-8 / ANSI / UTF-16 LE/BE

---

## [0.2.1] — 2026-04-11

### Added — AI Assistant (Clippy)
- Animated Clippy character with spritesheet-based animation (124×93px frames, 22 columns)
- Draggable overlay — repositionable anywhere on screen without interfering with editor
- Interactive chat panel (300×320px) — opens on sprite click, auto-positions left/right based on screen edge
- Multi-turn conversation with full history sent on each request
- System prompt embeds current editor code as context for every message
- Auto-analysis triggered 4 s after content change when PLC validator finds errors
- Manual analysis via `Ctrl+Alt+A` or F-key bar button
- Clippy shows thinking/wave animations during AI processing

### Added — Ollama Integration (offline AI)
- Local LLM via Ollama — no cloud, no internet required
- Default model: `qwen2.5-coder:1.5b` (small, fast, code-aware)
- All Ollama calls proxied through Rust `reqwest` to bypass Tauri CSP restrictions
- `ollama_query` command — single prompt via `/api/generate`
- `ollama_chat` command — multi-turn conversation via `/api/chat`
- `ollama_check` command — reachability check via `/api/tags`
- `ollama_is_installed` command — detects Ollama in `%LOCALAPPDATA%\Programs\Ollama` and PATH
- `ollama_install` command — silent install from bundled `OllamaSetup.exe` with progress events
- Bundled model registration via `ollama create` from `model.gguf` (no download on first run)
- `OllamaSetupDialog` — guided install UI shown on first launch if Ollama is absent
- `scripts/prepare-ollama.mjs` — downloads installer + model for production builds; creates 1-byte stubs for `tauri dev`

### Added — AI Settings
- Settings → AI section: enable/disable toggle, server URL, model selector
- Supported models: qwen2.5-coder 1.5b / 3b / 7b, phi-4-mini, deepseek-r1:1.5b
- TEST button to verify Ollama reachability
- `Ctrl+Alt+A` hotkey for manual AI analysis (replaces Ctrl+Shift+I which conflicts with DevTools)

### Added — PLC-Aware AI Prompts
- System prompt includes full MNC PLC language reference (keywords, blocks, macros, built-ins)
- Validator errors passed to AI with line numbers and severity
- Responses: Russian language, max 3–4 sentences, no markdown, no filler phrases
- Error analysis: one line per error — what is broken and exactly how to fix it

### Changed
- AI analysis reads validator errors via direct `validatePlc()` call, not Monaco markers
- Spritesheet transparency: magenta color-key (255, 0, 255) replaced with alpha channel
- GSAP animation: entry/exit uses scale+opacity only; drag uses CSS left/top to avoid double-positioning

---

## [0.2.0] — 2026-04-08

### Added
- File menu: Save As, Save All, Reload, Close All, Close All But This
- Edit menu: Undo/Redo, Cut/Copy/Paste, Select All
- Search menu: Go To Line/Column dialog, Bookmarks (toggle/next/prev/clear)
- View menu: Fold All / Unfold All, Word Wrap toggle, Dark↔Light mode switch
- Help → About dialog with ASCII art
- VSCode Monokai theme (dark + light)
- Rename file, Delete file, Move to Recycle Bin
- PLC formatter (F7): correct indentation for IF/WHILE/OPEN blocks
- PLC validator: structural checks — OPEN/CLOSE, IF/ENDIF, WHILE/ENDWHILE, ELSE pairing
  - Indent-aware mismatch detection
  - Precise insertion hints for missing closers
  - Condition syntax check: IF/WHILE must have parenthesised condition
  - OPEN type validation: PLC, PLCC, PROG, FORWARD, INVERSE
- Animated AI Assistant overlay (Clippy) — GSAP entry/exit, draggable, spritesheet animation
- F-key bar: F7 Format/Validate added

### Fixed
- Editor height fills full remaining viewport after header/tabs/statusbar
- External-change detection false triggers on own saves (skip-list mechanism)
- WHILE (cond) WAIT and WHILE (cond) ENDWHILE treated as inline — no ENDWHILE expected
- Smart ENDIF/ENDWHILE insertion position skips blank/comment lines
- Indent-aware block mismatch: errors point to the missing keyword location, not opener

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

[0.2.1]: https://github.com/mtronape-tech/mtcode/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/mtronape-tech/mtcode/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/mtronape-tech/mtcode/releases/tag/v0.1.0
