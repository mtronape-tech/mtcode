import type { MouseEvent as ReactMouseEvent } from "react";
import { cn } from "../lib/utils";
import type { TreeNode } from "../types";
import {
  FileIcon,
  FolderIcon,
  FolderOpenIcon,
  NewFileIcon,
  OpenFolderIcon,
  SearchIcon,
} from "./PixelIcons";

type Props = {
  headerName: string;
  treeNodes: TreeNode[];
  busyPath: string;
  errorText: string;
  infoText: string;
  sidebarWidth: number;
  onOpenFile: () => void;
  onOpenFolder: () => void;
  onOpenProjectSearch: () => void;
  onToggleFolder: (path: string) => Promise<void>;
  onFileClick: (path: string) => Promise<void>;
  onToggleCollapse: () => void;
  onStartResize: (event: ReactMouseEvent<HTMLDivElement>) => void;
};

function TreeNodeItem({
  node,
  busyPath,
  prefix,
  isLast,
  onToggleFolder,
  onFileClick,
}: {
  node: TreeNode;
  busyPath: string;
  prefix: string;
  isLast: boolean;
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
              onToggleFolder={onToggleFolder}
              onFileClick={onFileClick}
            />
          ))}
        </div>
      ) : null}
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
  errorText,
  infoText,
  sidebarWidth,
  onOpenFile,
  onOpenFolder,
  onOpenProjectSearch,
  onToggleFolder,
  onFileClick,
  onToggleCollapse,
  onStartResize,
}: Props) {
  const shortName = headerName
    ? headerName.split(/[\\/]/).pop() ?? headerName
    : "ROOT";

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
            <button className={iconBtn} title="Open file" aria-label="Open file" onClick={onOpenFile}>
              <NewFileIcon size={11} />
            </button>
            <button className={iconBtn} title="Open folder" aria-label="Open folder" onClick={onOpenFolder}>
              <OpenFolderIcon size={11} />
            </button>
            <button className={iconBtn} title="Search in project" aria-label="Search in project" onClick={onOpenProjectSearch}>
              <SearchIcon size={11} />
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
          {treeNodes.length ? (
            treeNodes.map((node, i) => (
              <TreeNodeItem
                key={node.path}
                node={node}
                busyPath={busyPath}
                prefix=""
                isLast={i === treeNodes.length - 1}
                onToggleFolder={onToggleFolder}
                onFileClick={onFileClick}
              />
            ))
          ) : (
            <div className="text-[10px] font-mono text-muted-foreground/60 p-2 leading-[1.6]">
              {"> open folder to initialize tree_"}
            </div>
          )}
        </div>

        {/* Notifications — only rendered when needed (no layout gap when empty) */}
        {errorText ? (
          <div className="shrink-0 text-[10px] font-mono px-2 py-1 leading-[1.5] overflow-anywhere text-destructive-foreground border border-destructive/45 bg-destructive/15">
            ERR: {errorText}
          </div>
        ) : null}
        {infoText && !errorText ? (
          <div className="shrink-0 text-[10px] font-mono px-2 py-1 leading-[1.5] overflow-anywhere text-foreground border border-border bg-accent/10">
            // {infoText}
          </div>
        ) : null}
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
