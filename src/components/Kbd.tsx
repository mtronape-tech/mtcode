import { cn } from "../lib/utils";

/**
 * Terminal-style keyboard shortcut badge.
 * Zero border-radius, monospace, thicker bottom border for key-cap effect.
 */
export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex items-center select-none",
        "font-mono text-[10px] font-medium tracking-wide leading-none",
        "px-1.5 h-[16px]",
        "bg-background border border-border border-b-[2px]",
        "text-primary/80",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

/**
 * Renders a binding string like "Alt+↓ / F3" as one or two Kbd elements.
 * Splits on " / " to handle alternative shortcuts.
 */
export function KbdBinding({ binding, className }: { binding: string; className?: string }) {
  const parts = binding.split(" / ");
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {parts.map((part, i) => (
        <span key={i} className="inline-flex items-center gap-1">
          {i > 0 && (
            <span className="font-mono text-[9px] text-muted-foreground/40 select-none">/</span>
          )}
          <Kbd>{part}</Kbd>
        </span>
      ))}
    </span>
  );
}
