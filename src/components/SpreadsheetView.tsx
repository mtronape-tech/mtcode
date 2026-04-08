import type { XlsxWorkbookInfo } from "../services/ipc";

type Props = {
  info: XlsxWorkbookInfo;
  path: string;
};

/**
 * Basic spreadsheet viewer.
 * Displays sheet list and dimensions.
 * (Full grid rendering comes in next steps)
 */
export function SpreadsheetView({ info, path }: Props) {
  const fileName = path.split(/[\\/]/).pop() ?? path;

  return (
    <div className="h-full flex flex-col bg-background text-foreground">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/50 shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] font-bold tracking-widest text-muted-foreground select-none">
            // SPREADSHEET
          </span>
          <span className="font-mono text-[11px] text-foreground truncate">
            {fileName}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        <div className="font-mono text-[11px] text-muted-foreground mb-4">
          <span className="opacity-50">{">"}</span> File opened successfully. Select a sheet to view data.
        </div>

        <div className="border border-border rounded bg-card">
          {info.sheets.map((sheet, idx) => (
            <div
              key={sheet.name}
              className="flex items-center justify-between px-3 py-2 border-b border-border last:border-0 hover:bg-accent/10 transition-colors cursor-pointer"
              style={idx === 0 ? { backgroundColor: "hsl(var(--accent) / 0.1)" } : {}}
            >
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-muted-foreground w-4 text-right select-none">
                  {idx + 1}
                </span>
                <span className="font-bold text-foreground">{sheet.name}</span>
              </div>
              <span className="text-[10px] text-muted-foreground">
                {sheet.row_count} rows × {sheet.col_count} cols
              </span>
            </div>
          ))}
        </div>
        
        <div className="mt-4 font-mono text-[10px] text-muted-foreground/50">
          <span className="opacity-50">{">"}</span> Rendering engine: virtualized grid (coming soon)
        </div>
      </div>
    </div>
  );
}
