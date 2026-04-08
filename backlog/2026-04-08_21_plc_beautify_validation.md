# Feature: PLC Beautify + Basic Validation

**Date:** 2026-04-08
**Status:** Done

## What was added

### `src/lib/plcFormatter.ts`

**Formatter** (`formatPlc`):
- Построчный форматтер с расстановкой отступов (2 пробела)
- OPEN / IF / WHILE → увеличивают отступ
- CLOSE / ENDIF / ENDWHILE / ELSE → уменьшают отступ
- Пустые строки и комментарии сохраняются
- Препроцессорные директивы (#define, #ifdef) не отступаются

**Validator** (`validatePlc`):
- Проверяет структурное соответствие блоков:
  - OPEN без CLOSE
  - CLOSE без OPEN
  - IF без ENDIF
  - ENDIF без IF
  - ELSE без IF
  - WHILE без ENDWHILE
  - ENDWHILE без WHILE
- Возвращает массив ошибок с номером строки, колонкой и сообщением

**Monaco registration** (`registerPlcFormatter`):
- `registerDocumentFormattingEditProvider` для языка `plc`
- `onDidCreateModel` → автоматически подключает валидатор к новым PLC-моделям
- Валидация запускается с debounce 400ms при каждом изменении

### `src/App.tsx`

- F7 → форматирует документ для всех языков
- Для PLC: сначала валидация — если есть ошибки, показывает toast.error с номером строки
  и переходит к первой ошибке; если ошибок нет — форматирует и показывает toast "Formatted"
- Валидатор подключается к начальной модели при mount (onDidCreateModel не покрывает этот случай)
- Красные подчёркивания в редакторе появляются автоматически через setModelMarkers

## Usage

- Открыть .plc / .cfg / .pmc файл
- F7 — форматировать / показать ошибки
- Ошибки также подсвечиваются красным в редакторе в реальном времени

## Follow-ups / Extensions (implemented)

### Validation toggle (StatusBar)

- Добавлен переключатель в статус-баре для включения/выключения PLC-валидации.
- По умолчанию **выключено**.
- При выключении маркеры `plc-validator` очищаются, и PLC-тосты при F7 не показываются.

### Quick Fix (Code Actions)

- Добавлены quick-fix действия для структурных проблем PLC:
  - Добавление недостающих закрывающих `ENDIF` / `ENDWHILE` (в конец файла).
  - Recovery-сценарии “expected before …” → quick-fix вставляет закрывающий оператор ближе к месту, где он ожидается.
- Примечание: точность auto-fix ограничена, полноценный парсер может потребоваться для идеальной расстановки.
