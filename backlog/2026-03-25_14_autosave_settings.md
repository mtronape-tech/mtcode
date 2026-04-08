# MTCode Backlog Snapshot
Дата: 2026-03-25
Снимок: 14 (Autosave + settings persistence)
Статус проекта: в работе

## Что сделано
- [x] Добавлены Rust-команды настроек:
  - load_settings
  - save_settings
- [x] Настройки сохраняются в локальный файл `%APPDATA%\MTCode\settings.json`.
- [x] Добавлены режимы autosave в UI:
  - off
  - focus-change
  - delayed
- [x] Реализованы сценарии autosave:
  - при переключении вкладки (focus-change)
  - при blur окна (focus-change)
  - по таймеру (delayed)
- [x] Добавлено управление autosave в статус-баре (mode + delay ms).
- [x] Выполнена сборка `npm run build` — успешно.

## Прогресс эпиков
### EPIC-2: Native core
- [x] P2.1 Открытие/сохранение файлов
- [x] P2.2 Открытие проекта
- [x] P2.3 Ленивая загрузка дерева
- [x] P2.4 Поиск по проекту
- [ ] P2.5 File watcher

## Следующие шаги
1. Добавить file watcher в Rust и событие внешнего изменения файла.
2. Показать UI-диалог при конфликте (dirty + file changed externally).
3. Добавить переключение encoding/EOL/language в статус-баре (пока readout).

## Файлы итерации
- src-tauri/src/commands.rs
- src-tauri/src/main.rs
- src/services/ipc.ts
- src/App.tsx
- src/styles/app.css
