// Theme definitions loaded from JSON in /themes/
import monokaiTheme from "../../themes/monokai.json";
import mtcodeTheme  from "../../themes/mtcode.json";
import nortonTheme  from "../../themes/norton.json";
import type * as Monaco from "monaco-editor";

export type ThemeId =
  | "linen" | "mahogany"
  | "norton-dark" | "norton-light"
  | "monokai-dark" | "monokai-light";

export type ThemeFamily = "mtcode" | "norton" | "monokai";

export type ThemeDefinition = {
  id: ThemeId;
  name: string;
  family: ThemeFamily;
  mode: "light" | "dark";
  monacoTheme: string;
  css: Record<string, string>;
  monaco: Monaco.editor.IStandaloneThemeData;
};

type JsonTheme = {
  id: string;
  name: string;
  dark: { css: Record<string, string>; monaco: Monaco.editor.IStandaloneThemeData };
  light: { css: Record<string, string>; monaco: Monaco.editor.IStandaloneThemeData };
};

// Helper: build ThemeDefinition from JSON entry
function makeTheme(
  family: ThemeFamily,
  familyName: string,
  mode: "dark" | "light",
  json: JsonTheme,
): ThemeDefinition {
  const modeData = json[mode];
  const suffix = mode === "dark" ? "-dark" : "-light";
  return {
    id: (json.id + suffix) as ThemeId,
    name: familyName,
    family,
    mode,
    monacoTheme: `mtcode-${json.id}${suffix}`,
    css: modeData.css,
    monaco: modeData.monaco as Monaco.editor.IStandaloneThemeData,
  };
}

const _monokai = monokaiTheme as unknown as JsonTheme;
const _mtcode  = mtcodeTheme  as unknown as JsonTheme;
const _norton  = nortonTheme  as unknown as JsonTheme;

export const THEMES: Record<ThemeId, ThemeDefinition> = {
  // Monokai
  "monokai-dark":  makeTheme("monokai", "Monokai", "dark",  _monokai),
  "monokai-light": makeTheme("monokai", "Monokai", "light", _monokai),
  // MTCode
  mahogany:  makeTheme("mtcode", "MTCode", "dark",  _mtcode),
  linen:     makeTheme("mtcode", "MTCode", "light", _mtcode),
  // Norton
  "norton-dark":  makeTheme("norton", "Norton", "dark",  _norton),
  "norton-light": makeTheme("norton", "Norton", "light", _norton),
};

/** All themes grouped by family, in display order. */
export const THEME_FAMILIES: { family: ThemeFamily; label: string; dark: ThemeId; light: ThemeId }[] = [
  { family: "monokai", label: "Monokai",  dark: "monokai-dark",  light: "monokai-light" },
  { family: "mtcode",  label: "MTCode",   dark: "mahogany",      light: "linen"         },
  { family: "norton",  label: "Norton",   dark: "norton-dark",   light: "norton-light"  },
];

export const DEFAULT_THEME: ThemeId = "monokai-dark";

export function isValidThemeId(value: string): value is ThemeId {
  return value in THEMES;
}

/** Returns the "opposite mode" sibling of a theme (dark↔light within same family). */
export function toggleThemeMode(id: ThemeId): ThemeId {
  const def = THEMES[id];
  const family = THEME_FAMILIES.find((f) => f.family === def.family)!;
  return def.mode === "dark" ? family.light : family.dark;
}
