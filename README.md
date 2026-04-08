```
     ____  __  __ _____ ____          _      
    / / / |  \/  |_   _/ ___|___   __| | ___ 
   / / /  | |\/| | | || |   / _ \ / _` |/ _ \
  / / /   | |  | | | || |__| (_) | (_| |  __/
 /_/_/    |_|  |_| |_| \____\___/ \__,_|\___|
                                             
```

Desktop code editor for PLC programming (Mechatronika).
Built with Tauri + React + Monaco Editor. Targets Windows 7+, works fully offline.

## Features

- PLC syntax highlighting with rainbow block nesting
- File and project tree with lazy directory loading
- Project-wide search with streaming results
- Find & Replace in file
- Bookmarks with glyph margin indicators
- Multi-encoding support: UTF-8, UTF-8 BOM, ANSI (Windows-1251), UCS-2 LE/BE
- Autosave (off / on focus change / delayed)
- Themes: Monokai, MTCode (Mahogany/Linen), Norton

## Stack

- **Frontend:** React, TypeScript, Monaco Editor, Tailwind CSS
- **Backend:** Rust (Tauri), encoding_rs
- **Build:** Vite, NSIS installer, bundled WebView2 runtime

## Dev

```
npm install
npm run tauri dev
```

## Build

```
npm run tauri build
```
