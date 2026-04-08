import type { MouseEvent as ReactMouseEvent, KeyboardEvent as ReactKeyboardEvent, ChangeEvent } from "react";
import { useRef, useEffect, useState } from "react";
import { cn } from "../lib/utils";
import type { TreeNode } from "../types";
import {
  FileIcon,
  FolderIcon,
  FolderOpenIcon,
  NewFileIcon,
} from "./PixelIcons";

type Props = {
  headerName: string;
  treeNodes: TreeNode[];
  busyPath: string;
  sidebarWidth: number;
  onNewFile: () => void;
  onCreateFolder: () => void;
  onToggleFolder: (path: string) => Promise<void>;
  onFileClick: (path: string) => Promise<void>;
  onToggleCollapse: () => void;
  onStartResize: (event: ReactMouseEvent<HTMLDivElement>) => void;
  selectedTreePath: string | null;
  creatingFolderIn: string | null;
  onConfirmCreateFolder: (name: string) => void;
  onCancelCreateFolder: () => void;
  projectRoot: string | null;
};

function TreeNodeItem({
  node,
  busyPath,
  prefix,
  isLast,
  isSelected,
  onToggleFolder,
  onFileClick,
}: {
  node: TreeNode;
  busyPath: string;
  prefix: string;
  isLast: boolean;
  isSelected: boolean;
  onToggleFolder: (path: string) => Promise<void>;
  onFileClick: (path: string) => Promise<void>;
}) {
  const isBusy = busyPath === node.path;
  const connector = isLast ? "└── " : "├── ";
  const childPrefix = prefix + (isLast ? "    " : "│   ");

  return (
    <div>
      <button
        className={cn(
          "w-full h-[22px] border-0 bg-transparent text-left text-[11px] font-mono",
          "text-muted-foreground hover:bg-accent/15 hover:text-foreground transition-colors",
          "flex items-center gap-1 px-1 whitespace-nowrap overflow-hidden",
          isSelected && "bg-accent/20 text-foreground",
        )}
        onClick={() => {
          if (node.isDir) void onToggleFolder(node.path);
          else void onFileClick(node.path);
        }}
        title={node.path}
      >
        <span className="opacity-25 shrink-0 select-none">{prefix}</span>
        <span className="opacity-40 shrink-0 select-none">{connector}</span>
        <span className="shrink-0 inline-flex items-center justify-center opacity-70">
          {node.isDir
            ? node.expanded
              ? <FolderOpenIcon size={11} />
              : <FolderIcon size={11} />
            : <FileIcon size={10} />
          }
        </span>
        <span className="overflow-hidden text-ellipsis ml-0.5">{node.name}</span>
        {isBusy ? <span className="ml-1 opacity-40 select-none shrink-0">…</span> : null}
      </button>

      {node.isDir && node.expanded ? (
        <div>
          {node.children.map((child, i) => (
            <TreeNodeItem
              key={child.path}
              node={child}
              busyPath={busyPath}
              prefix={childPrefix}
              isLast={i === node.children.length - 1}
              isSelected={false}
              onToggleFolder={onToggleFolder}
              onFileClick={onFileClick}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Inline folder-name input (VS Code style) */
function InlineCreateFolder({
  prefix,
  isLast,
  onSubmit,
  onCancel,
}: {
  prefix: string;
  isLast: boolean;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("NewFolder");
  const inputRef = useRef<HTMLInputElement>(null);
  const submittedRef = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();

    // Click outside → cancel
    const handleClickOutside = (e: MouseEvent) => {
      if (submittedRef.current) return;
      if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
        submittedRef.current = true;
        onCancel();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onCancel]);

  const connector = isLast ? "└── " : "├── ";

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submittedRef.current = true;
      onSubmit(value);
    } else if (e.key === "Escape") {
      e.preventDefault();
      submittedRef.current = true;
      onCancel();
    }
  };

  return (
    <div className="flex items-center h-[22px] px-1">
      <span className="opacity-25 shrink-0 select-none text-[11px] font-mono text-muted-foreground">{prefix}</span>
      <span className="opacity-40 shrink-0 select-none text-[11px] font-mono text-muted-foreground">{connector}</span>
      <span className="shrink-0 inline-flex items-center justify-center opacity-70">
        <FolderIcon size={11} />
      </span>
      <input
        ref={inputRef}
        className="flex-1 min-w-0 h-[18px] border border-primary bg-background text-foreground text-[11px] font-mono px-1 outline-none ml-0.5"
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        spellCheck={false}
      />
    </div>
  );
}

const iconBtn = cn(
  "w-[20px] h-[20px] border border-border bg-transparent text-muted-foreground",
  "inline-flex items-center justify-center hover:text-foreground transition-colors shrink-0",
);

export function FileTree({
  headerName,
  treeNodes,
  busyPath,
  sidebarWidth,
  onNewFile,
  onCreateFolder,
  onToggleFolder,
  onFileClick,
  onToggleCollapse,
  onStartResize,
  selectedTreePath,
  creatingFolderIn,
  onConfirmCreateFolder,
  onCancelCreateFolder,
  projectRoot,
}: Props) {
  const shortName = headerName
    ? headerName.split(/[\\/]/).pop() ?? headerName
    : "ROOT";

  /** Render tree nodes, injecting the inline create-folder input where needed */
  function renderNodes(nodes: TreeNode[], prefix: string): React.ReactNode {
    return nodes.map((node, i) => {
      const isLast = i === nodes.length - 1;
      const isSelected = selectedTreePath === node.path;
      const childPrefix = prefix + (isLast ? "    " : "│   ");
      const showInlineInput = node.isDir && node.expanded && creatingFolderIn === node.path;

      return (
        <div key={node.path}>
          <TreeNodeItem
            node={node}
            busyPath={busyPath}
            prefix={prefix}
            isLast={isLast}
            isSelected={isSelected}
            onToggleFolder={onToggleFolder}
            onFileClick={onFileClick}
          />

          {node.isDir && node.expanded ? (
            <div key={`${node.path}-children`}>
              {showInlineInput ? (
                <InlineCreateFolder
                  key={`${node.path}-inline-input`}
                  prefix={childPrefix}
                  isLast={node.children.length === 0}
                  onSubmit={onConfirmCreateFolder}
                  onCancel={onCancelCreateFolder}
                />
              ) : null}
              {renderNodes(node.children, childPrefix)}
            </div>
          ) : null}
        </div>
      );
    });
  }

  /** Render inline create-folder input at root level (when target is projectRoot) */
  function renderRootInlineInput(): React.ReactNode {
    if (!projectRoot || creatingFolderIn !== projectRoot) return null;
    return (
      <InlineCreateFolder
        prefix=""
        isLast={treeNodes.length === 0}
        onSubmit={onConfirmCreateFolder}
        onCancel={onCancelCreateFolder}
      />
    );
  }

  return (
    <>
      <aside
        className="flex-none bg-card flex flex-col gap-2 p-2 min-h-0 overflow-hidden"
        style={{ width: `${sidebarWidth}px` }}
      >
        {/* Header */}
        <div data-nc-header="" className="flex items-center justify-between gap-1 min-w-0 shrink-0">
          <span
            className="text-[10px] font-mono font-bold tracking-widest text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap min-w-0 select-none"
            title={headerName}
          >
            // {shortName.toUpperCase()}
          </span>
          <div className="flex items-center gap-1 ml-auto shrink-0">
            <button className={iconBtn} title="New file" aria-label="New file" onClick={onNewFile}>
              <NewFileIcon size={11} />
            </button>
            <button className={iconBtn} title="New folder" aria-label="New folder" onClick={onCreateFolder}>
              <svg width="11" height="11" viewBox="0 0 12 10" fill="none" shapeRendering="crispEdges">
                <rect x="0" y="3" width="12" height="7" stroke="currentColor" strokeWidth="1" fill="none" />
                <polyline points="0,3 0,1 4,1 5,3" stroke="currentColor" strokeWidth="1" fill="none" />
                <line x1="5" y1="5" x2="5" y2="9" stroke="currentColor" strokeWidth="1.5" />
                <line x1="3" y1="7" x2="7" y2="7" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
            {/* Collapse button */}
            <button
              className={iconBtn}
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
              onClick={onToggleCollapse}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" shapeRendering="crispEdges">
                <polyline points="7,1 3,5 7,9" stroke="currentColor" strokeWidth="1.5" fill="none" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tree panel — dot-grid, no outer border */}
        <div className="themed-scrollbar tree-dotgrid flex-1 min-h-0 overflow-auto py-[3px]">
          {treeNodes.length || creatingFolderIn === projectRoot ? (
            <>
              {renderRootInlineInput()}
              {renderNodes(treeNodes, "")}
            </>
          ) : (
            <div className="text-[10px] font-mono text-muted-foreground/60 p-2 leading-[1.6]">
              {"> open folder to initialize tree_"}
            </div>
          )}
        </div>

        {/* Notifications moved to toast — no static blocks here */}
      </aside>

      {/* Resize handle — sidebar-bg matches so no dark gap; border-r is the visible 1px separator */}
      <div
        className="w-[4px] cursor-col-resize sidebar-resize-handle border-r border-border hover:bg-accent/20 transition-colors shrink-0"
        role="separator"
        aria-orientation="vertical"
        onMouseDown={onStartResize}
      />
    </>
  );
}
