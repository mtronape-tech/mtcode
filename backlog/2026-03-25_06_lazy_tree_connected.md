# MTCode Backlog Snapshot
Дата: 2026-03-25
Снимок: 06 (Lazy tree connected)
Статус проекта: в работе

## Что сделано
- [x] Добавлена Rust-команда list_dir(path) для ленивого обхода дерева.
- [x] Вынесен общий helper list_dir_entries для open_project/list_dir.
- [x] Подключен list_dir в invoke_handler.
- [x] Расширен frontend IPC-контракт (ListDirResult + listDir()).
- [x] Sidebar подключен к реальным данным:
  - open folder через native dialog
  - рендер дерева
  - ленивое раскрытие папок
  - открытие файла по клику в Monaco
- [x] Статус-бар теперь показывает реальный путь активного файла.
- [x] Курсорная позиция в статус-баре обновляется от Monaco события.

## Прогресс эпиков
### EPIC-1: Базовый UI shell
- [x] P1.1 Layout
- [x] P1.2 Monaco подключение
- [ ] P1.3 Командная палитра
- [ ] P1.4 Горячие клавиши

### EPIC-2: Native core
- [x] P2.1 Открытие/сохранение файлов (baseline)
- [x] P2.2 Открытие проекта (baseline)
- [x] P2.3 Ленивая загрузка дерева (baseline)
- [ ] P2.4 Поиск по проекту
- [ ] P2.5 File watcher

## Что осталось в этом блоке
1. Добавить состояние вкладок (несколько файлов, dirty).
2. Добавить сохранение файла из UI.
3. Добавить обработку ошибок/конфликтов внешних изменений.

## Файлы итерации
- src-tauri/src/commands.rs
- src-tauri/src/main.rs
- src/services/ipc.ts
- src/App.tsx
- src/styles/app.css
