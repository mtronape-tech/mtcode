/**
 * Go To Line / Column dialog.
 * Shows current position, accepts target line and optional column.
 */
import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/utils";

type Props = {
  open: boolean;
  currentLine: number;
  currentCol: number;
  maxLine: number;
  maxCol: number;
  onGoTo: (line: number, col: number) => void;
  onClose: () => void;
};

const inputCls =
  "bg-input border border-border font-mono text-[11px] text-foreground " +
  "px-1.5 h-[22px] w-full focus:outline-none focus:ring-1 focus:ring-ring";

export function GoToDialog({
  open,
  currentLine,
  currentCol,
  maxLine,
  maxCol,
  onGoTo,
  onClose,
}: Props) {
  const [lineVal, setLineVal] = useState("");
  const [colVal, setColVal] = useState("");
  const lineRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setLineVal(String(currentLine));
      setColVal(String(currentCol));
      setTimeout(() => {
        lineRef.current?.focus();
        lineRef.current?.select();
      }, 30);
    }
  }, [open, currentLine, currentCol]);

  if (!open) return null;

  const handleSubmit = () => {
    const l = Math.max(1, Math.min(maxLine, parseInt(lineVal, 10) || currentLine));
    const c = Math.max(1, Math.min(maxCol, parseInt(colVal, 10) || 1));
    onGoTo(l, c);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSubmit();
    if (e.key === "Escape") onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-card border-2 border-border flex flex-col"
        style={{ width: 340, boxShadow: "6px 6px 0 hsl(var(--border))" }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Title */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted shrink-0">
          <span className="font-mono text-[11px] font-bold tracking-widest text-foreground select-none">
            // GO TO
          </span>
          <button
            className="font-mono text-[11px] text-muted-foreground hover:text-foreground border border-border px-2 h-[22px] hover:bg-accent/10 transition-colors"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="p-4 flex flex-col gap-3">
          <div className="font-mono text-[10px] text-muted-foreground/60 select-none">
            // YOU ARE HERE: Ln {currentLine}, Col {currentCol}
          </div>

          <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div className="flex flex-col gap-1">
              <label className="font-mono text-[10px] text-muted-foreground/70 select-none uppercase tracking-wider">
                LINE (max {maxLine})
              </label>
              <input
                ref={lineRef}
                className={inputCls}
                type="number"
                min={1}
                max={maxLine}
                value={lineVal}
                onChange={(e) => setLineVal(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-mono text-[10px] text-muted-foreground/70 select-none uppercase tracking-wider">
                COLUMN (max {maxCol})
              </label>
              <input
                className={inputCls}
                type="number"
                min={1}
                max={maxCol}
                value={colVal}
                onChange={(e) => setColVal(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 mt-1">
            <button
              className={cn(
                "font-mono text-[11px] tracking-wider text-muted-foreground",
                "border border-border px-3 h-[26px] hover:text-foreground hover:bg-accent/10 transition-colors",
              )}
              onClick={onClose}
            >
              CANCEL
            </button>
            <button
              className={cn(
                "font-mono text-[11px] tracking-wider text-foreground",
                "bg-accent/20 border border-border px-4 h-[26px] hover:bg-accent/30 transition-colors",
              )}
              onClick={handleSubmit}
            >
              GO
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
