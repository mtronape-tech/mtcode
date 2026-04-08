/**
 * Rainbow block highlighting for the PLC language.
 *
 * Assigns a color (depth 0–9) to each block keyword pair:
 *   IF … ELSE … ENDIF
 *   WHILE … ENDWHILE
 *   OPEN … CLOSE
 *
 * The color index is based on nesting depth so that different levels of
 * nesting get visually distinct colors, similar to the RainbowBraces
 * VS Code extension.
 *
 * Colors are stored as CSS custom properties --plc-rb-0 … --plc-rb-9
 * and applied via inlineClassName decorations (.plc-rb-0 … .plc-rb-9).
 */
import type { editor } from "monaco-editor";

// ── Default palettes ─────────────────────────────────────────────────────────

/** Bright vivid colors — readable on dark backgrounds */
export const DARK_RAINBOW_COLORS: string[] = [
  "#FF5F5F", // 0 — red
  "#FF9F43", // 1 — orange
  "#FFD700", // 2 — gold
  "#5FFF7A", // 3 — green
  "#5FE8FF", // 4 — cyan
  "#5F9FFF", // 5 — blue
  "#C17FFF", // 6 — purple
  "#FF5FD0", // 7 — magenta
  "#FF9067", // 8 — coral
  "#5FFFCF", // 9 — turquoise
];

/** Deep saturated colors — readable on light backgrounds */
export const LIGHT_RAINBOW_COLORS: string[] = [
  "#CC1111", // 0 — dark red
  "#CC5500", // 1 — dark orange
  "#887700", // 2 — dark gold
  "#007700", // 3 — dark green
  "#006688", // 4 — dark cyan
  "#0044BB", // 5 — dark blue
  "#8800BB", // 6 — dark purple
  "#BB0077", // 7 — dark magenta
  "#AA4400", // 8 — dark coral
  "#007744", // 9 — dark teal
];

/** Default — alias for dark (backward compat) */
export const DEFAULT_RAINBOW_COLORS = DARK_RAINBOW_COLORS;

// ── CSS variable injection ───────────────────────────────────────────────────

/**
 * Write --plc-rb-0 … --plc-rb-9 onto :root so the .plc-rb-N classes
 * in globals.css pick them up immediately.
 */
export function applyRainbowColors(colors: readonly string[]): void {
  const root = document.documentElement;
  for (let i = 0; i < 10; i++) {
    root.style.setProperty(`--plc-rb-${i}`, colors[i] ?? DEFAULT_RAINBOW_COLORS[i] ?? "#FFFFFF");
  }
}

// ── Block keyword parser ─────────────────────────────────────────────────────

interface BlockMatch {
  lineNum: number;  // 1-based Monaco line number
  startCol: number; // 1-based column of first char
  endCol: number;   // 1-based column AFTER last char (exclusive)
  depth: number;    // 0-based color index (0–9)
}

/**
 * Strip everything from the first ; or // to end-of-line.
 * Does not handle strings (PLC has none), so this is safe.
 */
function stripLineComment(line: string): string {
  for (let i = 0; i < line.length; i++) {
    if (line[i] === ";") return line.slice(0, i);
    if (line[i] === "/" && line[i + 1] === "/") return line.slice(0, i);
  }
  return line;
}

/**
 * Replace the span [start, end) in `line` with spaces (preserves column offsets).
 */
function blankSpan(line: string, start: number, end: number): string {
  return line.slice(0, start) + " ".repeat(end - start) + line.slice(end);
}

/**
 * Parse a PLC document and return one BlockMatch per block keyword,
 * with depth assigned by nesting level.
 *
 * Openers (IF / WHILE / OPEN): colored at current depth, then depth++
 * Middle  (ELSE):              colored at depth-1 (same as the IF opener)
 * Closers (ENDIF / ENDWHILE / CLOSE): depth--, then colored at depth
 *
 * This ensures every opener and its matching closer share the same color.
 */
export function parseRainbowBlocks(text: string): BlockMatch[] {
  const rawLines = text.split(/\r?\n/);
  const matches: BlockMatch[] = [];
  let depth = 0;
  let inBlockComment = false;

  // Order matters: longer patterns before shorter ones so alternation is safe.
  // With \b on both sides, shorter alternatives can't accidentally match
  // substrings of longer ones — but listing ENDIF before IF is good practice.
  // #ifdef / #ifndef / #else / #endif: # is not a word char so no \b prefix needed.
  const keywordRe = /\b(ENDIF|ENDWHILE|CLOSE|ELSE|IF|WHILE|OPEN)\b|(#ifdef|#ifndef|#else|#endif)\b/gi;

  for (let lineIdx = 0; lineIdx < rawLines.length; lineIdx++) {
    const lineNum = lineIdx + 1;
    let line = rawLines[lineIdx];

    // ── Handle open block comment ──────────────────────────────────────────
    if (inBlockComment) {
      const closeIdx = line.indexOf("*/");
      if (closeIdx >= 0) {
        inBlockComment = false;
        // Blank out from start to end of closing */
        line = " ".repeat(closeIdx + 2) + line.slice(closeIdx + 2);
      } else {
        continue; // whole line is inside block comment
      }
    }

    // ── Remove inline block comment (may open a new multi-line one) ────────
    const openIdx = line.indexOf("/*");
    if (openIdx >= 0) {
      const closeIdx = line.indexOf("*/", openIdx + 2);
      if (closeIdx >= 0) {
        // Entire block comment on one line — blank it out
        line = blankSpan(line, openIdx, closeIdx + 2);
      } else {
        // Block comment continues on subsequent lines
        line = line.slice(0, openIdx);
        inBlockComment = true;
      }
    }

    // ── Strip line comment ─────────────────────────────────────────────────
    line = stripLineComment(line);

    // ── Find block keywords ────────────────────────────────────────────────
    keywordRe.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = keywordRe.exec(line)) !== null) {
      // Group 1: PLC keywords (IF/WHILE/OPEN/ENDIF/…)
      // Group 2: preprocessor directives (#ifdef/#ifndef/#else/#endif)
      const raw = match[1] ?? match[2];
      if (!raw) continue;
      const keyword = raw.toUpperCase();
      const colStart = match.index + 1;       // 1-based
      const colEnd = colStart + raw.length;   // exclusive, 1-based

      if (keyword === "ENDIF" || keyword === "ENDWHILE" || keyword === "CLOSE" || keyword === "#ENDIF") {
        depth = Math.max(0, depth - 1);
        matches.push({ lineNum, startCol: colStart, endCol: colEnd, depth: depth % 10 });
      } else if (keyword === "ELSE" || keyword === "#ELSE") {
        const d = Math.max(0, depth - 1);
        matches.push({ lineNum, startCol: colStart, endCol: colEnd, depth: d % 10 });
      } else {
        // Opener: IF / WHILE / OPEN / #ifdef / #ifndef
        matches.push({ lineNum, startCol: colStart, endCol: colEnd, depth: depth % 10 });
        depth++;
      }
    }
  }

  return matches;
}

// ── Monaco decoration factory ────────────────────────────────────────────────

/**
 * Convert parsed BlockMatch list into Monaco IModelDeltaDecoration objects.
 * The `inlineClassName` maps to .plc-rb-N classes in globals.css.
 */
export function createRainbowDecorations(
  matches: BlockMatch[],
): editor.IModelDeltaDecoration[] {
  return matches.map((m) => ({
    range: {
      startLineNumber: m.lineNum,
      startColumn: m.startCol,
      endLineNumber: m.lineNum,
      endColumn: m.endCol,
    },
    options: {
      inlineClassName: `plc-rb-${m.depth}`,
      // Stacking order: rainbow should win over any other inline decoration
      inlineClassNameAffectsLetterSpacing: false,
    },
  }));
}
