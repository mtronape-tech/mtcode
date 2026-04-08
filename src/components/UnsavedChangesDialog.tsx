import { cn } from "../lib/utils";
import type { EditorTab } from "../types";

type Props = {
  open: boolean;
  dirtyTabs: EditorTab[];
  onSaveAndExit: () => void | Promise<void>;
  onDiscardAndExit: () => void | Promise<void>;
  onCancel: () => void;
};

export function UnsavedChangesDialog({
  open,
  dirtyTabs,
  onSaveAndExit,
  onDiscardAndExit,
  onCancel,
}: Props) {
  if (!open) return null;

  const names = dirtyTabs
    .map((t) => t.name || t.path.split(/[/\\]/).pop() || t.path)
    .slice(0, 6);

  return (
    <div
      className="fixed inset-0 z-50 bg-background flex items-center justify-center"
      style={{
        backgroundImage: "radial-gradient(circle, hsl(var(--muted-foreground) / 0.12) 1px, transparent 1px)",
        backgroundSize: "14px 14px",
      }}
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label="Unsaved changes"
    >
      <div
        className="bg-card border-2 border-border flex flex-col"
        style={{ width: 520, maxWidth: "95vw", boxShadow: "6px 6px 0 hsl(var(--border))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted shrink-0">
          <span className="font-mono text-[11px] font-bold tracking-widest text-foreground select-none">
            // UNSAVED CHANGES
          </span>
          <button
            className="font-mono text-[11px] text-muted-foreground hover:text-foreground border border-border px-2 h-[22px] hover:bg-accent/10 transition-colors"
            onClick={onCancel}
          >
            ×
          </button>
        </div>

        <div className="flex flex-col p-6 gap-4">
          <div className="font-mono text-[11px] text-muted-foreground leading-relaxed">
            <div>{"> Есть несохранённые изменения в файлах:"}</div>
            <div className="mt-2 text-foreground">
              {names.map((n) => (
                <div key={n}>• {n}</div>
              ))}
              {dirtyTabs.length > names.length ? (
                <div className="opacity-70">… и ещё {dirtyTabs.length - names.length}</div>
              ) : null}
            </div>
            <div className="mt-3 opacity-80">
              Сохранить перед выходом?
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
              className={cn(
                "font-mono text-[11px] tracking-wider text-muted-foreground border border-border px-4 h-[26px]",
                "hover:text-foreground hover:bg-accent/10 transition-colors",
              )}
              onClick={onDiscardAndExit}
              title="Закрыть без сохранения"
            >
              DISCARD & EXIT
            </button>
            <button
              className="font-mono text-[11px] tracking-wider text-primary-foreground bg-primary border border-primary px-4 h-[26px] hover:opacity-90 transition-opacity"
              onClick={onSaveAndExit}
            >
              SAVE & EXIT
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

