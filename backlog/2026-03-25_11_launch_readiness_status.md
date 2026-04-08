# MTCode Backlog Snapshot
Дата: 2026-03-25
Снимок: 11 (Launch readiness status)
Статус проекта: блокер на runtime-артефакте

## Проверки, которые пройдены
- [x] npm install — успешно
- [x] npm run build (frontend) — успешно
- [x] Rust/Tauri код компилируется до этапа bundle-конфигурации

## Текущий блокер запуска Tauri build
- [ ] Для `webviewInstallMode: fixedRuntime` требуется фактическая папка WebView2 Fixed Runtime 109.
- [ ] Сейчас в `src-tauri/webview2-fixed-runtime/x64` и `x86` только placeholder-каталоги.
- [ ] Из-за этого `tauri build` останавливается с ошибкой path matching not found.

## Что нужно для полного теста desktop-приложения
1. Положить распакованный WebView2 Fixed Runtime 109 x64 в `src-tauri/webview2-fixed-runtime/x64`.
2. Положить распакованный WebView2 Fixed Runtime 109 x86 в `src-tauri/webview2-fixed-runtime/x86`.
3. Добавить dual-config/pipeline для x64/x86 сборки.
4. Повторить `npm run tauri -- build --debug`.

## Что уже можно тестировать прямо сейчас
- Frontend shell и UI-логику можно тестировать через Vite dev/runtime.
- Функции open/save/tree/find/project-search реализованы в коде, но desktop bundle пока упирается в runtime-артефакт.

## Файлы итерации
- backlog/2026-03-25_11_launch_readiness_status.md
