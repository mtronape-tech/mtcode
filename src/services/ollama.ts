/**
 * Ollama local LLM client.
 * Requests are proxied through Tauri (Rust/reqwest) to avoid webview CSP restrictions.
 */

import { invoke } from "@tauri-apps/api/tauri";

export const OLLAMA_DEFAULT_URL   = "http://localhost:11434";
export const OLLAMA_DEFAULT_MODEL = "qwen2.5-coder:1.5b";

/** Check if Ollama is reachable (proxied via Rust). */
export async function checkOllama(url: string): Promise<boolean> {
  try {
    return await invoke<boolean>("ollama_check", { url });
  } catch {
    return false;
  }
}

/** Send a prompt to Ollama and return the response text (proxied via Rust). */
export async function queryOllama(
  config: { url: string; model: string },
  prompt: string,
): Promise<string> {
  return invoke<string>("ollama_query", {
    req: { url: config.url, model: config.model, prompt },
  });
}

export type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

export async function chatOllama(
  config: { url: string; model: string },
  messages: ChatMessage[],
): Promise<string> {
  return invoke<string>("ollama_chat", {
    req: { url: config.url, model: config.model, messages },
  });
}

export function buildSystemPrompt(code: string): string {
  return `Ты — эксперт по PLC-программированию для ЧПУ-станков Мехатроника (MNC).

ЯЗЫК MNC PLC:
- Файлы: .plc (программы), .cfg (кинематика), .pmc (PMC)
- Блоки: OPEN PLC N CLEAR … CLOSE | OPEN FORWARD … CLOSE | OPEN INVERSE … CLOSE
- Управление: IF (cond) … ELSE … ENDIF | WHILE (cond) … ENDWHILE | WHILE (cond) WAIT
- Вызовы: CALL, GOSUB … RETURN
- Макросы управления: @SET_ON, @SET_OFF, @HOLD, @RESET, @START, @STOP, @ENABLE, @DISABLE, @M_CODE, @CALL_PROG, @INIT, @RUN
- Пользовательские макросы: ~имя
- Встроенные функции: ABS, INT, SQRT, SIN, COS, TAN, ASIN, ACOS, ATAN, ATAN2, EXP, LN
- Комментарии: ; // /* */
- Префикс строки: N<число> (необязателен)
- Препроцессор: #ifdef, #ifndef, #else, #endif, #define, #include

ПРАВИЛА ОТВЕТА (обязательно):
- Только русский язык
- Максимум 3–4 коротких предложения
- Никаких вступлений ("Конечно!", "Хороший вопрос!")
- Никакого markdown, никаких звёздочек — только обычный текст
- Если вопрос не о коде — отвечай одним предложением

Текущий код:
--- КОД ---
${code}
--- КОНЕЦ ---`;
}

export type ValidatorError = {
  line: number;
  message: string;
  severity: "error" | "warning";
};

/** Build a prompt for PLC code analysis, enriched with validator output. */
export function buildAnalyzePrompt(code: string, validatorErrors: ValidatorError[] = []): string {
  if (validatorErrors.length === 0) {
    return `Ты — эксперт по MNC PLC. Ответ: только русский, 1–2 предложения, без markdown.
Валидатор ошибок не нашёл. Скажи одной фразой, что делает этот код.
--- КОД ---
${code}
--- КОНЕЦ ---`;
  }

  const errLines = validatorErrors
    .map((e) => `Стр.${e.line} [${e.severity === "error" ? "ОШИБКА" : "ПРЕДУПР"}]: ${e.message}`)
    .join("\n");

  return `Ты — эксперт по MNC PLC (Мехатроника). Ответ: только русский, без markdown, без вступлений.
Для каждой ошибки ниже — одна строка: что сломано и конкретно как исправить (например: "добавь ENDIF после строки 5").
--- ОШИБКИ ВАЛИДАТОРА ---
${errLines}
--- КОД ---
${code}
--- КОНЕЦ ---`;
}

/** Build a prompt for PLC code formatting. */
export function buildFormatPrompt(code: string, tabSize: number): string {
  return `You are a PLC code formatter for CNC machine programs.
Format the code below with correct indentation (${tabSize} spaces per level).
Rules:
- IF / ELSE / ENDIF blocks indent inner lines
- WHILE / ENDWHILE blocks indent inner lines
Return ONLY the formatted code. No explanations, no markdown fences.

--- CODE ---
${code}
--- END ---`;
}
