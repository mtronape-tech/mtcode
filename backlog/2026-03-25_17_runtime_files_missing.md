# MTCode Backlog Snapshot
Дата: 2026-03-25
Снимок: 17 (Runtime files diagnostic)
Статус проекта: блокер подтвержден

## Диагностика
- Проверен каталог `src-tauri/webview2-fixed-runtime`.
- Подкаталоги `x64` и `x86` существуют, но файлов внутри нет.

## Вывод
- npm-пакеты действительно установлены.
- Блокер не в npm: отсутствуют сами runtime-файлы WebView2 Fixed 109.

## Что требуется
1. Распаковать WebView2 Fixed Runtime 109 x64 в `src-tauri/webview2-fixed-runtime/x64`.
2. Распаковать WebView2 Fixed Runtime 109 x86 в `src-tauri/webview2-fixed-runtime/x86`.
3. Проверить, что есть `msedgewebview2.exe` в обоих папках.
4. Повторить `npm run tauri -- dev`.
