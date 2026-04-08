# MTCode

```
      ___  ___      ___      ___  ___________  ______    ______    ________    _______
     /"  |/"  |    |"  \    /"  |("     _   ")/" _  "\  /    " \  |"      "\  /"     "|
    /  ///  //      \   \  //   | )__/  \\__/(: ( \___)// ____  \ (.  ___  :)(: ______)
   /'  //'  /       /\\  \/.    |    \\_ /    \/ \    /  /    ) :)|: \   ) || \/    |
  //  ///  /       |: \.        |    |.  |    //  \ _(: (____/ // (| (___\ || // ___)_
 /  ///  //        |.  \    /:  |    \:  |   (:   _) \\        /  |:       :)(:      "|
|___/|___/         |___|\__/|___|     \__|    \_______)\"_____/   (________/  \_______)

```

Desktop code editor for PLC programming (Mechatronika).
Built with Tauri + React + Monaco Editor. Targets Windows 7+, works fully offline.

## Downloads

| Platform | Format | Download |
|---|---|---|
| **Windows** | NSIS Installer (.exe) | [Latest Release](https://github.com/mtronape-tech/mtcode/releases/latest) |
| **Linux** | Debian Package (.deb) | [Latest Release](https://github.com/mtronape-tech/mtcode/releases/latest) |
| **macOS** | Disk Image (.dmg) | [Latest Release](https://github.com/mtronape-tech/mtcode/releases/latest) |

> All releases include embedded WebView2 runtime — no installation required.

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

## Release

To create a new release with binaries for all platforms:

```
release.bat 0.2.0
```

This updates version numbers, creates a git tag, and pushes to GitHub. GitHub Actions will automatically build installers for Windows, Linux, and macOS, then attach them to a new Release draft.
