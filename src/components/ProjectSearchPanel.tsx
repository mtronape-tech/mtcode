import { useState, useEffect, useRef, useMemo } from "react";
import { cn } from "../lib/utils";
import type { SearchHit, ProjectSearchOptions } from "../services/ipc";

// ── Types ─────────────────────────────────────────────────────────────────────

type FileGroup = { path: string; hits: SearchHit[] };

type VisibleItem =
  | { kind: "file"; path: string; count: number; collapsed: boolean }
  | { kind: "hit";  hit: SearchHit; filePath: string };

type Props = {
  query: string;
  busy: boolean;
  hits: SearchHit[];
  scannedFiles: number;
  totalHits: number;
  inputRef: React.RefObject<HTMLInputElement>;
  opts: ProjectSearchOptions;
  onOptsChange: (opts: ProjectSearchOptions) => void;
  onQueryChange: (value: string) => void;
  onSearch: (opts: ProjectSearchOptions) => void;
  onHitClick: (hit: SearchHit) => void;
  /** When true, file groups start collapsed. New groups from streaming results also start collapsed. */
  collapsedByDefault?: boolean;
};

// ── Checkbox ──────────────────────────────────────────────────────────────────

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex items-center gap-1.5 cursor-pointer select-none group" onClick={() => onChange(!checked)}>
      <span className={cn(
        "inline-flex items-center justify-center w-[11px] h-[11px] border font-mono text-[9px] shrink-0 transition-colors",
        checked ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-transparent group-hover:border-muted-foreground",
      )}>✓</span>
      <span className="font-mono text-[10px] text-muted-foreground group-hover:text-foreground transition-colors leading-none">
        {label}
      </span>
    </label>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ProjectSearchPanel({
  query, busy, hits, scannedFiles, totalHits,
  inputRef, opts, onOptsChange, onQueryChange, onSearch, onHitClick,
  collapsedByDefault = false,
}: Props) {
  const [showOptions, setShowOptions] = useState(false);
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(new Set());
  const [focusedIdx, setFocusedIdx] = useState(-1);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  // Tracks which file paths have been seen in the current search session.
  // Only paths first encountered during the session are auto-collapsed;
  // paths the user manually toggled are left alone on subsequent streaming updates.
  const seenPathsRef = useRef<Set<string>>(new Set());

  // Reset collapsed state and focus when a new search starts
  useEffect(() => {
    setCollapsedPaths(new Set());
    seenPathsRef.current = new Set();
    setFocusedIdx(-1);
    itemRefs.current = [];
  }, [hits.length === 0 ? 0 : hits[0]?.path + hits[0]?.line]); // reset when search restarts

  // Group hits by file path (preserving insertion order)
  const groups = useMemo<FileGroup[]>(() => {
    const map = new Map<string, SearchHit[]>();
    for (const hit of hits) {
      const arr = map.get(hit.path);
      if (arr) arr.push(hit);
      else map.set(hit.path, [hit]);
    }
    return Array.from(map.entries()).map(([path, h]) => ({ path, hits: h }));
  }, [hits]);

  // When collapsedByDefault, auto-collapse file paths the first time they appear in groups.
  // seenPathsRef tracks which paths have been visited this session so that:
  //   • new streaming file groups start collapsed
  //   • paths the user manually expanded are NOT re-collapsed on subsequent streaming updates
  useEffect(() => {
    if (!collapsedByDefault) return;
    const newPaths: string[] = [];
    for (const g of groups) {
      if (!seenPathsRef.current.has(g.path)) {
        seenPathsRef.current.add(g.path);
        newPaths.push(g.path);
      }
    }
    if (newPaths.length > 0) {
      setCollapsedPaths((prev) => {
        const next = new Set(prev);
        for (const p of newPaths) next.add(p);
        return next;
      });
    }
  }, [groups, collapsedByDefault]);

  // Flatten groups into visible items (respecting collapsed state)
  const visibleItems = useMemo<VisibleItem[]>(() => {
    const items: VisibleItem[] = [];
    for (const { path, hits: gh } of groups) {
      const collapsed = collapsedPaths.has(path);
      items.push({ kind: "file", path, count: gh.length, collapsed });
      if (!collapsed) {
        for (const hit of gh) items.push({ kind: "hit", hit, filePath: path });
      }
    }
    return items;
  }, [groups, collapsedPaths]);

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIdx >= 0) itemRefs.current[focusedIdx]?.scrollIntoView({ block: "nearest" });
  }, [focusedIdx]);

  const clampFocus = (idx: number) => Math.max(-1, Math.min(idx, visibleItems.length - 1));

  const toggleCollapse = (path: string) => {
    setCollapsedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const activateItem = (item: VisibleItem) => {
    if (item.kind === "file") toggleCollapse(item.path);
    else onHitClick(item.hit);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setFocusedIdx((p) => clampFocus(p + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setFocusedIdx((p) => clampFocus(p - 1)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      if (focusedIdx >= 0 && visibleItems[focusedIdx]) activateItem(visibleItems[focusedIdx]);
      else onSearch(opts);
    }
  };

  const setOpt = <K extends keyof ProjectSearchOptions>(key: K, value: ProjectSearchOptions[K]) =>
    onOptsChange({ ...opts, [key]: value });

  const btnBase = cn(
    "h-7 px-3 border border-border bg-card text-muted-foreground font-mono text-[11px]",
    "hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-default",
  );

  // Short path for display: strip common root prefix
  const shortPath = (p: string) => {
    const parts = p.replace(/\\/g, "/").split("/");
    return parts.length > 3 ? `…/${parts.slice(-3).join("/")}` : parts.join("/");
  };

  return (
    <div className="flex flex-col h-full bg-card overflow-hidden" style={{ padding: "7px", gap: "7px" }}>

      {/* Search row */}
      <div className="grid gap-1.5" style={{ gridTemplateColumns: "1fr auto auto" }}>
        <input
          className={cn(
            "h-7 bg-input border border-border text-foreground font-mono text-[11px] px-2",
            "placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring",
          )}
          ref={inputRef}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder="Search in project..."
        />
        <button
          className={cn(btnBase, showOptions && "text-foreground bg-accent/10")}
          onClick={() => setShowOptions((v) => !v)}
          title="Toggle search options"
        >{showOptions ? "▲" : "▼"}</button>
        <button className={btnBase} onClick={() => onSearch(opts)} disabled={busy}>
          {busy ? "..." : "SEARCH"}
        </button>
      </div>

      {/* Options panel */}
      {showOptions && (
        <div className="border border-border bg-background p-2 grid gap-y-1.5 gap-x-4"
          style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="flex flex-col gap-1.5">
            <Checkbox label="Только слова целиком"  checked={opts.wholeWord}     onChange={(v) => setOpt("wholeWord", v)} />
            <Checkbox label="Учитывать регистр"      checked={opts.caseSensitive} onChange={(v) => setOpt("caseSensitive", v)} />
            <Checkbox label="Регулярные выражения"   checked={opts.useRegex}      onChange={(v) => setOpt("useRegex", v)} />
            <Checkbox label="Файлы БЕЗ совпадений"   checked={opts.invertMatch}   onChange={(v) => setOpt("invertMatch", v)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Checkbox label="UTF-8"           checked={opts.encUtf8}   onChange={(v) => setOpt("encUtf8", v)} />
            <Checkbox label="ANSI (Windows)"  checked={opts.encAnsi}   onChange={(v) => setOpt("encAnsi", v)} />
            <Checkbox label="ASCII (DOS)"     checked={opts.encAscii}  onChange={(v) => setOpt("encAscii", v)} />
            <Checkbox label="UTF-16"          checked={opts.encUtf16}  onChange={(v) => setOpt("encUtf16", v)} />
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="font-mono text-[10px] text-muted-foreground/60 select-none">
        {busy
          ? hits.length > 0
            ? `// scanning… ${totalHits} match${totalHits !== 1 ? "es" : ""} · ${scannedFiles} file${scannedFiles !== 1 ? "s" : ""} scanned`
            : `// scanning… ${scannedFiles > 0 ? `${scannedFiles} file${scannedFiles !== 1 ? "s" : ""} scanned` : "starting…"}`
          : hits.length > 0
            ? `// ${totalHits} match${totalHits !== 1 ? "es" : ""} in ${groups.length} file${groups.length !== 1 ? "s" : ""} · ↑↓ navigate · Enter open`
            : "// no results"}
      </div>

      {/* Results — grouped by file */}
      <div ref={listRef} className="themed-scrollbar border border-border bg-background overflow-auto flex-1 min-h-0">
        {visibleItems.length > 0 ? (
          visibleItems.map((item, idx) => {
            const isFocused = focusedIdx === idx;
            if (item.kind === "file") {
              return (
                <button
                  key={`file:${item.path}`}
                  ref={(el) => { itemRefs.current[idx] = el; }}
                  className={cn(
                    "w-full text-left flex items-center gap-1.5 px-2 h-[22px] border-b border-border",
                    "font-mono text-[10px] select-none transition-colors",
                    isFocused ? "bg-accent/20" : "bg-muted/40 hover:bg-muted/70",
                  )}
                  onClick={() => { setFocusedIdx(idx); toggleCollapse(item.path); }}
                  onMouseEnter={() => setFocusedIdx(idx)}
                  title={item.path}
                >
                  <span className="text-muted-foreground/60 shrink-0 w-[10px]">
                    {item.collapsed ? "▶" : "▼"}
                  </span>
                  <span className="text-primary truncate flex-1">{shortPath(item.path)}</span>
                  <span className="text-muted-foreground/50 shrink-0 ml-1">
                    [{item.count}]
                  </span>
                </button>
              );
            }
            return (
              <button
                key={`hit:${item.hit.path}:${item.hit.line}:${item.hit.column}:${idx}`}
                ref={(el) => { itemRefs.current[idx] = el; }}
                className={cn(
                  "w-full text-left flex flex-col border-b border-border/50 px-2 py-1",
                  "transition-colors pl-5",
                  isFocused ? "bg-accent/20 text-foreground" : "hover:bg-accent/10",
                )}
                onClick={() => { setFocusedIdx(idx); onHitClick(item.hit); }}
                onMouseEnter={() => setFocusedIdx(idx)}
              >
                <span className="font-mono text-[9px] text-muted-foreground/60 leading-none mb-0.5">
                  LN:{item.hit.line}  COL:{item.hit.column}
                </span>
                <span className="font-mono text-[11px] text-foreground overflow-hidden text-ellipsis whitespace-nowrap"
                  title={item.hit.preview}>
                  {item.hit.preview}
                </span>
              </button>
            );
          })
        ) : (
          <div className="font-mono text-[10px] text-muted-foreground/50 p-3 leading-relaxed">
            {busy
              ? <><span className="animate-pulse">{">"}</span>{` scanning… ${scannedFiles > 0 ? `${scannedFiles} files` : ""}`}</>
              : "> open folder and enter query to search"}
          </div>
        )}
      </div>
    </div>
  );
}
