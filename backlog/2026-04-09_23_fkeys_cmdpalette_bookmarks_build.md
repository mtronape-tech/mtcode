# Session: F-keys, Command Palette, Bookmarks, Build fixes

**Date:** 2026-04-09
**Status:** Done

---

## Features added

### Configurable F-key bar
- All F1–F10 keys are now bindable via **Settings → F-KEYS** tab
- Each key has a dropdown with all available actions
- RST button resets to defaults
- Stored in `AppSettings.fkeyActions`
- `FKEY_DEFAULT_ACTIONS`, `FKEY_SHORT_LABELS` in `src/lib/hotkeys.ts`

### Custom Command Palette
- Replaced Monaco's built-in palette with a custom searchable overlay (`src/components/CommandPalette.tsx`)
- Lists all menu/editor actions with hotkey labels
- Bound to F1 and Ctrl+Shift+P
- Monaco's default `quickCommand` keybinding removed via `_standaloneKeybindingService.addDynamicKeybinding("-editor.action.quickCommand")`

### Bookmark click on line number gutter
- Click on line number or glyph margin toggles a bookmark
- Bookmarks stored per-file path in `BookmarkMap`
- Visual indicator via `bookmark-glyph` CSS class

### Menu label fix
- "Find in project" → "Global Search" (short label for F-key bar: "Glob")
- Norton Dark theme comment color improved for readability

---

## Build fixes

### xlsx/calamine support removed
- `calamine` crate removed from `Cargo.toml`
- `get_xlsx_info` command removed from `src-tauri/src/commands.rs` and `main.rs`
- `SpreadsheetView.tsx` deleted
- All xlsx types/functions removed from `src/services/ipc.ts` and `src/App.tsx`
- `EditorTabMode`, `xlsxInfo` removed from `src/types.ts`

### WebView2 build lock fix
- `src-tauri/tauri.dev.conf.json` — `webviewInstallMode: { type: "skip" }` for dev builds
- `tauri.conf.json` — also set to `skip` to unblock all builds
- `npm run tauri:dev` script uses dev config

### GitHub Actions release workflow
- Build target: **Windows only** (removed ubuntu/macos)
- Produces installer: `MTCode_*_x64-setup.exe`
- Produces portable: `MTCode_*_Portable_x64.zip` (exe + kill.bat)
- Uses `softprops/action-gh-release@v2` for asset upload

---

## Crash fixes

### `removeChild` DOM error on tab switch / Fold
- `onDidChangeModel` fired during Monaco model transition (DOM unstable)
- Fix: null decoration refs immediately, defer `updateRainbowDecorations` via `setTimeout(0)`
- Removed `updateBookmarkDecorations()` from `onDidChangeModel` (stale closure)

### `Illegal value for lineNumber` on new tab
- `updateBookmarkDecorations` in `onDidChangeModel` had stale `activeTab` closure
- Applied old file's bookmarks to new empty model → invalid line numbers
- Fix 1: removed call from `onDidChangeModel` (React effect handles it correctly)
- Fix 2: added `filter(ln => ln >= 1 && ln <= lineCount)` guard in decoration builder
- Fix 3: `handleGoTo` now clamps line/col before calling Monaco APIs
- Fix 4: `GoToDialog` `maxCol` prop computed with safe clamp in render (was crashing on `getLineMaxColumn(0)`)
