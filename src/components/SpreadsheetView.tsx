/**
 * SpreadsheetView — read-only Excel viewer.
 * Renders sheets as tabs, cells as a frozen-header grid.
 */
import { useEffect, useRef, useState } from "react";
import { getXlsxInfo, XlsxWorkbook } from "../services/ipc";

interface Props {
  path: string;
}

export default function SpreadsheetView({ path }: Props) {
  const [workbook, setWorkbook] = useState<XlsxWorkbook | null>(null);
  const [activeSheet, setActiveSheet] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setWorkbook(null);
    setActiveSheet(0);
    getXlsxInfo(path)
      .then((wb) => {
        // Sanity-check: log workbook structure in dev so we can see what arrived
        if (import.meta.env.DEV) {
          const info = wb.sheets.map((s) => `${s.name}: ${s.rows.length}r × ${s.colCount}c`).join(", ");
          console.log("[SpreadsheetView] loaded:", info, wb);
        }
        setWorkbook(wb);
        setLoading(false);
      })
      .catch((e) => { setError(String(e)); setLoading(false); });
  }, [path]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm font-mono">
        Loading…
      </div>
    );
  }

  if (error || !workbook) {
    return (
      <div className="flex-1 flex items-center justify-center text-red-400 text-sm font-mono px-6 text-center">
        {error ?? "Failed to load workbook."}
      </div>
    );
  }

  const sheet = workbook.sheets[activeSheet];

  // Build column letters A, B, … Z, AA, AB, …
  const colLabel = (i: number): string => {
    let s = "";
    let n = i + 1;
    while (n > 0) {
      n--;
      s = String.fromCharCode(65 + (n % 26)) + s;
      n = Math.floor(n / 26);
    }
    return s;
  };

  // colCount comes from Rust (camelCase via serde rename_all).
  // Fallback: derive from actual row data in case serde naming ever drifts.
  const colCount = sheet
    ? (sheet.colCount > 0
        ? sheet.colCount
        : Math.max(0, ...sheet.rows.map((r) => r.length)))
    : 0;
  const cols = Array.from({ length: colCount }, (_, i) => i);

  return (
    <div className="flex flex-col h-full min-h-0 bg-background font-mono text-[12px]">
      {/* Sheet tabs */}
      {workbook.sheets.length > 1 && (
        <div className="flex items-center gap-0 border-b border-border shrink-0 overflow-x-auto hide-scrollbar">
          {workbook.sheets.map((s, i) => (
            <button
              key={i}
              onClick={() => setActiveSheet(i)}
              className={[
                "px-3 py-1 text-[11px] font-mono border-r border-border whitespace-nowrap shrink-0 transition-colors",
                i === activeSheet
                  ? "bg-accent/20 text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/10",
              ].join(" ")}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      <div ref={tableRef} className="flex-1 min-h-0 overflow-auto themed-scrollbar">
        {!sheet || sheet.rows.length === 0 ? (
          <div className="p-4 text-muted-foreground text-[11px]">Empty sheet.</div>
        ) : (
          <table className="border-collapse" style={{ tableLayout: "fixed" }}>
            <thead className="sticky top-0 z-10 bg-card">
              <tr>
                {/* Row number header corner */}
                <th className="xlsx-th xlsx-rn-col" />
                {cols.map((ci) => (
                  <th key={ci} className="xlsx-th" style={{ minWidth: 90, maxWidth: 200 }}>
                    {colLabel(ci)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sheet.rows.map((row, ri) => (
                <tr key={ri} className="hover:bg-accent/5">
                  {/* Row number */}
                  <td className="xlsx-td xlsx-rn-col select-none text-muted-foreground text-right">
                    {ri + 1}
                  </td>
                  {cols.map((ci) => {
                    const cell = row[ci];
                    const val = cell?.v ?? "";
                    const isNum = cell?.n != null;
                    return (
                      <td
                        key={ci}
                        title={val}
                        className={[
                          "xlsx-td truncate",
                          isNum ? "text-right" : "text-left",
                        ].join(" ")}
                      >
                        {val}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Status bar */}
      <div className="shrink-0 border-t border-border px-3 py-0.5 text-[10px] text-muted-foreground flex gap-4">
        <span>{sheet?.rows.length ?? 0} rows</span>
        <span>{colCount} cols</span>
        <span className="ml-auto opacity-60">read-only</span>
      </div>
    </div>
  );
}
