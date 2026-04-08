import { createContext, useCallback, useContext, useState } from "react";
import { DEFAULT_THEME, THEMES, toggleThemeMode } from "../lib/theme";
import type { ThemeId } from "../lib/theme";

function applyTheme(id: ThemeId) {
  const vars = THEMES[id].css;
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

  // Apply theme on mount / id change
  useState(() => {
    applyTheme(themeId);
  });

  const setTheme = useCallback((id: ThemeId) => {
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
