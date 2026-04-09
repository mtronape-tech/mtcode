/**
 * PLC / MNC language formatter and validator.
 *
 * Formatter:  registered as Monaco DocumentFormattingEditProvider
 * Validator:  registered as Monaco model change listener → setModelMarkers
 *
 * Supported dialects:
 *   .plc  — PLC programs  (OPEN PLC N CLEAR … CLOSE)
 *   .pmc  — PMC programs  (OPEN PROG N CLEAR … CLOSE)
 *   .cfg  — Kinematics    (OPEN FORWARD … CLOSE / OPEN INVERSE … CLOSE)
 */
import type * as Monaco from "monaco-editor";
import { PLC_LANGUAGE_ID } from "./plcLanguage";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PlcError = {
  line: number;    // 1-based
  col:  number;    // 1-based
  message: string;
  severity: "error" | "warning";
};

type BlockEntry = { keyword: string; line: number };

// ── Low-level helpers ─────────────────────────────────────────────────────────

/**
 * Strip line comment suffix from a raw line.
 * Handles: ; comment, // comment, and inline /* block comment *‌/.
 * Does NOT handle multi-line block comments (those are ignored by line-by-line processing).
 */
function stripLineComment(raw: string): string {
  let out = "";
  let i = 0;
  while (i < raw.length) {
    const ch = raw[i];
    // Line comment ';'
    if (ch === ";") break;
    // '//' or '/*'
    if (ch === "/" && i + 1 < raw.length) {
      const next = raw[i + 1];
      if (next === "/") break;
      if (next === "*") {
        // Inline block comment: skip until '*/'
        i += 2;
        while (i < raw.length && !(raw[i] === "*" && raw[i + 1] === "/")) i++;
        i += 2;
        continue;
      }
    }
    out += ch;
    i++;
  }
  return out;
}

/** Remove optional leading N<digits> label (e.g. "N100 "). */
function skipNLabel(s: string): string {
  return s.replace(/^N\d+\s+/i, "");
}

/**
 * Return the first alphabetic token (after stripping comment and N-label).
 * Returns "" if none found.
 */
function getFirstToken(raw: string): string {
  const stripped = skipNLabel(stripLineComment(raw).trim());
  const m = stripped.match(/^([A-Za-z_]\w*)/);
  return m ? m[1].toUpperCase() : "";
}

/**
 * Return the text that follows the keyword on the same line (whitespace trimmed).
 * Handles optional N-label prefix and optional space between keyword and `(`.
 * Returns null if the keyword is not found at the start of the significant content.
 */
function getAfterKeyword(raw: string, keyword: string): string | null {
  const stripped = stripNLabel(stripLineComment(raw).trim());

  function stripNLabel(s: string) { return s.replace(/^N\d+\s+/i, ""); }

  // keyword may be followed immediately by '(' (no space) or by whitespace
  const re = new RegExp(`^${keyword}\\s*`, "i");
  const m = stripped.match(re);
  if (!m) return null;
  return stripped.slice(m[0].length);
}

/**
 * Find the index (0-based) of the character that closes the first top-level
 * parenthesised group starting at position 0 of `s` (i.e. s[0] must be '(').
 * Returns -1 if s doesn't start with '(' or parens are never balanced.
 */
function findClosingParen(s: string): number {
  if (s[0] !== "(") return -1;
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "(") depth++;
    else if (s[i] === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1; // never balanced
}

// ── Validation helpers ────────────────────────────────────────────────────────

/**
 * Validate that IF/WHILE is followed by a parenthesised condition.
 * Reports error if '(' is missing, warning if parens are unbalanced.
 */
function validateCondition(
  raw: string,
  keyword: string,
  lineNum: number,
  errors: PlcError[],
): void {
  const after = getAfterKeyword(raw, keyword);
  if (after === null) return; // keyword not found (shouldn't happen)

  if (after === "" || after[0] !== "(") {
    errors.push({
      line: lineNum,
      col: 1,
      message: `${keyword} condition must be in parentheses: ${keyword} (condition)`,
      severity: "error",
    });
    return;
  }

  const closeIdx = findClosingParen(after);
  if (closeIdx < 0) {
    errors.push({
      line: lineNum,
      col: 1,
      message: `Unbalanced parentheses in ${keyword} condition`,
      severity: "warning",
    });
  }
}

/**
 * Returns true for the single-line blocking-wait form:
 *   WHILE (condition) WAIT
 * This form does NOT open a loop — no ENDWHILE expected.
 */
function isWhileWaitInline(raw: string): boolean {
  const after = getAfterKeyword(raw, "WHILE");
  if (!after || after[0] !== "(") return false;
  const closeIdx = findClosingParen(after);
  if (closeIdx < 0) return false;
  const tail = after.slice(closeIdx + 1).trim();
  return /^WAIT\b/i.test(tail);
}


/**
 * Validate the OPEN statement type.
 * Known types: PLC, PLCC, PROG, FORWARD, INVERSE, CHAN.
 * Issues a warning for unrecognised types (there may be vendor extensions).
 */
const KNOWN_OPEN_TYPES = new Set(["PLC", "PLCC", "PROG", "FORWARD", "INVERSE", "CHAN"]);

function validateOpen(raw: string, lineNum: number, errors: PlcError[]): void {
  const after = getAfterKeyword(raw, "OPEN");
  if (after === null || after === "") {
    errors.push({
      line: lineNum,
      col: 1,
      message: "OPEN statement missing type (expected PLC, PLCC, PROG, FORWARD, INVERSE)",
      severity: "error",
    });
    return;
  }

  const typeMatch = after.match(/^([A-Za-z_]\w*)/);
  if (!typeMatch) {
    errors.push({
      line: lineNum,
      col: 1,
      message: "OPEN statement: expected identifier after OPEN",
      severity: "error",
    });
    return;
  }

  const type = typeMatch[1].toUpperCase();
  if (!KNOWN_OPEN_TYPES.has(type)) {
    errors.push({
      line: lineNum,
      col: 1,
      message: `Unknown OPEN type "${typeMatch[1]}". Expected: PLC, PLCC, PROG, FORWARD, INVERSE`,
      severity: "warning",
    });
    return;
  }

  // For PLC/PLCC/PROG: next token should be a number, followed by CLEAR or CLR
  if (type === "PLC" || type === "PLCC" || type === "PROG") {
    const rest = after.slice(typeMatch[0].length).trimStart();
    if (rest === "" || !/^\d+/.test(rest)) {
      errors.push({
        line: lineNum,
        col: 1,
        message: `OPEN ${typeMatch[1]} must be followed by a program number: OPEN ${typeMatch[1]} <N> CLEAR`,
        severity: "error",
      });
    }
  }
}

// ── Indent helpers (for quick-fix position hints) ─────────────────────────────

function leadingWs(s: string): number {
  return s.match(/^\s*/)?.[0].length ?? 0;
}

function isMeaningfulLine(raw: string): boolean {
  const t = raw.trim();
  if (t === "") return false;
  if (/^\s*#/.test(t)) return false;
  if (t.startsWith(";") || t.startsWith("//") || t.startsWith("/*") || t.startsWith("*")) return false;
  return true;
}

function findInsertBefore(lines: string[], openedAtLine: number, fallbackBeforeLine: number): number {
  const openLine = Math.min(Math.max(openedAtLine, 1), lines.length);
  const openIndent = leadingWs(lines[openLine - 1] ?? "");
  const toLine = Math.min(Math.max(fallbackBeforeLine, 1), lines.length);
  for (let ln = openLine + 1; ln <= toLine; ln++) {
    const raw = lines[ln - 1] ?? "";
    if (!isMeaningfulLine(raw)) continue;
    if (leadingWs(raw) <= openIndent) return ln;
  }
  return toLine;
}

// ── Formatter ─────────────────────────────────────────────────────────────────

const INDENT_OPEN  = /^(IF|WHILE|OPEN)\b/i;
const INDENT_CLOSE = /^(ENDIF|ENDWHILE|CLOSE|ELSE)\b/i;
const INDENT_ELSE  = /^ELSE\b/i;

/** True if the line is blank or comment-only (for formatter). */
function isBlankOrComment(raw: string): boolean {
  const t = raw.trim();
  return t === "" || t.startsWith(";") || t.startsWith("//") || t.startsWith("/*") || t.startsWith("*");
}

/** Return the first significant token for indentation decisions. */
function firstIndentToken(raw: string): string {
  const noComment = raw.replace(/;.*$/, "").replace(/\/\/.*$/, "").trim();
  const parts = noComment.split(/\s+/);
  if (parts.length > 1 && /^N\d+$/i.test(parts[0])) return parts[1] ?? "";
  return parts[0] ?? "";
}

export function formatPlc(source: string, tabSize = 4): string {
  const lines = source.split(/\r?\n/);
  const out: string[] = [];
  let depth = 0;
  const TAB = " ".repeat(Math.max(1, Math.min(8, tabSize)));

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (trimmed === "") { out.push(""); continue; }
    if (trimmed.startsWith("#") || trimmed.startsWith("/*") || trimmed.startsWith("*")) {
      out.push(trimmed);
      continue;
    }

    const token = firstIndentToken(trimmed).toUpperCase();
    if (INDENT_CLOSE.test(token)) depth = Math.max(0, depth - 1);
    out.push(TAB.repeat(depth) + trimmed);
    if (INDENT_OPEN.test(token) || INDENT_ELSE.test(token)) depth++;
  }
  return out.join("\n");
}

// ── Validator ─────────────────────────────────────────────────────────────────

export function validatePlc(source: string): PlcError[] {
  const errors: PlcError[] = [];
  const lines = source.split(/\r?\n/);
  const stack: BlockEntry[] = [];
  let ifdefDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const raw = lines[i];
    const trimmed = raw.trim();

    if (trimmed === "") continue;

    // ── Preprocessor tracking ───────────────────────────────────────────────
    if (/^\s*#ifn?def\b/i.test(trimmed)) { ifdefDepth++; continue; }
    if (/^\s*#endif\b/i.test(trimmed))   { ifdefDepth = Math.max(0, ifdefDepth - 1); continue; }
    if (/^\s*#/.test(trimmed))            continue; // other preprocessor lines

    // Inside #ifdef: keywords here are compile-time conditional — skip runtime checks
    if (ifdefDepth > 0) continue;

    // ── Skip comment-only lines ─────────────────────────────────────────────
    if (
      trimmed.startsWith(";") || trimmed.startsWith("//") ||
      trimmed.startsWith("/*") || trimmed.startsWith("*")
    ) continue;

    const keyword = getFirstToken(raw);
    if (!keyword) continue;

    // ── Dispatch on keyword ─────────────────────────────────────────────────
    switch (keyword) {

      case "IF": {
        validateCondition(raw, "IF", lineNum, errors);
        stack.push({ keyword: "IF", line: lineNum });
        break;
      }

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

      case "ENDI":   // abbreviation for ENDIF
      case "ENDIF": {
        const top = stack[stack.length - 1];
        if (!top) {
          errors.push({ line: lineNum, col: 1, message: "ENDIF without matching IF", severity: "error" });
        } else if (top.keyword === "IF") {
          stack.pop();
        } else if (top.keyword === "WHILE") {
          const ins = findInsertBefore(lines, top.line, lineNum);
          errors.push({
            line: lineNum, col: 1,
            message: `ENDWHILE expected before ENDIF (WHILE opened at line ${top.line}; insert before line ${ins})`,
            severity: "error",
          });
          stack.pop();
          const next = stack[stack.length - 1];
          if (next?.keyword === "IF") stack.pop();
          else errors.push({ line: lineNum, col: 1, message: "ENDIF without matching IF", severity: "error" });
        } else {
          errors.push({ line: lineNum, col: 1, message: "ENDIF without matching IF", severity: "error" });
        }
        break;
      }

      case "WHILE": {
        validateCondition(raw, "WHILE", lineNum, errors);
        // Blocking-wait form: WHILE (cond) WAIT on the same line — no ENDWHILE expected.
        // Standard loop form: WHILE (cond) … ENDWHILE — push to stack.
        if (!isWhileWaitInline(raw)) {
          stack.push({ keyword: "WHILE", line: lineNum });
        }
        break;
      }

      case "ENDWHILE": {
        const top = stack[stack.length - 1];
        if (!top) {
          errors.push({ line: lineNum, col: 1, message: "ENDWHILE without matching WHILE", severity: "error" });
        } else if (top.keyword === "WHILE") {
          stack.pop();
        } else if (top.keyword === "IF") {
          const ins = findInsertBefore(lines, top.line, lineNum);
          errors.push({
            line: lineNum, col: 1,
            message: `ENDIF expected before ENDWHILE (IF opened at line ${top.line}; insert before line ${ins})`,
            severity: "error",
          });
          stack.pop();
          const next = stack[stack.length - 1];
          if (next?.keyword === "WHILE") stack.pop();
          else errors.push({ line: lineNum, col: 1, message: "ENDWHILE without matching WHILE", severity: "error" });
        } else {
          errors.push({ line: lineNum, col: 1, message: "ENDWHILE without matching WHILE", severity: "error" });
        }
        break;
      }

      case "OPEN": {
        validateOpen(raw, lineNum, errors);
        stack.push({ keyword: "OPEN", line: lineNum });
        break;
      }

      case "CLOSE": {
        // Pop only if the innermost open block is an OPEN block.
        // Standalone CLOSE (no matching OPEN) is valid — used to reset a program slot.
        if (stack.length > 0 && stack[stack.length - 1].keyword === "OPEN") {
          stack.pop();
        }
        break;
      }

      // No validation needed for these
      default: break;
    }
  }

  // ── Unclosed blocks ─────────────────────────────────────────────────────────
  // OPEN without CLOSE is valid in this language (intentional open-ended blocks).
  for (const entry of stack) {
    if (entry.keyword === "OPEN") continue;
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
      return [{ range: model.getFullModelRange(), text: formatted }];
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
        startLineNumber: endLine, startColumn: endCol,
        endLineNumber: endLine,   endColumn: endCol,
      };
      const needsLeadingNewline = model.getLineContent(endLine).trim().length > 0;
      const insertAtEof = (kw: string) => (needsLeadingNewline ? `\n${kw}\n` : `${kw}\n`);

      const actions: Monaco.languages.CodeAction[] = [];
      const currentErrors = validatePlc(model.getValue());

      const unclosedIfCount    = currentErrors.filter((e) => e.message.includes("Unclosed IF block")).length;
      const unclosedWhileCount = currentErrors.filter((e) => e.message.includes("Unclosed WHILE block")).length;
      const needsEndwhileBeforeEndif  = currentErrors.filter((e) => e.message.startsWith("ENDWHILE expected before ENDIF"));
      const needsEndifBeforeEndwhile  = currentErrors.filter((e) => e.message.startsWith("ENDIF expected before ENDWHILE"));

      if (unclosedIfCount + unclosedWhileCount > 0) {
        const closers: string[] = [];
        for (let n = 0; n < unclosedIfCount;    n++) closers.push("ENDIF");
        for (let n = 0; n < unclosedWhileCount; n++) closers.push("ENDWHILE");
        const text = (needsLeadingNewline ? "\n" : "") + closers.join("\n") + "\n";
        actions.push({
          title: "Исправить структуру PLC (добавить закрывающие в конец файла)",
          kind: "quickfix",
          diagnostics: context.markers,
          edit: {
            edits: [{ resource: model.uri, versionId: model.getVersionId(), textEdit: { range: endRange, text } }],
          },
          isPreferred: true,
        });
      }

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
              resource: model.uri, versionId: model.getVersionId(),
              textEdit: { range: { startLineNumber: insertLine, startColumn: 1, endLineNumber: insertLine, endColumn: 1 }, text: "ENDWHILE\n" },
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
              resource: model.uri, versionId: model.getVersionId(),
              textEdit: { range: { startLineNumber: insertLine, startColumn: 1, endLineNumber: insertLine, endColumn: 1 }, text: "ENDIF\n" },
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
            kind: "quickfix", diagnostics: [marker],
            edit: { edits: [{ resource: model.uri, versionId: model.getVersionId(), textEdit: { range: endRange, text: insertAtEof("ENDIF") } }] },
            isPreferred: true,
          });
        }
        if (marker.message.includes("Unclosed WHILE block")) {
          actions.push({
            title: "Добавить ENDWHILE (в конец файла)",
            kind: "quickfix", diagnostics: [marker],
            edit: { edits: [{ resource: model.uri, versionId: model.getVersionId(), textEdit: { range: endRange, text: insertAtEof("ENDWHILE") } }] },
            isPreferred: true,
          });
        }
      }

      return { actions, dispose: () => {} };
    },
  });

  // ── Validator (attaches to every new PLC model) ────────────────────────────
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
    const errs = validatePlc(model.getValue());
    const lineCount = model.getLineCount();
    monaco.editor.setModelMarkers(
      model,
      "plc-validator",
      errs
        .filter((e) => e.line >= 1 && e.line <= lineCount)
        .map((e) => ({
          severity: e.severity === "error" ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
          message: e.message,
          startLineNumber: e.line, startColumn: e.col,
          endLineNumber: e.line, endColumn: model.getLineMaxColumn(e.line),
        })),
    );
  };

  run(); // run immediately on attach

  model.onDidChangeContent(() => {
    if (model.isDisposed()) return;
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
    timer = null;
    monaco.editor.setModelMarkers(model, "plc-validator", []);
  });
}
