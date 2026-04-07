/**
 * Pixel-art SVG icons — sharp edges, no anti-aliasing, currentColor.
 * All icons use shapeRendering="crispEdges" for pixel-perfect rendering.
 */

type IconProps = {
  size?: number;
  className?: string;
};

/** Document icon with folded top-right corner */
export function FileIcon({ size = 11, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 10 12"
      fill="none"
      shapeRendering="crispEdges"
      className={className}
    >
      {/* Body outline with fold */}
      <polyline
        points="0,0 0,12 10,12 10,4 6,0 0,0"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
      />
      {/* Fold crease */}
      <polyline
        points="6,0 6,4 10,4"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
      />
      {/* Text lines */}
      <line x1="2" y1="6" x2="8" y2="6" stroke="currentColor" strokeWidth="1" />
      <line x1="2" y1="8" x2="8" y2="8" stroke="currentColor" strokeWidth="1" />
      <line x1="2" y1="10" x2="5" y2="10" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

/** Closed folder icon */
export function FolderIcon({ size = 11, className }: IconProps) {
  return (
    <svg
      width={size}
      height={Math.round(size * 0.85)}
      viewBox="0 0 12 10"
      fill="none"
      shapeRendering="crispEdges"
      className={className}
    >
      {/* Folder body */}
      <rect x="0" y="3" width="12" height="7" stroke="currentColor" strokeWidth="1" fill="none" />
      {/* Tab on top-left */}
      <polyline
        points="0,3 0,1 4,1 5,3"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
      />
    </svg>
  );
}

/** Open folder icon */
export function FolderOpenIcon({ size = 11, className }: IconProps) {
  return (
    <svg
      width={size}
      height={Math.round(size * 0.85)}
      viewBox="0 0 12 10"
      fill="none"
      shapeRendering="crispEdges"
      className={className}
    >
      {/* Folder body */}
      <rect x="0" y="3" width="12" height="7" stroke="currentColor" strokeWidth="1" fill="none" />
      {/* Tab on top-left */}
      <polyline
        points="0,3 0,1 4,1 5,3"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
      />
      {/* Open indicator — small tick marks inside */}
      <line x1="2" y1="6" x2="10" y2="6" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
    </svg>
  );
}

/** Pixel action icon: open file */
export function NewFileIcon({ size = 11, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      fill="none"
      shapeRendering="crispEdges"
      className={className}
    >
      {/* Doc outline */}
      <polyline
        points="1,0 1,12 11,12 11,4 7,0 1,0"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
      />
      <polyline points="7,0 7,4 11,4" stroke="currentColor" strokeWidth="1" fill="none" />
      {/* Plus sign */}
      <line x1="5" y1="6" x2="5" y2="10" stroke="currentColor" strokeWidth="1.5" />
      <line x1="3" y1="8" x2="7" y2="8" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

/** Pixel action icon: open folder */
export function OpenFolderIcon({ size = 11, className }: IconProps) {
  return (
    <svg
      width={size}
      height={Math.round(size * 0.85)}
      viewBox="0 0 12 10"
      fill="none"
      shapeRendering="crispEdges"
      className={className}
    >
      <rect x="0" y="3" width="12" height="7" stroke="currentColor" strokeWidth="1" fill="none" />
      <polyline points="0,3 0,1 4,1 5,3" stroke="currentColor" strokeWidth="1" fill="none" />
      {/* Arrow up = open */}
      <line x1="6" y1="5" x2="6" y2="9" stroke="currentColor" strokeWidth="1" />
      <polyline points="4,7 6,5 8,7" stroke="currentColor" strokeWidth="1" fill="none" />
    </svg>
  );
}

/** Pixel action icon: search */
export function SearchIcon({ size = 11, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      fill="none"
      shapeRendering="crispEdges"
      className={className}
    >
      {/* Circle (approximated as square for pixel art) */}
      <rect x="1" y="1" width="7" height="7" stroke="currentColor" strokeWidth="1" fill="none" />
      {/* Handle */}
      <line x1="8" y1="8" x2="11" y2="11" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
