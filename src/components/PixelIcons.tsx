/**
 * Pixel-art SVG icons that are NOT available in pixelarticons package.
 * All other icons use pixelarticons.
 */

type IconProps = {
  size?: number;
  className?: string;
};

/** Folder open icon — not available in pixelarticons */
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

/** New file icon — document with plus (not available in pixelarticons) */
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
