# MTCode Backlog Snapshot
Дата: 2026-03-25
Снимок: 13 (Editor height fix)
Статус проекта: в работе

## Проблема
- Поле редактора Monaco не растягивалось на доступную высоту.

## Что сделано
- [x] Заменена layout-модель editor-zone с grid на flex-column.
- [x] Добавлен контейнер `.editor-host` вокруг компонента Editor.
- [x] Для `.editor-host` задано `flex: 1` и `min-height: 0`.
- [x] Сохранен `height="100%"` для Monaco Editor.

## Ожидаемый эффект
- Monaco стабильно занимает всю оставшуюся высоту под панелями tabs/find/search.
- При открытии/закрытии find/project search панелей редактор корректно перерассчитывает высоту.

## Файлы итерации
- src/App.tsx
- src/styles/app.css
