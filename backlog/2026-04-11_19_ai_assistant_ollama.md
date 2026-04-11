# #19 — AI Assistant + Ollama Integration

**Date:** 2026-04-11
**Version:** 0.2.1
**Status:** Done

## Цель

Добавить локального AI-ассистента (без интернета) с интерактивным чатом, привязанным к PLC-валидатору.

## Реализовано

### Clippy — анимированный ассистент
- Спрайтовая анимация: 124×93px на кадр, 22 колонки, листинг `aiCharacters.ts`
- Прозрачность: удалён color-key (magenta 255,0,255 → alpha) через PIL
- Перетаскивание: drag через CSS `left/top`, GSAP только для entry/exit (scale+opacity)
- Выход с анимацией: `displayed` state удерживает компонент в DOM до завершения GSAP

### Чат-панель
- 300×320px, открывается кликом на спрайт
- Авто-позиционирование: влево или вправо в зависимости от позиции на экране
- Multi-turn: вся история + system prompt с кодом отправляются на каждый запрос
- Enter для отправки, CLR для сброса истории
- Индикатор набора (TypingDots) пока AI генерирует ответ

### Ollama (локальный LLM)
- Прокси через Rust `reqwest` — обход Tauri CSP (fetch на localhost заблокирован webview)
- `ollama_query` → `/api/generate` (анализ кода)
- `ollama_chat` → `/api/chat` (мульти-тёрн чат)
- `ollama_check` → `/api/tags` (проверка доступности)
- `ollama_is_installed` → проверка `%LOCALAPPDATA%\Programs\Ollama\ollama.exe` + PATH
- `ollama_install` → тихая установка из бандлированного `OllamaSetup.exe` с progress-ивентами

### Автоматическая установка Ollama
- `scripts/prepare-ollama.mjs`: скачивает OllamaSetup.exe (~70 МБ) и model.gguf (~1.1 ГБ)
- `--stubs` флаг: 1-байтовые заглушки для `tauri dev` (без 1 ГБ скачивания)
- `ollama create <name> -f Modelfile` — регистрация модели из бандла без загрузки
- `OllamaSetupDialog` — UI установки с прогресс-баром, показывается при первом запуске

### AI-промпты (PLC-специфичные)
- System prompt содержит полный справочник MNC PLC: блоки, ключевые слова, макросы, функции
- При ошибках: передаются данные валидатора (строка, severity, сообщение)
- Формат ответа: русский язык, максимум 3–4 предложения, без markdown, одна строка на ошибку

### Авто-анализ
- 4 с после изменения кода → если PLC-файл и валидатор нашёл ошибки → запуск анализа
- Результат появляется в чате (не отдельный bubble)
- Stale closure решено через `ollamaEnabledRef` + `handleAiAnalyzeRef`

### Настройки
- Settings → AI: ON/OFF, URL сервера, выбор модели, кнопка TEST
- Горячая клавиша `Ctrl+Alt+A` (заменила Ctrl+Shift+I — конфликт с DevTools)
- F-key bar: кнопка AI

## Ключевые файлы

| Файл | Изменение |
|------|-----------|
| `src/services/ollama.ts` | Новый: клиент Ollama + промпты |
| `src/components/AIAssistant.tsx` | Переработан: чат-панель вместо bubble |
| `src/components/OllamaSetupDialog.tsx` | Новый: диалог установки |
| `src/components/SettingsModal.tsx` | Добавлена секция AI |
| `src/lib/aiCharacters.ts` | Исправлены размеры фреймов и sheetColumns |
| `src/lib/hotkeys.ts` | Добавлен `aiAnalyze` action |
| `src/services/ipc.ts` | Добавлены Ollama-поля в AppSettings |
| `src/App.tsx` | Интеграция: состояние, авто-анализ, handleSendMessage |
| `src-tauri/src/commands.rs` | Rust-команды: ollama_* + установщик |
| `src-tauri/Cargo.toml` | reqwest, tokio::time |
| `src-tauri/tauri.conf.json` | resources + beforeDevCommand |
| `scripts/prepare-ollama.mjs` | Новый: скачивание ресурсов / stubs |
| `public/assets/ai-assistant/clippy-spritesheet.png` | Убран color-key |

## Решённые проблемы

- **CSP блокирует fetch**: решено проксированием через Rust reqwest
- **Двойное позиционирование drag**: убран `gsap.to(x,y)`, только CSS `left/top`
- **Выход без анимации**: `displayed` state держит компонент в DOM до конца GSAP
- **Stale closure в авто-анализе**: `ollamaEnabledRef` синхронизируется на каждом рендере
- **AI не видит ошибки**: `validatePlc()` вызывается напрямую, не через Monaco markers
- **Stub-файлы для dev**: 1-байтовые заглушки позволяют `tauri build` без реального скачивания
