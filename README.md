```
  ___  ___      ___      ___  ___________  ______    ______    ________    _______
 /"  |/"  |    |"  \    /"  |("     _   ")/" _  "\  /    " \  |"      "\  /"     "|
/  ///  //      \   \  //   | )__/  \\__/(: ( \___)// ____  \ (.  ___  :)(: ______)
/'  //'  /       /\  \/.    |    \\_  /    \/ \    /  /    ) :)|: \   ) || \/    |
//  ///  /       |: \.        |    |.  |    //  \ _(: (____/ // (| (___|\  || // ___)_
/  ///  //        |.  \    /:  |    \:  |   (:   _) \\        /  |:       :)(:      "|
|___/|___/         |___|\__/|___|     \__|    \_______)\\"_____/   (________/  \________)
```

Desktop code editor for PLC programming (Mechatronika VMB630).
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
