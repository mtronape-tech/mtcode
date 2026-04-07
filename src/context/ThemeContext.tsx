import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { DEFAULT_THEME, THEMES, toggleThemeMode } from "../lib/theme";
import type { ThemeId } from "../lib/theme";
import linenVars        from "../themes/linen.json";
import mahoganyVars     from "../themes/mahogany.json";
import nortonDarkVars   from "../themes/norton-dark.json";
import nortonLightVars  from "../themes/norton-light.json";
import monokaiDarkVars  from "../themes/monokai-dark.json";
import monokaiLightVars from "../themes/monokai-light.json";

type ThemeVars = Record<string, string>;

const THEME_VARS: Record<ThemeId, ThemeVars> = {
  linen:           linenVars        as ThemeVars,
  mahogany:        mahoganyVars     as ThemeVars,
  "norton-dark":   nortonDarkVars   as ThemeVars,
  "norton-light":  nortonLightVars  as ThemeVars,
  "monokai-dark":  monokaiDarkVars  as ThemeVars,
  "monokai-light": monokaiLightVars as ThemeVars,
};

function applyTheme(id: ThemeId) {
  const vars = THEME_VARS[id];
  const root = document.documentElement;
  root.setAttribute("data-theme", id);
  for (const [key, value] of Object.entries(vars)) {
    if (key === "radius") {
      root.style.setProperty("--radius", value);
    } else {
      root.style.setProperty(`--${key}`, value);
    }
  }
}

type ThemeContextValue = {
  themeId: ThemeId;
  monacoTheme: string;
  setTheme: (id: ThemeId) => void;
  /** Toggle between dark and light within the current theme family. */
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  themeId: DEFAULT_THEME,
  monacoTheme: "mtcode-mahogany",
  setTheme: () => {},
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeId] = useState<ThemeId>(DEFAULT_THEME);

  useEffect(() => {
    applyTheme(themeId);
  }, [themeId]);

  const setTheme = useCallback((id: ThemeId) => {
    // Apply CSS vars immediately (synchronous) so the UI never renders one frame in the old theme.
    // setThemeId triggers the re-render; the useEffect below is kept as a safety net for SSR/init.
    applyTheme(id);
    setThemeId(id);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeId((prev) => {
      const next = toggleThemeMode(prev);
      applyTheme(next);
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider
      value={{ themeId, monacoTheme: THEMES[themeId].monacoTheme, setTheme, toggleTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
