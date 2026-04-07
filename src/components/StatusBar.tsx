import { Moon, Sun } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { THEMES } from "../lib/theme";
import { cn } from "../lib/utils";
import type { AutosaveMode } from "../services/ipc";
import type { EditorTab } from "../types";

function languageStatusLabel(languageId: string): string {
  if (languageId === "plaintext") return "TXT";
  if (languageId === "typescript") return "TS";
  if (languageId === "javascript") return "JS";
  if (languageId === "markdown") return "MD";
  if (languageId === "csharp") return "C#";
  if (languageId === "powershell") return "PS1";
  return languageId.toUpperCase();
}

/** "Ln 45, Col 3" → "LN:45  COL:3" */
function formatCursor(raw: string): string {
  const m = raw.match(/Ln\s*(\d+),\s*Col\s*(\d+)/i);
  if (!m) return raw;
  return `LN:${m[1]}  COL:${m[2]}`;
}

const seg = cn(
  "text-muted-foreground font-mono text-[11px] tracking-wide select-none",
  "hover:text-foreground cursor-default transition-colors",
);

const sep = (
  <span className="text-border font-mono text-[11px] select-none px-0.5">·</span>
);

type Props = {
  activeTab: EditorTab | null;
  activeLanguage: string;
  autosaveMode: AutosaveMode;
  autosaveDelayMs: number;
  cursorText: string;
  onAutosaveModeChange: (mode: AutosaveMode) => void;
  onDelayChange: (ms: number) => void;
};

export function StatusBar({
  activeTab,
  activeLanguage,
  autosaveMode,
  autosaveDelayMs,
  cursorText,
  onAutosaveModeChange,
  onDelayChange,
}: Props) {
  const { themeId, toggleTheme } = useTheme();

  const pathDisplay = activeTab?.path
    ? activeTab.path.replace(/\\/g, "/")
    : null;

  return (
    <footer className="flex items-center justify-between gap-2 px-2.5 bg-card border-t border-border h-[26px] shrink-0">

      {/* Left — file path */}
      <div className="flex items-center min-w-0 overflow-hidden">
        {pathDisplay ? (
          <span
            className="text-muted-foreground font-mono text-[10px] tracking-wide truncate select-none"
            title={activeTab?.path}
          >
            <span className="opacity-50">// </span>{pathDisplay}
          </span>
        ) : (
          <span className="text-muted-foreground/40 font-mono text-[10px] tracking-wide select-none">
            // no file
          </span>
        )}
      </div>

      {/* Right — technical readouts */}
      <div className="flex items-center gap-0 ml-auto shrink-0">

        {/* Autosave */}
        <span className="flex items-center gap-1 mr-2">
          <span className="text-muted-foreground/50 font-mono text-[10px] tracking-widest select-none">AUTOSAVE:</span>
          <select
            className="h-[18px] bg-input border border-border font-mono text-[10px] text-muted-foreground px-1 focus:outline-none focus:ring-1 focus:ring-ring"
            value={autosaveMode}
            onChange={(e) => onAutosaveModeChange(e.target.value as AutosaveMode)}
          >
            <option value="off">OFF</option>
            <option value="focusChange">FOCUS</option>
            <option value="delayed">DELAY</option>
          </select>
          {autosaveMode === "delayed" ? (
            <input
              className="w-14 h-[18px] bg-input border border-border font-mono text-[10px] text-muted-foreground px-1 focus:outline-none focus:ring-1 focus:ring-ring"
              type="number"
              min={250}
              step={100}
              value={autosaveDelayMs}
              onChange={(e) => onDelayChange(Math.max(250, Number(e.target.value || 250)))}
            />
          ) : null}
        </span>

        {sep}
        <span className={cn(seg, "px-2")}>UTF-8</span>
        {sep}
        <span className={cn(seg, "px-2")}>CRLF</span>
        {sep}
        <span className={cn(seg, "px-2")}>{languageStatusLabel(activeLanguage)}</span>
        {sep}
        <span className={cn(seg, "px-2")}>{formatCursor(cursorText)}</span>
        {sep}

        {/* Theme mode toggle — switches dark↔light within the current family */}
        <button
          className="h-[18px] w-[22px] ml-1 inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors border border-transparent hover:border-border"
          title={THEMES[themeId].mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          onClick={toggleTheme}
        >
          {THEMES[themeId].mode === "dark" ? <Sun size={11} /> : <Moon size={11} />}
        </button>
      </div>
    </footer>
  );
}
