/**
 * Sonner <Toaster> styled with MTCode theme CSS variables.
 * Import `toast` from "sonner" anywhere in the app to fire notifications.
 *
 * Offset: fkeys (20px) + statusbar (26px) + 4px gap = 50px from bottom.
 */
import { Toaster as Sonner } from "sonner";
import { useTheme } from "../context/ThemeContext";
import { THEMES } from "../lib/theme";

export { toast } from "sonner";

export function Toaster() {
  const { themeId } = useTheme();
  const isDark = THEMES[themeId].mode === "dark";

  return (
    <Sonner
      theme={isDark ? "dark" : "light"}
      position="bottom-right"
      duration={4000}
      gap={6}
      offset={{ bottom: 62, right: 20 }}
      toastOptions={{
        // Override Sonner's own CSS variables with our theme tokens.
        // These map directly to what Sonner uses internally for bg/text/border.
        style: {
          "--normal-bg":      "hsl(var(--card))",
          "--normal-text":    "hsl(var(--foreground))",
          "--normal-border":  "hsl(var(--border))",
          "--error-bg":       "hsl(var(--destructive) / 0.12)",
          "--error-text":     "hsl(var(--destructive-foreground))",
          "--error-border":   "hsl(var(--destructive) / 0.5)",
          "--success-bg":     "hsl(var(--accent) / 0.12)",
          "--success-text":   "hsl(var(--foreground))",
          "--success-border": "hsl(var(--border))",
          "--warning-bg":     "hsl(var(--accent) / 0.12)",
          "--warning-text":   "hsl(var(--foreground))",
          "--warning-border": "hsl(var(--border))",
          borderRadius:       "0",
          fontFamily:         "var(--font-mono, 'JetBrains Mono', Consolas, monospace)",
          fontSize:           "11px",
          letterSpacing:      "0.02em",
          boxShadow:          "4px 4px 0 hsl(var(--border))",
        } as React.CSSProperties,
        classNames: {
          toast:       "rounded-none",
          title:       "font-mono text-[11px] font-bold tracking-wide",
          description: "font-mono text-[10px] opacity-70",
          actionButton:
            "font-mono text-[10px] border border-border px-2 h-[20px] bg-transparent hover:bg-accent/10 transition-colors rounded-none",
          cancelButton:
            "font-mono text-[10px] border border-border px-2 h-[20px] bg-transparent hover:bg-accent/10 transition-colors rounded-none",
          closeButton:
            "rounded-none border border-border bg-card hover:bg-accent/10",
        },
      }}
    />
  );
}
