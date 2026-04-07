import { cn } from "../lib/utils";

/** Dialog shown when a file open in the editor is modified by an external process. */
type Props = {
  path: string | null;
  isDirty: boolean;
  onReload: () => void;
  onKeep: () => void;
};

export function ExternalChangeDialog({ path, isDirty, onReload, onKeep }: Props) {
  if (!path) return null;

  const fileName = path.split(/[/\\]/).pop() ?? path;

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="File changed"
    >
      <div className="bg-card border border-border shadow-2xl p-6 min-w-[360px] max-w-[520px]">
        <p className="text-foreground text-sm font-semibold mb-2.5">File changed externally</p>
        <p className="text-muted-foreground text-xs mb-5 leading-relaxed">
          <strong className="text-foreground">{fileName}</strong> was changed by another program.
          {isDirty ? " You have unsaved changes." : ""}
        </p>
        <div className="flex gap-2 justify-end">
          <button
            className={cn(
              "h-8 px-4 text-xs border border-primary bg-primary text-primary-foreground",
              "hover:opacity-90 transition-opacity"
            )}
            onClick={onReload}
          >
            Reload
          </button>
          <button
            className="h-8 px-4 text-xs border border-border bg-card text-muted-foreground hover:text-foreground transition-colors"
            onClick={onKeep}
          >
            Keep my changes
          </button>
        </div>
      </div>
    </div>
  );
}
