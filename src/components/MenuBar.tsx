import { appWindow } from "@tauri-apps/api/window";
import { useEffect, useState } from "react";
import { cn } from "../lib/utils";
import type { MenuAction, MenuKey } from "../types";
import { KbdBinding } from "./Kbd";

const MENU_KEYS: MenuKey[] = ["file", "edit", "search", "view", "encoding", "settings", "help"];
const MENU_TITLES: Record<MenuKey, string> = {
  file:     "FILE",
  edit:     "EDIT",
  search:   "SEARCH",
  view:     "VIEW",
  encoding: "ENCODING",
  settings: "SETTINGS",
  help:     "HELP",
};

type Props = {
  isDesktop: boolean;
  menuRef: React.RefObject<HTMLElement>;
  menuButtonRefs: React.MutableRefObject<Record<MenuKey, HTMLButtonElement | null>>;
  menuActionRefs: React.MutableRefObject<Array<HTMLButtonElement | null>>;
  menuActions: Record<MenuKey, MenuAction[]>;
  openMenu: MenuKey | null;
  focusedMenuIndex: number;
  focusedMenuActionIndex: number;
  onMenuOpen: (key: MenuKey) => void;
  onMenuClose: () => void;
  onRunAction: (fn: () => void) => void;
  onFocusMenuIndex: (index: number) => void;
  onFocusActionIndex: (index: number) => void;
};

export function MenuBar({
  isDesktop,
  menuRef,
  menuButtonRefs,
  menuActionRefs,
  menuActions,
  openMenu,
  focusedMenuIndex,
  focusedMenuActionIndex,
  onMenuOpen,
  onMenuClose,
  onRunAction,
  onFocusMenuIndex,
  onFocusActionIndex,
}: Props) {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!isDesktop) return;

    let stopResizeListener: null | (() => void) = null;

    const syncMaximizedState = async () => {
      try {
        setIsMaximized(await appWindow.isMaximized());
      } catch {
        setIsMaximized(false);
      }
    };

    void (async () => {
      await syncMaximizedState();
      const unlisten = await appWindow.onResized(() => {
        void syncMaximizedState();
      });
      stopResizeListener = unlisten;
    })();

    return () => {
      if (stopResizeListener) stopResizeListener();
    };
  }, [isDesktop]);

  const minimizeWindow = async () => {
    if (!isDesktop) return;
    try { await appWindow.minimize(); } catch { /* ignore */ }
  };

  const toggleMaximizeWindow = async () => {
    if (!isDesktop) return;
    try {
      await appWindow.toggleMaximize();
      setIsMaximized(await appWindow.isMaximized());
    } catch { /* ignore */ }
  };

  const closeWindow = async () => {
    if (!isDesktop) return;
    try { await appWindow.close(); } catch { /* ignore */ }
  };

  return (
    <header
      className="relative flex items-center gap-0 px-2.5 bg-card border-b border-border text-xs h-[38px] shrink-0"
      role="menubar"
      aria-label="Main menu"
      ref={menuRef}
    >
      <div className="inline-flex items-center gap-1 min-w-0">
        {/* App badge */}
        <div className="inline-flex items-center gap-0 mr-3 pr-3 border-r border-border" aria-hidden="true">
          <span className="text-muted-foreground font-mono text-[11px] tracking-tight select-none">// </span>
          <span className="text-foreground font-mono text-[11px] font-bold tracking-widest select-none">MTCODE</span>
        </div>

        {MENU_KEYS.map((menuKey, menuIndex) => (
          <div
            key={menuKey}
            className="relative"
            onMouseEnter={() => { if (openMenu) onMenuOpen(menuKey); }}
          >
            <button
              ref={(el) => { menuButtonRefs.current[menuKey] = el; }}
              className={cn(
                "menu-bar-btn h-[26px] border-0 bg-transparent text-muted-foreground font-mono text-[11px] tracking-wider px-2.5 hover:bg-accent/10 hover:text-foreground transition-colors",
                openMenu === menuKey && "bg-accent/15 text-foreground",
                focusedMenuIndex === menuIndex && openMenu !== menuKey && "bg-accent/10 text-foreground",
              )}
              role="menuitem"
              type="button"
              aria-haspopup="menu"
              aria-expanded={openMenu === menuKey}
              onFocus={() => onFocusMenuIndex(menuIndex)}
              onClick={() => { if (openMenu === menuKey) onMenuClose(); else onMenuOpen(menuKey); }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onMenuOpen(menuKey);
                }
              }}
            >
              {MENU_TITLES[menuKey]}
            </button>

            {openMenu === menuKey ? (
              <div
                className="menu-dropdown-anim absolute top-[calc(100%+5px)] left-0 min-w-[244px] bg-card border border-border shadow-xl z-20 p-1.5"
                role="menu"
                aria-label={`${MENU_TITLES[menuKey]} menu`}
              >
                {menuActions[menuKey].map((action, index) => (
                  <div key={`${menuKey}-${action.label}-${index}`}>
                    {action.separatorBefore ? (
                      <div className="h-px bg-border my-1.5 mx-1" />
                    ) : null}
                    <button
                      className={cn(
                        "menu-dropdown-item w-full min-h-[30px] border-0 bg-transparent text-muted-foreground flex items-center justify-start gap-3 px-2.5 text-left text-xs hover:bg-accent/15 hover:text-foreground disabled:cursor-default transition-colors",
                        focusedMenuActionIndex === index && "bg-accent/15 text-foreground",
                      )}
                      role="menuitem"
                      ref={(el) => { menuActionRefs.current[index] = el; }}
                      onMouseEnter={() => onFocusActionIndex(index)}
                      onFocus={() => onFocusActionIndex(index)}
                      disabled={action.disabled}
                      onClick={() => onRunAction(action.onSelect)}
                    >
                      <span>{action.label}</span>
                      {action.shortcut && (
                        <span className="ml-auto pl-4">
                          <KbdBinding binding={action.shortcut} />
                        </span>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {/* Drag region */}
      {isDesktop ? (
        <div
          className="flex-1 h-full min-w-10"
          data-tauri-drag-region
          onDoubleClick={() => void toggleMaximizeWindow()}
        />
      ) : (
        <div className="flex-1 h-full min-w-10" />
      )}

      {/* Window controls */}
      {isDesktop ? (
        <div className="inline-flex items-center gap-0" aria-label="Window controls">
          <button
            className="h-[22px] px-2 border border-border bg-transparent text-muted-foreground font-mono text-[11px] hover:text-foreground hover:bg-accent/10 transition-colors leading-none"
            aria-label="Minimize"
            onClick={() => void minimizeWindow()}
          >
            _
          </button>
          <button
            className="h-[22px] px-2 border border-border border-l-0 bg-transparent text-muted-foreground font-mono text-[11px] hover:text-foreground hover:bg-accent/10 transition-colors leading-none"
            aria-label={isMaximized ? "Restore" : "Maximize"}
            onClick={() => void toggleMaximizeWindow()}
          >
            {isMaximized ? "◱" : "□"}
          </button>
          <button
            className="h-[22px] px-2 border border-border border-l-0 bg-transparent text-muted-foreground font-mono text-[11px] hover:text-destructive-foreground hover:border-destructive/50 hover:bg-destructive/20 transition-colors leading-none"
            aria-label="Close"
            onClick={() => void closeWindow()}
          >
            ×
          </button>
        </div>
      ) : null}
    </header>
  );
}
