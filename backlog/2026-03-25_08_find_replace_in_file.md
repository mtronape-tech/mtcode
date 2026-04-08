# MTCode Backlog Snapshot
Дата: 2026-03-25
Снимок: 08 (Find/Replace in file)
Статус проекта: в работе

## Что сделано
- [x] Добавлена встроенная панель Find/Replace в editor-zone.
- [x] Реализован поиск по текущему файлу через Monaco model.findMatches.
- [x] Реализована навигация по совпадениям (prev/next).
- [x] Реализована замена текущего совпадения.
- [x] Реализована замена всех совпадений.
- [x] Добавлен счетчик совпадений (current/total).

## Горячие клавиши
- [x] Ctrl+F: открыть Find/Replace панель
- [x] Ctrl+H: открыть Find/Replace панель
- [x] F3 / Shift+F3: следующий/предыдущий match
- [x] Esc: закрыть панель
- [x] Ctrl+S: сохранить активный файл (с прошлого шага)

## Прогресс эпиков
### EPIC-1: Базовый UI shell
- [x] P1.1 Layout
- [x] P1.2 Monaco подключение
- [ ] P1.3 Командная палитра
- [x] P1.4 Горячие клавиши (baseline)

### EPIC-2: Native core
- [x] P2.1 Открытие/сохранение файлов (baseline)
- [x] P2.2 Открытие проекта (baseline)
- [x] P2.3 Ленивая загрузка дерева (baseline)
- [ ] P2.4 Поиск по проекту
- [ ] P2.5 File watcher

## Следующие шаги
1. Реализовать глобальный поиск по проекту (Rust + streaming в UI).
2. Добавить autosave режимы: off/focus-change/delayed.
3. Добавить status bar переключатели encoding/EOL/language (пока отображаются статично).

## Файлы итерации
- src/App.tsx
- src/styles/app.css
