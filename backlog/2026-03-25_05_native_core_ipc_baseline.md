# MTCode Backlog Snapshot
Дата: 2026-03-25
Снимок: 05 (Native core + IPC baseline)
Статус проекта: в работе

## Что сделано
- [x] Добавлен модуль Rust-команд для базовых операций:
  - open_file(path)
  - save_file({ path, content })
  - open_project(root_path)
- [x] Подключен invoke_handler в Tauri main
- [x] Добавлен типизированный IPC слой во frontend (src/services/ipc.ts)

## Технические детали
- open_project пока возвращает только список верхнего уровня (это осознанно, под lazy tree).
- Сортировка entries: сначала папки, затем файлы, далее по имени.
- Форматы полей под camelCase для стабильного контракта между Rust и TS.

## Прогресс эпиков
### EPIC-2: Native core
- [x] P2.1 Открытие/сохранение файлов (baseline)
- [x] P2.2 Открытие проекта (baseline)
- [ ] P2.3 Ленивая загрузка дерева (следующий шаг)
- [ ] P2.4 Поиск по проекту
- [ ] P2.5 File watcher

## Следующие шаги
1. Добавить команду list_dir(path) для ленивого дерева.
2. Привязать sidebar UI к open_project/list_dir.
3. Внедрить состояние вкладок и dirty-индикаторы.

## Файлы итерации
- src-tauri/src/main.rs
- src-tauri/src/commands.rs
- src/services/ipc.ts
