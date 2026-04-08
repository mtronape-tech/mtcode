/**
 * PLC / MNC language formatter and validator.
 *
 * Formatter:  registered as Monaco DocumentFormattingEditProvider
 * Validator:  registered as Monaco model change listener → setModelMarkers
 */
import type * as Monaco from "monaco-editor";
import { PLC_LANGUAGE_ID } from "./plcLanguage";

// ── Indent rules ──────────────────────────────────────────────────────────────

/** Keywords that open a new indent level (must be the first token on the line). */
const INDENT_OPEN  = /^(IF|WHILE|OPEN)\b/i;

/**
 * Keywords that close an indent level.
 * ELSE both closes and re-opens (same level as IF).
 * ENDIF / ENDWHILE / CLOSE fully close.
 */
const INDENT_CLOSE = /^(ENDIF|ENDWHILE|CLOSE|ELSE)\b/i;
const INDENT_ELSE  = /^ELSE\b/i;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Strip leading/trailing whitespace and inline comments for keyword detection.
 *  Also skips N-labels (N followed by digits) that prefix statements in PLC files.
 */
function firstToken(raw: string): string {
  const noComment = raw.replace(/;.*$/, "").replace(/\/\/.*$/, "").trim();
  const parts = noComment.split(/\s+/);
  // Skip N-label prefix like N100, N1000 etc.
  if (parts.length > 1 && /^N\d+$/i.test(parts[0])) {
    return parts[1] ?? "";
  }
  return parts[0] ?? "";
}

/** True if the line is blank or comment-only. */
function isBlankOrComment(raw: string): boolean {
  const t = raw.trim();
  return t === "" || t.startsWith(";") || t.startsWith("//") || t.startsWith("/*") || t.startsWith("*");
}

// ── Formatter ─────────────────────────────────────────────────────────────────

export function formatPlc(source: string, tabSize: number = 4): string {
  const lines = source.split(/\r?\n/);
  const out: string[] = [];
  let depth = 0;
  const TAB = " ".repeat(Math.max(1, Math.min(8, tabSize)));

  for (const raw of lines) {
    const trimmed = raw.trim();

    if (trimmed === "") {
      out.push("");
      continue;
    }

    // Preprocessor directives and block comments — no indent change, keep as-is
    if (trimmed.startsWith("#") || trimmed.startsWith("/*") || trimmed.startsWith("*")) {
      out.push(trimmed);
      continue;
    }

    const token = firstToken(trimmed).toUpperCase();

    // Closing keyword → dedent before printing
    if (INDENT_CLOSE.test(token)) {
      depth = Math.max(0, depth - 1);
    }

    out.push(TAB.repeat(depth) + trimmed);

    // Opening keyword → indent after printing
    // ELSE is special: it already dedented above, now re-indents
    if (INDENT_OPEN.test(token) || INDENT_ELSE.test(token)) {
      depth += 1;
    }
  }

  return out.join("\n");
}

// ── Validator ─────────────────────────────────────────────────────────────────

export type PlcError = {
  line: number;   // 1-based
  col:  number;   // 1-based
  message: string;
  severity: "error" | "warning";
};

/** Block stack entry for structural validation. */
type BlockEntry = { keyword: string; line: number };

/**
 * Extract all structural keywords from a single line (handles inline patterns
 * like `WHILE (...) ENDWHILE` or `IF (...) ... ENDIF` on one line).
 * Returns keywords in order of appearance, skipping content inside #ifdef blocks.
 */
function extractKeywords(raw: string): string[] {
  // Strip comments
  let line = raw.replace(/\/\/.*$/, "").replace(/;.*$/, "");

  // Skip preprocessor directives entirely — they may contain IF/ENDIF
  // that are not real PLC block keywords
  if (/^\s*#/.test(line)) return [];

  // Strip block comment fragments (simple single-line /* ... */)
  line = line.replace(/\/\*.*?\*\//g, "");

  const result: string[] = [];
  // Match all word tokens
  const tokens = line.match(/[A-Za-z_]\w*/g) ?? [];
  for (const tok of tokens) {
    const up = tok.toUpperCase();
    if (up === "IF" || up === "ELSE" || up === "ENDIF" ||
        up === "WHILE" || up === "ENDWHILE" ||
        up === "OPEN" || up === "CLOSE") {
      result.push(up);
    }
  }
  return result;
}

export function validatePlc(source: string): PlcError[] {
  const errors: PlcError[] = [];
  const lines = source.split(/\r?\n/);

  // Stack for block matching: tracks open IF/WHILE/OPEN blocks
  const stack: BlockEntry[] = [];

  const leadingWs = (s: string) => (s.match(/^\s*/)?.[0].length ?? 0);
  const isMeaningfulLine = (raw: string): boolean => {
    const t = raw.trim();
    if (t === "") return false;
    if (/^\s*#/.test(t)) return false; // preprocessor
    if (t.startsWith(";") || t.startsWith("//") || t.startsWith("/*") || t.startsWith("*")) return false;
    return true;
  };
  const findInsertBeforeByIndent = (openedAtLine: number, fallbackBeforeLine: number): number => {
    const openLine = Math.min(Math.max(openedAtLine, 1), lines.length);
    const openIndent = leadingWs(lines[openLine - 1] ?? "");
    const toLine = Math.min(Math.max(fallbackBeforeLine, 1), lines.length);
    for (let ln = openLine + 1; ln <= toLine; ln += 1) {
      const raw = lines[ln - 1] ?? "";
      if (!isMeaningfulLine(raw)) continue;
      const indent = leadingWs(raw);
      if (indent <= openIndent) return ln;
    }
    return toLine;
  };

  // Track depth of #ifdef nesting — keywords inside are skipped
  let ifdefDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const raw = lines[i];
    const trimmed = raw.trim();

    if (trimmed === "") continue;

    // Track #ifdef / #ifndef / #else / #endif (preprocessor, not PLC)
    if (/^\s*#ifdef\b/i.test(trimmed) || /^\s*#ifndef\b/i.test(trimmed)) {
      ifdefDepth++;
      continue;
    }
    if (/^\s*#endif\b/i.test(trimmed)) {
      ifdefDepth = Math.max(0, ifdefDepth - 1);
      continue;
    }
    if (/^\s*#/.test(trimmed)) continue; // other preprocessor lines

    // Inside #ifdef block — skip PLC keyword validation
    // (keywords here are conditional compile-time, not runtime structure)
    if (ifdefDepth > 0) continue;

    // Skip pure comment lines
    if (trimmed.startsWith(";") || trimmed.startsWith("//") ||
        trimmed.startsWith("/*") || trimmed.startsWith("*")) continue;

    // Extract all structural keywords from this line
    const keywords = extractKeywords(raw);

    for (const token of keywords) {
      switch (token) {
        case "OPEN":
          // CLOSE at file start (before any OPEN) is valid — it's a reset
          stack.push({ keyword: "OPEN", line: lineNum });
          break;

        case "CLOSE":
          if (stack.length > 0 && stack[stack.length - 1].keyword === "OPEN") {
            stack.pop();
          }
          // Standalone CLOSE (no matching OPEN) is valid in this language — skip
          break;

        case "IF":
          stack.push({ keyword: "IF", line: lineNum });
          break;

        case "ELSE": {
          const top = stack[stack.length - 1];
          if (!top || top.keyword !== "IF") {
            errors.push({
              line: lineNum, col: 1,
              message: "ELSE without matching IF",
              severity: "error",
            });
          }
          break;
        }

        case "ENDIF": {
          const top = stack[stack.length - 1];
          if (!top) {
            errors.push({
              line: lineNum, col: 1,
              message: "ENDIF without matching IF",
              severity: "error",
            });
          } else if (top.keyword === "IF") {
            stack.pop();
          } else if (top.keyword === "WHILE") {
            // Recovery: missing ENDWHILE before ENDIF (prevents cascading IF errors)
            const insertBefore = findInsertBeforeByIndent(top.line, lineNum);
            errors.push({
              line: lineNum, col: 1,
              message: `ENDWHILE expected before ENDIF (WHILE opened at line ${top.line}; insert before line ${insertBefore})`,
              severity: "error",
            });
            stack.pop(); // pop WHILE
            const next = stack[stack.length - 1];
            if (next?.keyword === "IF") stack.pop();
            else {
              errors.push({
                line: lineNum, col: 1,
                message: "ENDIF without matching IF",
                severity: "error",
              });
            }
          } else {
            errors.push({
              line: lineNum, col: 1,
              message: "ENDIF without matching IF",
              severity: "error",
            });
          }
          break;
        }

        case "WHILE":
          stack.push({ keyword: "WHILE", line: lineNum });
          break;

        case "ENDWHILE": {
          const top = stack[stack.length - 1];
          if (!top) {
            errors.push({
              line: lineNum, col: 1,
              message: "ENDWHILE without matching WHILE",
              severity: "error",
            });
          } else if (top.keyword === "WHILE") {
            stack.pop();
          } else if (top.keyword === "IF") {
            // Recovery: missing ENDIF before ENDWHILE
            const insertBefore = findInsertBeforeByIndent(top.line, lineNum);
            errors.push({
              line: lineNum, col: 1,
              message: `ENDIF expected before ENDWHILE (IF opened at line ${top.line}; insert before line ${insertBefore})`,
              severity: "error",
            });
            stack.pop(); // pop IF
            const next = stack[stack.length - 1];
            if (next?.keyword === "WHILE") stack.pop();
            else {
              errors.push({
                line: lineNum, col: 1,
                message: "ENDWHILE without matching WHILE",
                severity: "error",
              });
            }
          } else {
            errors.push({
              line: lineNum, col: 1,
              message: "ENDWHILE without matching WHILE",
              severity: "error",
            });
          }
          break;
        }
      }
    }
  }

  // Unclosed blocks (OPEN/CLOSE mismatch is not reported — valid in PLC)
  for (const entry of stack) {
    if (entry.keyword === "OPEN") continue; // OPEN without CLOSE is valid
    errors.push({
      line: entry.line, col: 1,
      message: `Unclosed ${entry.keyword} block`,
      severity: "error",
    });
  }

  return errors;
}

// ── Monaco registration ───────────────────────────────────────────────────────

export function registerPlcFormatter(
  monaco: typeof Monaco,
  validationEnabledRef: { current: boolean } = { current: true },
  tabSizeRef: { current: number } = { current: 4 },
): void {
  // ── Formatter ──────────────────────────────────────────────────────────────
  monaco.languages.registerDocumentFormattingEditProvider(PLC_LANGUAGE_ID, {
    provideDocumentFormattingEdits(model) {
      const source = model.getValue();
      const formatted = formatPlc(source, tabSizeRef.current);
      if (formatted === source) return [];
      return [{
        range: model.getFullModelRange(),
        text: formatted,
      }];
    },
  });

  // ── Code Actions (Quick Fix) ───────────────────────────────────────────────
  monaco.languages.registerCodeActionProvider(PLC_LANGUAGE_ID, {
    provideCodeActions(model, _range, context) {
      if (!validationEnabledRef.current) return { actions: [], dispose: () => {} };
      if (model.getLanguageId() !== PLC_LANGUAGE_ID) return { actions: [], dispose: () => {} };

      const endLine = model.getLineCount();
      const endCol = model.getLineMaxColumn(endLine);
      const endRange: Monaco.IRange = {
        startLineNumber: endLine,
        startColumn: endCol,
        endLineNumber: endLine,
        endColumn: endCol,
      };

      const needsLeadingNewline = model.getLineContent(endLine).trim().length > 0;
      const insertAtEof = (kw: string) => (needsLeadingNewline ? `\n${kw}\n` : `${kw}\n`);

      const actions: Monaco.languages.CodeAction[] = [];

      // Always compute current structural problems so quick-fix can be offered
      // even if Monaco doesn't pass our markers in context (cursor not on the exact line).
      const currentErrors = validatePlc(model.getValue());
      const unclosedIfCount = currentErrors.filter((e) => e.message.includes("Unclosed IF block")).length;
      const unclosedWhileCount = currentErrors.filter((e) => e.message.includes("Unclosed WHILE block")).length;
      const needsEndwhileBeforeEndif = currentErrors.filter((e) => e.message.startsWith("ENDWHILE expected before ENDIF"));
      const needsEndifBeforeEndwhile = currentErrors.filter((e) => e.message.startsWith("ENDIF expected before ENDWHILE"));

      if (unclosedIfCount + unclosedWhileCount > 0) {
        const lines: string[] = [];
        for (let i = 0; i < unclosedIfCount; i += 1) lines.push("ENDIF");
        for (let i = 0; i < unclosedWhileCount; i += 1) lines.push("ENDWHILE");

        const text = (needsLeadingNewline ? "\n" : "") + lines.join("\n") + "\n";

        actions.push({
          title: "Исправить структуру PLC (добавить закрывающие в конец файла)",
          kind: "quickfix",
          diagnostics: context.markers,
          edit: {
            edits: [{
              resource: model.uri,
              versionId: model.getVersionId(),
              textEdit: { range: endRange, text },
            }],
          },
          isPreferred: true,
        });
      }

      // Recovery-based fixes: insert the expected keyword right before the current line.
      const parseOpenedAt = (msg: string): number | null => {
        const m = msg.match(/opened at line\s+(\d+)/i);
        return m ? Number(m[1]) : null;
      };
      const parseInsertBefore = (msg: string): number | null => {
        const m = msg.match(/insert before line\s+(\d+)/i);
        return m ? Number(m[1]) : null;
      };

      for (const err of needsEndwhileBeforeEndif) {
        const insertLine = parseInsertBefore(err.message) ?? err.line;
        actions.push({
          title: "Вставить ENDWHILE (в корректное место)",
          kind: "quickfix",
          diagnostics: context.markers,
          edit: {
            edits: [{
              resource: model.uri,
              versionId: model.getVersionId(),
              textEdit: {
                range: {
                  startLineNumber: insertLine,
                  startColumn: 1,
                  endLineNumber: insertLine,
                  endColumn: 1,
                },
                text: "ENDWHILE\n",
              },
            }],
          },
          isPreferred: true,
        });
      }

      for (const err of needsEndifBeforeEndwhile) {
        const insertLine = parseInsertBefore(err.message) ?? err.line;
        actions.push({
          title: "Вставить ENDIF (в корректное место)",
          kind: "quickfix",
          diagnostics: context.markers,
          edit: {
            edits: [{
              resource: model.uri,
              versionId: model.getVersionId(),
              textEdit: {
                range: {
                  startLineNumber: insertLine,
                  startColumn: 1,
                  endLineNumber: insertLine,
                  endColumn: 1,
                },
                text: "ENDIF\n",
              },
            }],
          },
          isPreferred: true,
        });
      }

      for (const marker of context.markers) {
        if (typeof marker.message !== "string") continue;

        if (marker.message.includes("Unclosed IF block")) {
          actions.push({
            title: "Добавить ENDIF (в конец файла)",
            kind: "quickfix",
            diagnostics: [marker],
            edit: {
              edits: [{
                resource: model.uri,
                versionId: model.getVersionId(),
                textEdit: { range: endRange, text: insertAtEof("ENDIF") },
              }],
            },
            isPreferred: true,
          });
        }

        if (marker.message.includes("Unclosed WHILE block")) {
          actions.push({
            title: "Добавить ENDWHILE (в конец файла)",
            kind: "quickfix",
            diagnostics: [marker],
            edit: {
              edits: [{
                resource: model.uri,
                versionId: model.getVersionId(),
                textEdit: { range: endRange, text: insertAtEof("ENDWHILE") },
              }],
            },
            isPreferred: true,
          });
        }
      }

      return { actions, dispose: () => {} };
    },
  });

  // ── Validator — runs on every model change (debounced 400ms) ──────────────
  monaco.editor.onDidCreateModel((model) => {
    if (model.getLanguageId() !== PLC_LANGUAGE_ID) return;
    attachValidator(monaco, model, validationEnabledRef);
  });
}

function attachValidator(
  monaco: typeof Monaco,
  model: Monaco.editor.ITextModel,
  validationEnabledRef: { current: boolean },
): void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const run = () => {
    if (model.isDisposed()) return;
    if (!validationEnabledRef.current) {
      monaco.editor.setModelMarkers(model, "plc-validator", []);
      return;
    }
    const errors = validatePlc(model.getValue());
    monaco.editor.setModelMarkers(
      model,
      "plc-validator",
      errors.map((e) => ({
        severity: e.severity === "error"
          ? monaco.MarkerSeverity.Error
          : monaco.MarkerSeverity.Warning,
        message:   e.message,
        startLineNumber: e.line,
        startColumn:     e.col,
        endLineNumber:   e.line,
        endColumn:       model.getLineMaxColumn(e.line),
      })),
    );
  };

  // Run immediately on attach
  run();

  model.onDidChangeContent(() => {
    if (!validationEnabledRef.current) {
      if (timer) clearTimeout(timer);
      timer = null;
      monaco.editor.setModelMarkers(model, "plc-validator", []);
      return;
    }
    if (timer) clearTimeout(timer);
    timer = setTimeout(run, 400);
  });

  model.onWillDispose(() => {
    if (timer) clearTimeout(timer);
    monaco.editor.setModelMarkers(model, "plc-validator", []);
  });
}
