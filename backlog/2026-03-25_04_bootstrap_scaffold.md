# MTCode Backlog Snapshot
Дата: 2026-03-25
Снимок: 04 (Bootstrap scaffold)
Статус проекта: в работе

## Что сделано
- [x] Создан каркас React + Vite frontend
- [x] Создан каркас Tauri backend (Rust)
- [x] Добавлен базовый layout редактора (menu/sidebar/tabs/editor/statusbar)
- [x] Подключен Monaco в базовом режиме
- [x] Настроен bundle target: NSIS
- [x] Добавлен placeholder пути для WebView2 Fixed Runtime

## Важные замечания
- Конфиг WebView2 сейчас указывает x64-path как baseline.
- Для полноценной поставки нужны отдельные профили/конфиги под x64 и x86.
- Зависимости еще не установлены (offline окружение), это только исходный каркас.

## Прогресс эпиков
### EPIC-0: Совместимость Win7
- [ ] P0.1 Запуск на Win7 x64
- [ ] P0.2 Запуск на Win7 x86
- [ ] P0.3 Fixed Runtime 109 интеграция (dual-arch)
- [ ] P0.4 NSIS offline installer проверка
- [ ] P0.5 Заполнение QA matrix фактическими результатами

### EPIC-1: Базовый UI shell
- [x] P1.1 Layout
- [x] P1.2 Monaco подключение (минимум)
- [ ] P1.3 Командная палитра
- [ ] P1.4 Горячие клавиши

### EPIC-2: Native core
- [ ] P2.1 Открытие/сохранение файлов
- [ ] P2.2 Открытие проекта
- [ ] P2.3 Ленивая загрузка дерева

## Следующие шаги
1. Сделать dual-config упаковку x64/x86 для WebView2 runtime.
2. Добавить Rust команды: open_file, save_file, open_project.
3. Добавить frontend IPC слой и связать с UI.

## Файлы итерации
- package.json
- vite.config.ts
- src/App.tsx
- src/styles/app.css
- src-tauri/Cargo.toml
- src-tauri/src/main.rs
- src-tauri/tauri.conf.json
