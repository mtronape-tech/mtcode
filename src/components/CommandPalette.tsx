import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/utils";
import { KbdBinding } from "./Kbd";

export type CommandPaletteItem = {
  label: string;
  group: string;
  shortcut?: string;
  disabled?: boolean;
  onSelect: () => void;
};

type Props = {
  open: boolean;
  items: CommandPaletteItem[];
  onClose: () => void;
};

export function CommandPalette({ open, items, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // All hooks must be called unconditionally — before any early return
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setFocusedIndex(0);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  // Scroll focused item into view
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector(`[data-idx="${focusedIndex}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest" });
  }, [focusedIndex, open]);

  // Reset focused index when filter query changes
  useEffect(() => {
    if (!open) return;
    setFocusedIndex(0);
  }, [query, open]);

  if (!open) return null;

  const q = query.toLowerCase();
  const filtered = items.filter(
    (item) =>
      !item.disabled &&
      (item.label.toLowerCase().includes(q) || item.group.toLowerCase().includes(q)),
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = filtered[focusedIndex];
      if (item) { onClose(); item.onSelect(); }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 flex items-start justify-center pt-[10vh]"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border flex flex-col"
        style={{ width: 560, maxWidth: "95vw", maxHeight: "70vh", boxShadow: "6px 6px 0 hsl(var(--border))" }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Title bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted shrink-0">
          <span className="font-mono text-[11px] font-bold tracking-widest text-foreground select-none">
            // COMMAND PALETTE
          </span>
          <button
            className="font-mono text-[11px] text-muted-foreground hover:text-foreground border border-border px-2 h-[22px] hover:bg-accent/10 transition-colors"
            onClick={onClose}
          >
            x
          </button>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-border shrink-0">
          <input
            ref={inputRef}
            className="w-full bg-transparent font-mono text-xs text-foreground placeholder:text-muted-foreground outline-none"
            placeholder="Type to filter commands..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {/* List */}
        <div ref={listRef} className="overflow-y-auto min-h-0">
          {filtered.length === 0 ? (
            <div className="px-4 py-3 font-mono text-xs text-muted-foreground">No commands found.</div>
          ) : (
            filtered.map((item, idx) => (
              <button
                key={idx}
                data-idx={idx}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-1.5 font-mono text-xs text-left transition-colors",
                  idx === focusedIndex
                    ? "bg-accent/20 text-foreground"
                    : "text-muted-foreground hover:bg-accent/10 hover:text-foreground",
                )}
                onClick={() => { onClose(); item.onSelect(); }}
                onMouseEnter={() => setFocusedIndex(idx)}
              >
                <span className="text-[10px] text-muted-foreground/60 w-[52px] shrink-0 uppercase tracking-wider">
                  {item.group}
                </span>
                <span className="flex-1 truncate">{item.label}</span>
                {item.shortcut && (
                  <span className="shrink-0 ml-auto pl-4">
                    <KbdBinding binding={item.shortcut} />
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
