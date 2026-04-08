/**
 * About dialog — ASCII art logo + version info.
 */

const ASCII_LOGO = `
      ___  ___      ___      ___  ___________  ______    ______    ________    _______  
     /"  |/"  |    |"  \\    /"  |("     _   ")/" _  "\\  /    " \\  |"      "\\  /"     "| 
    /  ///  //      \\   \\  //   | )__/  \\\\__/(: ( \\___)// ____  \\ (.  ___  :)(: ______) 
   /'  //'  /       /\\\\  \\/.    |    \\\\_ /    \\/ \\    /  /    ) :)|: \\   ) || \\/    |   
  //  ///  /       |: \\.        |    |.  |    //  \\ _(: (____/ // (| (___\\ || // ___)_  
 /  ///  //        |.  \\    /:  |    \\:  |   (:   _) \\\\        /  |:       :)(:      "| 
|___/|___/         |___|\\__/|___|     \\__|    \\_______)\\"_____/   (________/  \\_______) 
`.slice(1);

type Props = {
  open: boolean;
  onClose: () => void;
  version?: string;
};

export function AboutDialog({ open, onClose, version = "0.1.0" }: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-background/90 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-card border-2 border-border flex flex-col"
        style={{ width: 720, maxWidth: "95vw", boxShadow: "6px 6px 0 hsl(var(--border))" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted shrink-0">
          <span className="font-mono text-[11px] font-bold tracking-widest text-foreground select-none">
            // ABOUT MTCODE
          </span>
          <button
            className="font-mono text-[11px] text-muted-foreground hover:text-foreground border border-border px-2 h-[22px] hover:bg-accent/10 transition-colors"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col p-6 gap-5 overflow-hidden">
          {/* ASCII art */}
          <div className="overflow-x-auto">
            <pre
              className="font-mono text-[8px] leading-tight text-primary select-all whitespace-pre"
              style={{ letterSpacing: "0.02em" }}
            >
              {ASCII_LOGO}
            </pre>
          </div>

          {/* Info block */}
          <div className="font-mono text-[11px] text-muted-foreground space-y-1 select-none">
            <div><span className="text-foreground">// MTCode</span> — Industrial PLC Code Editor</div>
            <div>// Version: <span className="text-primary">v{version}</span></div>
            <div>// Built with Tauri + React + Monaco Editor</div>
            <div>// Language: Mechatronika MNC PLC/CFG</div>
          </div>

          <div className="flex justify-end">
            <button
              className="font-mono text-[11px] tracking-wider text-foreground bg-accent/20 border border-border px-6 h-[26px] hover:bg-accent/30 transition-colors"
              onClick={onClose}
            >
              CLOSE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
