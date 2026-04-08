# MTCode Backlog Snapshot
Дата: 2026-03-25
Снимок: 02 (Phase 0 setup)
Статус проекта: в работе

## Что сделано
- [x] Создана структура docs/ и artifacts/win7-spike/
- [x] Оформлен план Phase 0 (Win7 compatibility spike)
- [x] Оформлена матрица тестирования Win7 x64/x86
- [x] Оформлен runbook офлайн-деплоя под Win7

## Обновленный статус эпиков
### EPIC-0: Совместимость Win7 (критично)
- [ ] P0.1 Проверка запуска минимального Tauri-приложения на Win7 x64
- [ ] P0.2 Проверка запуска минимального Tauri-приложения на Win7 x86
- [ ] P0.3 Интеграция WebView2 Fixed Runtime 109 (x64/x86)
- [ ] P0.4 NSIS offline installer (без сетевых шагов)
- [ ] P0.5 Матрица QA для нестабильных Win7 окружений (шаблон готов)

### EPIC-1: Базовый UI shell
- [ ] P1.1 Layout: menu/top, sidebar, tabs, editor, statusbar
- [ ] P1.2 Подключение Monaco
- [ ] P1.3 Командная палитра
- [ ] P1.4 Система горячих клавиш

## Следующий шаг
1. Инициализировать каркас Tauri + React + Vite.
2. Зафиксировать версии зависимостей.
3. Подготовить конфиг под NSIS + fixed WebView2 path.

## Файлы итерации
- docs/phase0_win7_spike.md
- docs/win7_test_matrix.md
- docs/deployment_offline_win7.md
