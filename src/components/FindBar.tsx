import { ArrowDown, ArrowUp } from "lucide-react";
import type { IRange } from "monaco-editor";
import type React from "react";
import { cn } from "../lib/utils";

type Props = {
  query: string;
  replaceText: string;
  findRanges: IRange[];
  findIndex: number;
  findInputRef: React.RefObject<HTMLInputElement>;
  replaceInputRef: React.RefObject<HTMLInputElement>;
  onQueryChange: (value: string) => void;
  onReplaceTextChange: (value: string) => void;
  onNavigate: (direction: 1 | -1) => void;
  onReplaceCurrent: () => void;
  onReplaceAll: () => void;
  onClose: () => void;
};

const inputCls = cn(
  "h-7 bg-input border border-border text-foreground text-[11px] px-2",
  "placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
);

const btnCls = cn(
  "h-7 border border-border bg-card text-muted-foreground text-[11px] px-2",
  "inline-flex items-center justify-center gap-1 hover:text-foreground transition-colors"
);

export function FindBar({
  query,
  replaceText,
  findRanges,
  findIndex,
  findInputRef,
  replaceInputRef,
  onQueryChange,
  onReplaceTextChange,
  onNavigate,
  onReplaceCurrent,
  onReplaceAll,
  onClose,
}: Props) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
    if (e.key === "Enter") { e.preventDefault(); onNavigate(e.shiftKey ? -1 : 1); return; }
    if ((e.key === "ArrowDown" || e.key === "ArrowUp") && e.altKey) {
      e.preventDefault(); onNavigate(e.key === "ArrowDown" ? 1 : -1);
    }
  };
  return (
    <div className="grid gap-1.5 items-center border-b border-border bg-card px-1.5 py-1.5 shrink-0"
      style={{ gridTemplateColumns: "minmax(130px,220px) minmax(130px,220px) auto auto auto auto auto" }}
    >
      <input
        className={inputCls}
        ref={findInputRef}
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Find in current file"
        onKeyDown={handleKeyDown}
      />
      <input
        className={inputCls}
        ref={replaceInputRef}
        value={replaceText}
        onChange={(event) => onReplaceTextChange(event.target.value)}
        placeholder="Replace"
      />
      <span className="min-w-[48px] text-center text-[11px] text-muted-foreground">
        {findRanges.length ? `${findIndex + 1}/${findRanges.length}` : "0/0"}
      </span>
      <button className={btnCls} onClick={() => onNavigate(-1)} title="Previous (Shift+Enter / Alt+↑ / Shift+F3)">
        <ArrowUp size={12} />
      </button>
      <button className={btnCls} onClick={() => onNavigate(1)} title="Next (Enter / Alt+↓ / F3)">
        <ArrowDown size={12} />
      </button>
      <button className={btnCls} onClick={onReplaceCurrent} title="Replace current">
        Replace
      </button>
      <button className={btnCls} onClick={onReplaceAll} title="Replace all">
        All
      </button>
    </div>
  );
}
