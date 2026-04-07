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
};

export const THEMES: Record<ThemeId, ThemeDefinition> = {
  mahogany: {
    id: "mahogany",
    name: "Mahogany",
    family: "mtcode",
    mode: "dark",
    monacoTheme: "mtcode-mahogany",
  },
  linen: {
    id: "linen",
    name: "Linen",
    family: "mtcode",
    mode: "light",
    monacoTheme: "mtcode-linen",
  },
  "norton-dark": {
    id: "norton-dark",
    name: "Norton",
    family: "norton",
    mode: "dark",
    monacoTheme: "mtcode-norton-dark",
  },
  "norton-light": {
    id: "norton-light",
    name: "Norton",
    family: "norton",
    mode: "light",
    monacoTheme: "mtcode-norton-light",
  },
  "monokai-dark": {
    id: "monokai-dark",
    name: "Monokai",
    family: "monokai",
    mode: "dark",
    monacoTheme: "mtcode-monokai-dark",
  },
  "monokai-light": {
    id: "monokai-light",
    name: "Monokai",
    family: "monokai",
    mode: "light",
    monacoTheme: "mtcode-monokai-light",
  },
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
