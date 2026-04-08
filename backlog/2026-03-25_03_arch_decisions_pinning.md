# MTCode Backlog Snapshot
Дата: 2026-03-25
Снимок: 03 (Architecture decisions + version pinning)
Статус проекта: в работе

## Что сделано
- [x] Принят ADR-0001 по стеку и Win7-first ограничениям
- [x] Зафиксирована политика pinning версий
- [x] Подготовлена база для compatibility-gated разработки

## Прогресс по целям
- [x] Архитектурная рамка утверждена
- [x] Стратегия офлайн-поставки документирована
- [ ] Инициализирован каркас Tauri+React+Vite
- [ ] Запущен фактический Win7 spike (бинарь + инсталлятор)

## Следующие 3 шага
1. Создать минимальный каркас проекта (frontend + src-tauri).
2. Добавить конфиг NSIS и путь к bundled WebView2 fixed runtime.
3. Подготовить smoke-чеклист запуска с протоколом логирования.

## Файлы итерации
- docs/adr/ADR-0001-stack-win7-first.md
- docs/version_pinning_matrix.md
