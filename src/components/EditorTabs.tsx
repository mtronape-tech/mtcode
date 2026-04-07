import { Search, SearchCode } from "lucide-react";
import type { KeyboardEvent } from "react";
import { cn } from "../lib/utils";
import type { EditorTab } from "../types";

type SearchTab = {
  id: string;
  label: string;
  title: string;
};

type Props = {
  tabs: EditorTab[];
  activeTabId: string;
  searchTabs?: SearchTab[];
  onTabClick: (id: string) => void;
  onTabClose: (id: string) => void;
  onNewTab?: () => void;
};

function onTabKeyDown(event: KeyboardEvent<HTMLDivElement>, tabId: string, onTabClick: (id: string) => void) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    onTabClick(tabId);
  }
}

const tabBase = cn(
  "h-[28px] inline-flex items-center gap-1 border-r border-border px-2.5",
  "font-mono text-[11px] text-muted-foreground flex-shrink-0 max-w-[260px] cursor-pointer select-none",
  "hover:text-foreground hover:bg-accent/8 transition-colors",
);

const tabActive = "bg-card text-foreground border-t border-t-primary";

export function EditorTabs({ tabs, activeTabId, searchTabs = [], onTabClick, onTabClose, onNewTab }: Props) {
  const hasTabs = tabs.length > 0 || searchTabs.length > 0;

  return (
    <div className="border-b border-border bg-muted shrink-0">
      <div
        className="flex items-stretch gap-0 min-w-0 overflow-x-auto overflow-y-hidden hide-scrollbar min-h-[28px]"
        role="tablist"
        aria-label="Open tabs"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              className={cn(tabBase, isActive && tabActive)}
              role="tab"
              aria-selected={isActive}
              tabIndex={0}
              onClick={() => onTabClick(tab.id)}
              onKeyDown={(event) => onTabKeyDown(event, tab.id, onTabClick)}
            >
              {/* Active indicator */}
              <span className={cn("shrink-0 select-none", isActive ? "opacity-70" : "opacity-25")}>
                {isActive ? "▸" : "·"}
              </span>
              {/* Dirty marker */}
              {tab.dirty ? (
                <span className="text-primary text-[11px] shrink-0" title="Unsaved changes">*</span>
              ) : null}
              {/* Name */}
              <span className="overflow-hidden text-ellipsis whitespace-nowrap flex-1" title={tab.path}>
                {tab.name}
              </span>
              {/* Close */}
              <button
                type="button"
                className="inline-flex items-center justify-center font-mono text-[10px] text-muted-foreground/50 hover:text-foreground hover:bg-accent/20 transition-colors shrink-0 px-0.5"
                aria-label={`Close tab ${tab.name}`}
                title="Close"
                onClick={(event) => {
                  event.stopPropagation();
                  onTabClose(tab.id);
                }}
              >
                [×]
              </button>
            </div>
          );
        })}

        {searchTabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              className={cn(tabBase, isActive && tabActive)}
              role="tab"
              aria-selected={isActive}
              tabIndex={0}
              onClick={() => onTabClick(tab.id)}
              onKeyDown={(event) => onTabKeyDown(event, tab.id, onTabClick)}
              title={tab.title}
            >
              <span className={cn("shrink-0 select-none", isActive ? "opacity-70" : "opacity-25")}>
                {isActive ? "▸" : "·"}
              </span>
              {tab.id.includes("project") ? <SearchCode size={11} className="shrink-0 opacity-60" /> : <Search size={11} className="shrink-0 opacity-60" />}
              <span className="overflow-hidden text-ellipsis whitespace-nowrap flex-1">{tab.label}</span>
              <button
                type="button"
                className="inline-flex items-center justify-center font-mono text-[10px] text-muted-foreground/50 hover:text-foreground hover:bg-accent/20 transition-colors shrink-0 px-0.5"
                aria-label={`Close ${tab.label}`}
                title="Close"
                onClick={(event) => {
                  event.stopPropagation();
                  onTabClose(tab.id);
                }}
              >
                [×]
              </button>
            </div>
          );
        })}

        {!hasTabs ? (
          <div className={cn(tabBase, tabActive)}>
            <span className="opacity-30 select-none">·</span>
            <span className="text-muted-foreground">no file</span>
          </div>
        ) : null}

        {/* New-tab button — always at the trailing edge */}
        {onNewTab ? (
          <button
            type="button"
            className={cn(
              "h-[28px] px-2.5 border-r border-border font-mono text-[12px] shrink-0",
              "text-muted-foreground/50 hover:text-foreground hover:bg-accent/10 transition-colors select-none",
            )}
            title="Open file (Ctrl+O)"
            aria-label="Open file"
            onClick={onNewTab}
          >
            [+]
          </button>
        ) : null}
      </div>
    </div>
  );
}
