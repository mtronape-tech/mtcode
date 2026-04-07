/**
 * Monaco Monarch tokenizer for Mechatronika MNC PLC/CFG language.
 *
 * Covers:
 *   .plc — PLC program files (OPEN PLC N CLEAR … CLOSE)
 *   .cfg — Kinematic / configuration files (&N OPEN FORWARD … CLOSE)
 *   .pmc — PMC program files
 */
import type * as Monaco from "monaco-editor";

export const PLC_LANGUAGE_ID = "plc";

// PLC built-in macros that control execution mode (@SET_ON, @SET_OFF …)
// These get the keyword color for maximum visibility.
const PLC_CONTROL_MACROS =
  "SET_ON|SET_OFF|HOLD|HOLD_MODE_P|AGREG_MODE_P|M_CODE|CALL_PROG|" +
  "RESET|START|STOP|ENABLE|DISABLE|INIT|RUN";

export function registerPlcLanguage(monaco: typeof Monaco): void {
  // ── Register file associations ──────────────────────────────────────────────
  monaco.languages.register({
    id: PLC_LANGUAGE_ID,
    extensions: [".plc", ".cfg", ".pmc"],
    aliases: ["PLC", "plc", "MNC PLC"],
    mimetypes: ["text/x-plc"],
  });

  // ── Monarch tokenizer ───────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  monaco.languages.setMonarchTokensProvider(PLC_LANGUAGE_ID, {
    defaultToken: "",
    tokenPostfix: ".plc",

    // Control flow / command keywords
    keywords: [
      "IF", "ELSE", "ENDIF",
      "WHILE", "ENDWHILE", "WAIT",
      "OPEN", "CLOSE", "CLEAR",
      "CALL", "GOSUB", "RETURN",
      "ENABLE", "DISABLE",
      "PLC", "PLCC",
      "FORWARD", "INVERSE",
      "READ", "SAVE",
      "DWELL", "DELAY",
      "OR", "AND",
      "N",
    ],

    // Built-in math / conversion functions
    builtins: [
      "ABS", "INT", "SQRT",
      "SIN", "COS", "TAN",
      "ASIN", "ACOS", "ATAN", "ATAN2",
      "EXP", "LN",
    ],

    // Regex for control macros (used in tokenizer rules below)
    controlMacroRe: PLC_CONTROL_MACROS,

    tokenizer: {
      root: [
        // ── Channel prefix: &1, &2 … (used in .cfg files) ──────────────────
        [/&\d+/, "constant"],

        // ── Preprocessor directives: #define, #ifdef, #ifndef, #include … ──
        [/#\w+/, "keyword"],

        // ── Line comments: ; or // ─────────────────────────────────────────
        [/;.*$/, "comment"],
        [/\/\/.*$/, "comment"],

        // ── Block comments: /* … */ ─────────────────────────────────────────
        [/\/\*/, { token: "comment", next: "@blockComment" }],

        // ── Control macros with @ prefix: @SET_ON, @SET_OFF, etc.
        //    Use character class [@] to avoid any Monarch @ substitution.
        [new RegExp(`[@](${PLC_CONTROL_MACROS})\\b`), "keyword"],

        // ── Other built-in macros: @name ────────────────────────────────────
        [/[@][A-Za-z_]\w*/, "support.function"],

        // ── User macros: ~name ──────────────────────────────────────────────
        [/[~][A-Za-z_]\w*/, "variable"],

        // ── Special $$*** operator ──────────────────────────────────────────
        [/\$\$\*+/, "keyword"],

        // ── Numbers ─────────────────────────────────────────────────────────
        [/[0-9]+\.[0-9]*([eE][+-]?[0-9]+)?/, "number.float"],
        [/\.[0-9]+([eE][+-]?[0-9]+)?/, "number.float"],
        [/[0-9]+[eE][+-]?[0-9]+/, "number.float"],
        [/[0-9]+/, "number"],

        // ── Identifiers, keywords, built-in functions ───────────────────────
        [/[A-Za-z_]\w*/, {
          cases: {
            "@builtins": "support.function",
            "@keywords": "keyword",
            "@default": "identifier",
          },
        }],

        // ── Multi-character operators ───────────────────────────────────────
        [/!<|!>|!=|>=|<=/, "operator"],

        // ── Single-character operators ──────────────────────────────────────
        [/[=+\-*/%^|<>]/, "operator"],

        // ── Bitwise & (after channel prefix already consumed above) ─────────
        [/&/, "operator"],

        // ── Delimiters ──────────────────────────────────────────────────────
        [/[()[\]{}]/, "delimiter.parenthesis"],

        // ── Whitespace ──────────────────────────────────────────────────────
        [/[ \t\r\n]+/, ""],
      ],

      blockComment: [
        [/[^/*]+/, "comment"],
        [/\*\//, { token: "comment", next: "@pop" }],
        [/[/*]/, "comment"],
      ],
    },
  } as Monaco.languages.IMonarchLanguage);

  // ── Language configuration ──────────────────────────────────────────────────
  monaco.languages.setLanguageConfiguration(PLC_LANGUAGE_ID, {
    comments: {
      lineComment: ";",
      blockComment: ["/*", "*/"],
    },
    brackets: [
      ["(", ")"],
      ["[", "]"],
    ],
    autoClosingPairs: [
      { open: "(", close: ")" },
      { open: "[", close: "]" },
    ],
    surroundingPairs: [
      { open: "(", close: ")" },
      { open: "[", close: "]" },
    ],
    folding: {
      markers: {
        start: new RegExp("^\\s*(IF|WHILE|OPEN)\\b", "i"),
        end: new RegExp("^\\s*(ENDIF|ENDWHILE|CLOSE)\\b", "i"),
      },
    },
    indentationRules: {
      increaseIndentPattern: /^\s*(IF|WHILE|OPEN)\b.*$/i,
      decreaseIndentPattern: /^\s*(ELSE|ENDIF|ENDWHILE|CLOSE)\b.*$/i,
    },
    wordPattern: /[A-Za-z_]\w*/,
  });
}
