import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/utils";
import type { AutosaveMode } from "../services/ipc";
import { KbdBinding } from "./Kbd";
import {
  type HotkeyAction,
  HOTKEY_LABELS,
  HOTKEY_DEFAULTS,
  FKEY_DEFAULT_ACTIONS,
  eventToBinding,
} from "../lib/hotkeys";
import { THEME_FAMILIES } from "../lib/theme";
import { DEFAULT_RAINBOW_COLORS, DARK_RAINBOW_COLORS, LIGHT_RAINBOW_COLORS } from "../lib/plcRainbowBlocks";
import { THEMES } from "../lib/theme";
import { AI_CHARACTERS, type AICharacterId } from "../lib/aiCharacters";

/** Available editor fonts — label shown in dropdown, value is CSS font-family. */
export const FONTS: { label: string; value: string }[] = [
  { label: "JetBrains Mono",     value: "JetBrains Mono" },
  { label: "Fira Code",          value: "Fira Code" },
  { label: "Cascadia Code",      value: "Cascadia Code" },
  { label: "Consolas",           value: "Consolas" },
  { label: "Courier New",        value: "Courier New" },
  { label: "Source Code Pro",    value: "Source Code Pro" },
  { label: "IBM Plex Mono",      value: "IBM Plex Mono" },
  { label: "Roboto Mono",        value: "Roboto Mono" },
];

export type SettingsDraft = {
  themeId: string;
  fontSize: number;
  fontFamily: string;
  tabSize: number;
  wordWrap: "off" | "on" | "wordWrapColumn";
  autosaveMode: AutosaveMode;
  autosaveDelayMs: number;
  hotkeys: Record<string, string>;
  searchCollapsedByDefault: boolean;
  plcRainbowEnabled: boolean;
  plcRainbowColors: string[];
  fkeyActions: (string | null)[];
  aiAssistantVisible: boolean;
  aiCharacterId: AICharacterId;
};

type Props = {
  open: boolean;
  initial: SettingsDraft;
  onSave: (draft: SettingsDraft) => void;
  onClose: () => void;
};

type CategoryId = "appearance" | "editor" | "search" | "autosave" | "hotkeys" | "fkeys" | "language" | "ai";

const CATEGORIES: { id: CategoryId; label: string; path: string }[] = [
  { id: "appearance", label: "APPEARANCE", path: "/sys/config/appearance.cfg" },
  { id: "editor",     label: "EDITOR",     path: "/sys/config/editor.cfg"     },
  { id: "search",     label: "SEARCH",     path: "/sys/config/search.cfg"     },
  { id: "autosave",   label: "AUTOSAVE",   path: "/sys/config/autosave.cfg"   },
  { id: "hotkeys",    label: "HOTKEYS",    path: "/sys/config/hotkeys.cfg"    },
  { id: "fkeys",      label: "F-KEYS",     path: "/sys/config/fkeys.cfg"      },
  { id: "language",   label: "LANGUAGE",   path: "/sys/config/language.cfg"   },
  { id: "ai",         label: "AI",         path: "/sys/config/ai.cfg"         },
];

// ── Key recorder ─────────────────────────────────────────────────────────────

function KeyRecorder({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [recording, setRecording] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.key === "Escape") { setRecording(false); ref.current?.blur(); return; }
    const binding = eventToBinding(e.nativeEvent as KeyboardEvent);
    if (binding) {
      onChange(binding);
      setRecording(false);
      ref.current?.blur();
    }
  };

  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        "font-mono text-[10px] h-[22px] px-2 border w-full text-left select-none transition-colors",
        recording
          ? "border-primary text-primary bg-primary/5 animate-pulse"
          : "border-border text-foreground bg-input hover:border-muted-foreground",
      )}
      title={recording ? "Press key combo — Esc to cancel" : "Click to record a new binding"}
      onFocus={() => setRecording(true)}
      onBlur={() => setRecording(false)}
      onKeyDown={handleKeyDown}
    >
      {recording ? "< press key combo… >" : value}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const labelCls = "font-mono text-[10px] tracking-widest text-muted-foreground/70 select-none uppercase";
const inputCls = cn(
  "bg-input border border-border font-mono text-[11px] text-foreground",
  "px-1.5 h-[22px] focus:outline-none focus:ring-1 focus:ring-ring",
);
const selectCls = cn(inputCls, "pr-1");
const rowCls = "flex items-center gap-3 min-h-[28px]";
const labelColCls = "w-[120px] shrink-0 " + labelCls;

export function SettingsModal({ open, initial, onSave, onClose }: Props) {
  const [draft, setDraft] = useState<SettingsDraft>(initial);
  const [category, setCategory] = useState<CategoryId>("appearance");

  // Reset draft when opening
  useEffect(() => {
    if (open) setDraft(initial);
  }, [open]);

  if (!open) return null;

  const set = <K extends keyof SettingsDraft>(key: K, value: SettingsDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const handleSave = () => {
    onSave(draft);
    onClose();
  };

  const handleDiscard = () => {
    setDraft(initial);
    onClose();
  };

  const activeCategory = CATEGORIES.find((c) => c.id === category)!;

  return (
    /* Overlay — opaque dot-grid, no transparency blur */
    <div
      className="fixed inset-0 z-50 bg-background flex items-center justify-center"
      style={{
        backgroundImage: "radial-gradient(circle, hsl(var(--muted-foreground) / 0.12) 1px, transparent 1px)",
        backgroundSize: "14px 14px",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) handleDiscard(); }}
    >
      {/* Panel — double border + offset shadow for terminal visibility */}
      <div
        data-nc-dialog=""
        className="bg-card border-2 border-border flex flex-col"
        style={{
          width: 680, height: 460,
          boxShadow: "6px 6px 0 hsl(var(--border))",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted shrink-0">
          <span className="font-mono text-[11px] font-bold tracking-widest text-foreground select-none">
            // SETTINGS
          </span>
          <span className="font-mono text-[10px] text-muted-foreground select-none tracking-wide">
            // MTCode
          </span>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0">

          {/* Left sidebar — categories */}
          <div className="w-[160px] shrink-0 border-r border-border bg-background flex flex-col py-3 gap-0">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                className={cn(
                  "w-full text-left font-mono text-[11px] tracking-wider px-4 py-2 transition-colors",
                  category === cat.id
                    ? "text-foreground bg-accent/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/10",
                )}
                onClick={() => setCategory(cat.id)}
              >
                <span className="opacity-50 select-none mr-1">
                  {category === cat.id ? "▸" : " "}
                </span>
                {cat.label}
              </button>
            ))}
          </div>

          {/* Right — settings form */}
          <div className="flex-1 min-w-0 flex flex-col p-5 gap-5 overflow-y-auto themed-scrollbar">

            {/* Config path */}
            <div className="font-mono text-[10px] text-muted-foreground/50 tracking-wide select-none mb-1">
              // {activeCategory.path}
            </div>

            {/* ── APPEARANCE ──────────────────────────────────────── */}
            {category === "appearance" && (
              <div className="flex flex-col gap-3">
                <div className="font-mono text-[10px] font-bold tracking-widest text-muted-foreground select-none mb-1">
                  // THEME
                </div>

                <div className="border border-border">
                  <select
                    className="w-full h-[28px] border-0 bg-transparent text-foreground font-mono text-[11px] px-2 outline-none"
                    value={draft.themeId}
                    onChange={(e) => set("themeId", e.target.value)}
                  >
                    <option value="monokai-dark">Monokai</option>
                    <option value="mahogany">Mahogany</option>
                    <option value="linen">Linen</option>
                    <option value="norton-dark">Norton</option>
                  </select>
                </div>

                <div className="font-mono text-[10px] text-muted-foreground/50">
                  // Toggle dark/light with status bar button
                </div>

                <div className="font-mono text-[10px] font-bold tracking-widest text-muted-foreground select-none mt-2 mb-1">
                  // TYPOGRAPHY
                </div>

                <div className={rowCls}>
                  <span className={labelColCls}>FONT FAMILY</span>
                  <select
                    className={cn(inputCls, "w-[200px]")}
                    value={draft.fontFamily}
                    onChange={(e) => set("fontFamily", e.target.value)}
                    style={{ fontFamily: draft.fontFamily }}
                  >
                    {FONTS.map((f) => (
                      <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={rowCls}>
                  <span className={labelColCls}>FONT SIZE</span>
                  <input
                    className={cn(inputCls, "w-[60px]")}
                    type="number"
                    value={draft.fontSize}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10);
                      if (!isNaN(n)) set("fontSize", n);
                    }}
                    onBlur={() => set("fontSize", Math.max(9, Math.min(24, draft.fontSize)))}
                  />
                  <span className="font-mono text-[10px] text-muted-foreground select-none">px</span>
                </div>
              </div>
            )}

            {/* ── EDITOR ──────────────────────────────────────────── */}
            {category === "editor" && (
              <div className="flex flex-col gap-3">
                <div className="font-mono text-[10px] font-bold tracking-widest text-muted-foreground select-none mb-1">
                  // INDENTATION
                </div>

                <div className={rowCls}>
                  <span className={labelColCls}>TAB SIZE</span>
                  <input
                    className={cn(inputCls, "w-[60px]")}
                    type="number"
                    value={draft.tabSize}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10);
                      if (!isNaN(n)) set("tabSize", n);
                    }}
                    onBlur={() => set("tabSize", Math.max(1, Math.min(8, draft.tabSize)))}
                  />
                  <span className="font-mono text-[10px] text-muted-foreground select-none">spaces</span>
                </div>

                <div className="font-mono text-[10px] font-bold tracking-widest text-muted-foreground select-none mt-2 mb-1">
                  // LAYOUT
                </div>

                <div className={rowCls}>
                  <span className={labelColCls}>WORD WRAP</span>
                  <select
                    className={selectCls}
                    value={draft.wordWrap}
                    onChange={(e) => set("wordWrap", e.target.value as SettingsDraft["wordWrap"])}
                  >
                    <option value="off">OFF</option>
                    <option value="on">ON</option>
                    <option value="wordWrapColumn">COLUMN</option>
                  </select>
                </div>
              </div>
            )}

            {/* ── HOTKEYS ─────────────────────────────────────────── */}
            {category === "hotkeys" && (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <div className="font-mono text-[10px] font-bold tracking-widest text-muted-foreground select-none mb-2">
                    // MTCode — click a binding to record
                  </div>
                  <div className="border border-border">
                    {(Object.keys(HOTKEY_LABELS) as HotkeyAction[]).map((action, i, arr) => {
                      const current = draft.hotkeys[action] ?? HOTKEY_DEFAULTS[action];
                      const isDefault = current === HOTKEY_DEFAULTS[action];
                      return (
                        <div
                          key={action}
                          className={cn(
                            "grid items-center px-2 gap-2 h-[26px]",
                            i !== arr.length - 1 && "border-b border-border",
                          )}
                          style={{ gridTemplateColumns: "1fr 160px auto" }}
                        >
                          <span className="font-mono text-[10px] text-muted-foreground select-none">
                            {HOTKEY_LABELS[action]}
                          </span>
                          <KeyRecorder
                            value={current}
                            onChange={(binding) =>
                              set("hotkeys", { ...draft.hotkeys, [action]: binding })
                            }
                          />
                          <button
                            type="button"
                            className={cn(
                              "font-mono text-[9px] px-1.5 h-[18px] border border-border select-none",
                              isDefault
                                ? "text-muted-foreground/30 cursor-default"
                                : "text-muted-foreground hover:text-foreground hover:border-muted-foreground",
                            )}
                            title="Reset to default"
                            disabled={isDefault}
                            onClick={() =>
                              set("hotkeys", { ...draft.hotkeys, [action]: HOTKEY_DEFAULTS[action] })
                            }
                          >
                            RST
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Monaco built-in shortcuts (read-only) */}
                <div className="flex flex-col gap-1 mt-2">
                  <div className="font-mono text-[10px] font-bold tracking-widest text-muted-foreground select-none mb-1">
                    // Monaco Editor — built-in (read-only)
                  </div>
                  <div className="border border-border">
                    {[
                      { label: "Undo", binding: "Ctrl+Z" },
                      { label: "Redo", binding: "Ctrl+Y" },
                      { label: "Cut", binding: "Ctrl+X" },
                      { label: "Copy", binding: "Ctrl+C" },
                      { label: "Paste", binding: "Ctrl+V" },
                      { label: "Select All", binding: "Ctrl+A" },
                      { label: "Line Comment", binding: "Ctrl+/" },
                      { label: "Block Comment", binding: "Ctrl+Shift+/" },
                      { label: "Fold All", binding: "Ctrl+K Ctrl+0" },
                      { label: "Unfold All", binding: "Ctrl+K Ctrl+J" },
                      { label: "Toggle Fold", binding: "Ctrl+Shift+[" },
                      { label: "Go to Line", binding: "Ctrl+G" },
                      { label: "Find Next", binding: "F3" },
                      { label: "Find Prev", binding: "Shift+F3" },
                      { label: "Select Next Occurrence", binding: "Ctrl+D" },
                      { label: "Select All Occurrences", binding: "Ctrl+Shift+L" },
                      { label: "Delete Line", binding: "Ctrl+Shift+K" },
                      { label: "Move Line Up", binding: "Alt+↑" },
                      { label: "Move Line Down", binding: "Alt+↓" },
                      { label: "Copy Line Up", binding: "Shift+Alt+↑" },
                      { label: "Copy Line Down", binding: "Shift+Alt+↓" },
                      { label: "Format Document", binding: "Shift+Alt+F" },
                    ].map((item, i, arr) => (
                      <div
                        key={item.label}
                        className={cn(
                          "grid items-center px-2 gap-2 h-[26px]",
                          i !== arr.length - 1 && "border-b border-border",
                        )}
                        style={{ gridTemplateColumns: "1fr 160px" }}
                      >
                        <span className="font-mono text-[10px] text-muted-foreground select-none">
                          {item.label}
                        </span>
                        <KbdBinding binding={item.binding} />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="font-mono text-[10px] text-muted-foreground/40 select-none mt-1">
                  {"> MTCode hotkeys apply after APPLY & SAVE"}
                  <br />
                  {"> Monaco shortcuts are built-in and cannot be remapped"}
                </div>
              </div>
            )}

            {/* ── F-KEYS ───────────────────────────────────────────── */}
            {category === "fkeys" && (
              <div className="flex flex-col gap-3">
                <div className="font-mono text-[10px] font-bold tracking-widest text-muted-foreground select-none mb-2">
                  // Assign actions to function keys F1–F10
                </div>
                <div className="border border-border">
                  {Array.from({ length: 10 }, (_, i) => {
                    const current = draft.fkeyActions[i] ?? null;
                    const isDefault = current === FKEY_DEFAULT_ACTIONS[i];
                    return (
                      <div
                        key={i}
                        className={cn(
                          "grid items-center px-2 gap-2 h-[28px]",
                          i !== 9 && "border-b border-border",
                        )}
                        style={{ gridTemplateColumns: "48px 1fr auto" }}
                      >
                        <span className="font-mono text-[10px] text-primary select-none">F{i + 1}</span>
                        <select
                          className="bg-transparent font-mono text-[10px] text-foreground border-0 outline-none w-full cursor-pointer"
                          value={current ?? ""}
                          onChange={(e) => {
                            const val = e.target.value || null;
                            const next = [...draft.fkeyActions];
                            next[i] = val;
                            set("fkeyActions", next);
                          }}
                        >
                          <option value="">(none)</option>
                          {(Object.keys(HOTKEY_LABELS) as HotkeyAction[]).map((action) => (
                            <option key={action} value={action}>
                              {HOTKEY_LABELS[action]}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className={cn(
                            "font-mono text-[9px] px-1.5 h-[18px] border border-border select-none",
                            isDefault
                              ? "text-muted-foreground/30 cursor-default"
                              : "text-muted-foreground hover:text-foreground hover:border-muted-foreground",
                          )}
                          title="Reset to default"
                          disabled={isDefault}
                          onClick={() => {
                            const next = [...draft.fkeyActions];
                            next[i] = FKEY_DEFAULT_ACTIONS[i];
                            set("fkeyActions", next);
                          }}
                        >
                          RST
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="font-mono text-[10px] text-muted-foreground/40 select-none mt-1">
                  {"> Changes apply after APPLY & SAVE"}
                </div>
              </div>
            )}

            {/* ── SEARCH ───────────────────────────────────────────── */}
            {category === "search" && (
              <div className="flex flex-col gap-3">
                <div className="font-mono text-[10px] font-bold tracking-widest text-muted-foreground select-none mb-1">
                  // RESULTS
                </div>

                <div className={rowCls}>
                  <span className={labelColCls}>FILE GROUPS</span>
                  {/* Segmented COLLAPSED / EXPANDED toggle */}
                  <div className="inline-flex border border-border">
                    {([true, false] as const).map((collapsed, i) => (
                      <button
                        key={String(collapsed)}
                        type="button"
                        className={cn(
                          "font-mono text-[11px] tracking-wider px-3 h-[22px] transition-colors select-none",
                          i > 0 && "border-l border-border",
                          draft.searchCollapsedByDefault === collapsed
                            ? "bg-accent/30 text-foreground"
                            : "text-muted-foreground hover:text-foreground hover:bg-accent/10",
                        )}
                        onClick={() => set("searchCollapsedByDefault", collapsed)}
                      >
                        {collapsed ? "COLLAPSED" : "EXPANDED"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-2 font-mono text-[10px] text-muted-foreground/40 leading-relaxed select-none">
                  {"> COLLAPSED: file groups start folded, click to expand"}
                  <br />
                  {"> EXPANDED: all matches visible immediately"}
                </div>
              </div>
            )}

            {/* ── LANGUAGE ─────────────────────────────────────────── */}
            {category === "language" && (
              <div className="flex flex-col gap-3">
                <div className="font-mono text-[10px] font-bold tracking-widest text-muted-foreground select-none mb-1">
                  // PLC RAINBOW BLOCKS
                </div>

                <div className={rowCls}>
                  <span className={labelColCls}>RAINBOW BLOCKS</span>
                  <div className="inline-flex border border-border">
                    {([true, false] as const).map((val, i) => (
                      <button
                        key={String(val)}
                        type="button"
                        className={cn(
                          "font-mono text-[11px] tracking-wider px-3 h-[22px] transition-colors select-none",
                          i > 0 && "border-l border-border",
                          draft.plcRainbowEnabled === val
                            ? "bg-accent/30 text-foreground"
                            : "text-muted-foreground hover:text-foreground hover:bg-accent/10",
                        )}
                        onClick={() => set("plcRainbowEnabled", val)}
                      >
                        {val ? "ENABLED" : "DISABLED"}
                      </button>
                    ))}
                  </div>
                </div>

                {draft.plcRainbowEnabled && (
                  <>
                    <div className="flex items-center justify-between mt-1">
                      <span className="font-mono text-[10px] font-bold tracking-widest text-muted-foreground select-none">
                        // LEVEL COLORS
                      </span>
                      <button
                        type="button"
                        className="font-mono text-[9px] px-2 h-[18px] border border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground transition-colors select-none"
                        title="Reset to auto (theme-adaptive)"
                        onClick={() => set("plcRainbowColors", [])}
                      >
                        AUTO
                      </button>
                    </div>

                    <div className="grid gap-x-3 gap-y-1.5" style={{ gridTemplateColumns: "1fr 1fr" }}>
                      {Array.from({ length: 10 }, (_, i) => {
                        // Show effective colors (auto or custom)
                        const isAuto = draft.plcRainbowColors.length < 10;
                        const autoPalette = THEMES[draft.themeId as keyof typeof THEMES]?.mode === "light"
                          ? LIGHT_RAINBOW_COLORS : DARK_RAINBOW_COLORS;
                        const color = isAuto
                          ? (autoPalette[i] ?? DEFAULT_RAINBOW_COLORS[i])
                          : (draft.plcRainbowColors[i] ?? DEFAULT_RAINBOW_COLORS[i]);
                        return (
                          <div key={i} className="flex items-center gap-2 h-[24px]">
                            <span className="font-mono text-[10px] text-muted-foreground select-none shrink-0 w-[30px]">
                              LVL {i}
                            </span>
                            <input
                              type="color"
                              value={color}
                              onChange={(e) => {
                                // Promote to custom mode: fill from current effective palette
                                const base = isAuto ? [...autoPalette] : [...draft.plcRainbowColors];
                                while (base.length < 10) base.push(DEFAULT_RAINBOW_COLORS[base.length] ?? "#FFFFFF");
                                base[i] = e.target.value;
                                set("plcRainbowColors", base);
                              }}
                              className="shrink-0 border border-border cursor-pointer"
                              style={{ width: 28, height: 20, padding: 1 }}
                              title={`Level ${i} color: ${color}`}
                            />
                            <span
                              className="font-mono text-[9px] text-muted-foreground/50 select-none overflow-hidden"
                              style={{ color }}
                            >
                              {color.toUpperCase()}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-1 font-mono text-[10px] text-muted-foreground/40 leading-relaxed select-none">
                      {"> Colors applied to IF/ENDIF  WHILE/ENDWHILE  OPEN/CLOSE keywords"}
                      <br />
                      {"> Each nesting depth gets its own color (levels 0-9 cycle)"}
                    </div>
                  </>
                )}

                {!draft.plcRainbowEnabled && (
                  <div className="mt-1 font-mono text-[10px] text-muted-foreground/40 select-none">
                    {"> Enable to colorize block keywords by nesting depth"}
                  </div>
                )}
              </div>
            )}

            {/* ── AI ASSISTANT ─────────────────────────────────────── */}
            {category === "ai" && (
              <div className="flex flex-col gap-3">
                <div className="font-mono text-[10px] font-bold tracking-widest text-muted-foreground select-none mb-1">
                  // AI ASSISTANT
                </div>

                <div className={rowCls}>
                  <span className={labelColCls}>SHOW ASSISTANT</span>
                  <div className="inline-flex border border-border">
                    {([true, false] as const).map((val, i) => (
                      <button
                        key={String(val)}
                        type="button"
                        className={cn(
                          "font-mono text-[11px] tracking-wider px-3 h-[22px] transition-colors select-none",
                          i > 0 && "border-l border-border",
                          draft.aiAssistantVisible === val
                            ? "bg-accent/30 text-foreground"
                            : "text-muted-foreground hover:text-foreground hover:bg-accent/10",
                        )}
                        onClick={() => set("aiAssistantVisible", val)}
                      >
                        {val ? "VISIBLE" : "HIDDEN"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={rowCls}>
                  <span className={labelColCls}>CHARACTER</span>
                  <select
                    className="w-[160px] h-[24px] border border-border bg-transparent text-foreground font-mono text-[11px] px-2 outline-none"
                    value={draft.aiCharacterId}
                    onChange={(e) => set("aiCharacterId", e.target.value as AICharacterId)}
                  >
                    {Object.entries(AI_CHARACTERS).map(([id, char]) => (
                      <option key={id} value={id}>
                        {char.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-2 font-mono text-[10px] text-muted-foreground/40 leading-relaxed select-none">
                  {"> The AI assistant appears in the bottom-right corner"}
                  <br />
                  {"> It can be dragged to reposition and hidden via the × button"}
                  <br />
                  {"> Shortcuts: Ctrl+Shift+A to toggle visibility"}
                  <br />
                  {"> Character recolors automatically to match the current theme"}
                </div>

                {/* Preview box */}
                <div className="flex items-center justify-center mt-2 border border-border bg-muted/20 h-[80px]">
                  <div
                    className="w-[50px] h-[70px] rounded overflow-hidden"
                    style={{
                      backgroundImage: `url(/assets/ai-assistant/${draft.aiCharacterId}-spritesheet.png)`,
                      backgroundSize: `${AI_CHARACTERS[draft.aiCharacterId].frameWidth * 6}px auto`,
                      imageRendering: "pixelated",
                      filter: "none", // Preview without theme filter
                    }}
                  />
                </div>
              </div>
            )}

            {/* ── AUTOSAVE ─────────────────────────────────────────── */}
            {category === "autosave" && (
              <div className="flex flex-col gap-3">
                <div className="font-mono text-[10px] font-bold tracking-widest text-muted-foreground select-none mb-1">
                  // AUTOSAVE
                </div>

                <div className={rowCls}>
                  <span className={labelColCls}>MODE</span>
                  <select
                    className={selectCls}
                    value={draft.autosaveMode}
                    onChange={(e) => set("autosaveMode", e.target.value as AutosaveMode)}
                  >
                    <option value="off">OFF</option>
                    <option value="focusChange">ON FOCUS CHANGE</option>
                    <option value="delayed">DELAYED</option>
                  </select>
                </div>

                {draft.autosaveMode === "delayed" && (
                  <div className={rowCls}>
                    <span className={labelColCls}>DELAY</span>
                    <input
                      className={cn(inputCls, "w-[80px]")}
                      type="number"
                      step={100}
                      value={draft.autosaveDelayMs}
                      onChange={(e) => {
                        const n = parseInt(e.target.value, 10);
                        if (!isNaN(n)) set("autosaveDelayMs", n);
                      }}
                      onBlur={() => set("autosaveDelayMs", Math.max(250, draft.autosaveDelayMs))}
                    />
                    <span className="font-mono text-[10px] text-muted-foreground select-none">ms</span>
                  </div>
                )}

                <div className="mt-2 font-mono text-[10px] text-muted-foreground/40 leading-relaxed select-none">
                  {"> OFF: manual save only (Ctrl+S)"}
                  <br />
                  {"> FOCUS CHANGE: save on editor blur"}
                  <br />
                  {"> DELAYED: save after N ms of inactivity"}
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Bottom action bar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-muted shrink-0">
          <button
            className="font-mono text-[11px] tracking-wider text-muted-foreground border border-border px-4 h-[26px] hover:text-foreground hover:bg-accent/10 transition-colors"
            onClick={handleDiscard}
          >
            DISCARD
          </button>
          <button
            className="font-mono text-[11px] tracking-wider text-foreground bg-accent/20 border border-border px-4 h-[26px] hover:bg-accent/30 transition-colors"
            onClick={handleSave}
          >
            APPLY &amp; SAVE
          </button>
        </div>
      </div>
    </div>
  );
}
