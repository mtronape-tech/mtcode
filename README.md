# MTCode

<p align="center">
  <strong>Desktop code editor for PLC programming & general purpose editing</strong><br>
  <small>Fast · Lightweight · Offline-first · Windows 7+ Compatible</small>
</p>

---

## ⬇️ Download

| Platform | Type | Link |
|---|---|---|
| **Windows** | 🔧 Installer (NSIS) | [Download .exe](https://github.com/mtronape-tech/mtcode/releases/latest) |
| **Windows** | 📦 Portable (no install) | [Download .zip](https://github.com/mtronape-tech/mtcode/releases/latest) |
| **Linux** | 📦 Debian Package | [Download .deb](https://github.com/mtronape-tech/mtcode/releases/latest) |
| **macOS** | 💿 Disk Image | [Download .dmg](https://github.com/mtronape-tech/mtcode/releases/latest) |

> All Windows builds include embedded WebView2 runtime — no additional setup required.

[**📋 View all releases →**](https://github.com/mtronape-tech/mtcode/releases)

---

## ✨ Features

### Editor
- **Monaco Editor** engine (same as VS Code) with full IntelliSense
- **Multi-encoding** support: UTF-8, UTF-8 BOM, ANSI (CP1251), KOI8-R, IBM866, UCS-2 LE/BE
- **Bookmarks** with glyph margin indicators and keyboard navigation
- **Find & Replace** with regex, whole-word, case-sensitive options
- **Auto-save** modes: off / on focus change / delayed timer
- **Encoding conversion** — re-save files in different encodings on the fly

### Project
- **File tree** with lazy directory loading for large projects
- **Project-wide search** with streaming results, glob include/exclude filters
- **External change detection** — warns when files are modified outside the editor
- **Kill CNC script** — built-in hotkey to terminate background CNC processes

### PLC Support
- **Syntax highlighting** for PLC languages (IF/WHILE/OPEN/CLOSE blocks)
- **Rainbow nesting** — color-coded block levels for visual clarity
- **Preprocessor directives** — `#ifdef` / `#ifndef` / `#else` / `#endif` with folding
- **Validation** — syntax checking with error markers and toast notifications
- **Beautify** — auto-format document (F7)

### Interface
- **6 themes** across 3 families: Monokai, MTCode (Mahogany/Linen), Norton
- **8 monospace fonts** including JetBrains Mono (default)
- **Norton Commander** aesthetic mode with authentic navy/yellow palette
- **Command palette** (F1) for keyboard-driven workflow
- **Customizable hotkeys** and F-key bar actions

---

## 🎮 Hotkeys

| Key | Action |
|---|---|
| `Ctrl+O` | Open file |
| `Ctrl+S` | Save |
| `Ctrl+Shift+S` | Save As |
| `Ctrl+Shift+Alt+S` | Save All |
| `Ctrl+W` | Close tab |
| `Ctrl+F` | Find |
| `Ctrl+H` | Replace |
| `Ctrl+Shift+F` | Project search |
| `Ctrl+G` | Go to line |
| `F2` | Toggle bookmark |
| `F7` | Format / Beautify |
| `F8` | Close tab |
| `F9` | Kill CNC processes |
| `F10` | Settings |
| `Alt+Z` | Word wrap |
| `F1` | Command palette |
| `Ctrl+,` | Settings |

---

## 🖥️ Screenshots

| Dark (Monokai) | Norton Commander |
|---|---|
| *(Coming soon)* | *(Coming soon)* |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, TypeScript, Tailwind CSS |
| **Editor** | Monaco Editor (VS Code engine) |
| **Backend** | Rust (Tauri framework) |
| **Encoding** | `encoding_rs` for multi-byte support |
| **Excel** | `calamine` for xlsx/xls parsing |
| **Search** | `regex` for pattern matching |
| **File Watch** | `notify` for filesystem events |
| **Build** | Vite, NSIS installer |

---

## 📦 Development

### Prerequisites

```bash
# Node.js 18+ and Rust toolchain required
rustup default stable
npm install -g tauri-cli
```

### Run

```bash
npm install
npm run tauri dev
```

### Build

```bash
npm run tauri build
```

### Portable Build

```bash
# Build produces .zip alongside .exe in src-tauri/target/release/bundle/
# Just unzip and run — no installation needed
```

---

## 🚀 Release

Create a new release with binaries for all platforms:

```bash
release.bat 0.2.0
```

This script:
1. Updates `package.json` and `tauri.conf.json` versions
2. Creates git tag `v0.2.0`
3. Pushes to GitHub → triggers automated builds
4. Binaries appear on [Releases page](https://github.com/mtronape-tech/mtcode/releases) within 10-15 minutes

---

## 📝 License

Proprietary — © 2024 MTCode Team. All rights reserved.

---

<p align="center">
  <small>Built with ❤️ for PLC programmers everywhere</small>
</p>
