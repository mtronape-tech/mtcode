# MTCode Backlog Snapshot
Дата: 2026-03-25
Снимок: 09 (Project search streaming)
Статус проекта: в работе

## Что сделано
- [x] Добавлен Rust-командный API `search_project(request)`.
- [x] Реализован обход файлов проекта в отдельном потоке (без блокировки UI).
- [x] Реализована пакетная отправка найденных совпадений через событие `project-search-progress`.
- [x] Добавлены метрики прогресса: scannedFiles, totalHits, done.
- [x] Добавлен frontend IPC-контракт для запуска поиска по проекту.
- [x] Добавлена UI-панель глобального поиска по проекту:
  - строка запроса
  - запуск поиска
  - потоковый список результатов
  - клик по результату открывает файл и переводит курсор на строку/колонку
- [x] Добавлен хоткей Ctrl+Shift+F для открытия панели project search.

## Прогресс эпиков
### EPIC-2: Native core
- [x] P2.1 Открытие/сохранение файлов (baseline)
- [x] P2.2 Открытие проекта (baseline)
- [x] P2.3 Ленивая загрузка дерева (baseline)
- [x] P2.4 Поиск по проекту (streaming baseline)
- [ ] P2.5 File watcher

## Ограничения текущей реализации
- Поиск пока строковый (без regex и glob-фильтров).
- Нет отмены текущего поискового запроса.
- Нет исключений по папкам (.git/node_modules и т.п.) в явном виде.

## Следующие шаги
1. Добавить отмену поискового запроса.
2. Добавить include/exclude glob фильтры.
3. Добавить file watcher + external change handling.

## Файлы итерации
- src-tauri/Cargo.toml
- src-tauri/src/commands.rs
- src-tauri/src/main.rs
- src/services/ipc.ts
- src/App.tsx
- src/styles/app.css
