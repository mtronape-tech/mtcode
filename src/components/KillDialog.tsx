/**
 * Kill confirmation dialog — styled like SettingsModal.
 */

import { cn } from "../lib/utils";

type Props = {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function KillDialog({ open, onConfirm, onCancel }: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-background flex items-center justify-center"
      style={{
        backgroundImage: "radial-gradient(circle, hsl(var(--muted-foreground) / 0.12) 1px, transparent 1px)",
        backgroundSize: "14px 14px",
      }}
      onClick={onCancel}
    >
      <div
        className="bg-card border-2 border-border flex flex-col"
        style={{ width: 420, maxWidth: "95vw", boxShadow: "6px 6px 0 hsl(var(--border))" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted shrink-0">
          <span className="font-mono text-[11px] font-bold tracking-widest text-foreground select-none">
            // KILL CNC PROCESSES
          </span>
          <button
            className="font-mono text-[11px] text-muted-foreground hover:text-foreground border border-border px-2 h-[22px] hover:bg-accent/10 transition-colors"
            onClick={onCancel}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col p-6 gap-4">
          <div className="font-mono text-[11px] text-muted-foreground leading-relaxed">
            <div>This will forcefully terminate the following processes:</div>
            <div className="mt-2 text-foreground">
              <div>• cnc_m.exe</div>
              <div>• pcommserver.exe</div>
            </div>
            <div className="mt-2 text-destructive-foreground">
              {"> Warning: unsaved data in these processes will be lost."}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              className="font-mono text-[11px] tracking-wider text-muted-foreground border border-border px-4 h-[26px] hover:text-foreground hover:bg-accent/10 transition-colors"
              onClick={onCancel}
            >
              CANCEL
            </button>
            <button
              className="font-mono text-[11px] tracking-wider text-destructive-foreground bg-destructive/20 border border-destructive/40 px-4 h-[26px] hover:bg-destructive/30 transition-colors"
              onClick={onConfirm}
            >
              KILL
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
