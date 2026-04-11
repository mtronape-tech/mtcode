/**
 * OllamaSetupDialog — shown on first run when Ollama is not installed.
 * Downloads OllamaSetup.exe, installs silently, pulls the model.
 */

import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { listen } from "@tauri-apps/api/event";

type Stage = "idle" | "downloading" | "installing" | "pulling" | "done" | "error";

interface SetupEvent {
  stage: Stage;
  message: string;
  percent: number;
}

type Props = {
  model: string;
  onDone: () => void;
  onSkip: () => void;
};

export function OllamaSetupDialog({ model, onDone, onSkip }: Props) {
  const [stage, setStage]     = useState<Stage>("idle");
  const [message, setMessage] = useState("");
  const [percent, setPercent] = useState(0);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    const unlisten = listen<SetupEvent>("ollama-setup-progress", ({ payload }) => {
      setStage(payload.stage as Stage);
      setMessage(payload.message);
      setPercent(payload.percent);
      if (payload.stage === "done") setTimeout(onDone, 1200);
    });
    return () => { void unlisten.then((fn) => fn()); };
  }, [onDone]);

  const handleInstall = async () => {
    setError(null);
    setStage("downloading");
    setMessage("Starting…");
    setPercent(0);
    try {
      await invoke("ollama_install", { model });
    } catch (err: unknown) {
      setError(String(err));
      setStage("error");
    }
  };

  const running = stage !== "idle" && stage !== "done" && stage !== "error";

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60">
      <div
        className="bg-card border-2 border-border flex flex-col font-mono"
        style={{ width: 480, boxShadow: "6px 6px 0 hsl(var(--border))" }}
      >
        {/* Title bar */}
        <div className="flex items-center justify-between px-4 h-9 border-b border-border bg-background select-none">
          <span className="text-[11px] font-bold tracking-widest text-foreground">
            // AI SETUP REQUIRED
          </span>
          {!running && (
            <button
              className="text-muted-foreground hover:text-foreground text-[13px] leading-none"
              onClick={onSkip}
            >
              ×
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex flex-col gap-4 p-5">
          <p className="text-[11px] text-foreground/80 leading-relaxed">
            MTCode uses <span className="text-foreground font-bold">Ollama</span> to run AI code analysis locally.
            It will be installed automatically — no internet access required after setup.
          </p>

          <div className="text-[10px] text-muted-foreground leading-relaxed">
            <div>{">"} All files are included in the app — no internet required</div>
            <div>{">"} Model: <span className="text-foreground">{model}</span></div>
            <div>{">"} Installs to %LOCALAPPDATA%\Programs\Ollama — no admin rights needed</div>
          </div>

          {/* Progress */}
          {(running || stage === "done") && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground">{message}</span>
                <span className="text-foreground">{percent}%</span>
              </div>
              <div className="h-[4px] bg-muted border border-border">
                <div
                  className="h-full bg-foreground transition-all duration-300"
                  style={{ width: `${percent}%` }}
                />
              </div>
              {stage === "done" && (
                <div className="text-[11px] text-green-500 tracking-wide">
                  AI is ready. Restarting…
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="text-[10px] text-destructive leading-relaxed border border-destructive/30 px-3 py-2">
              {error}
            </div>
          )}

          {/* Actions */}
          {!running && stage !== "done" && (
            <div className="flex gap-3 justify-end pt-1">
              <button
                className="font-mono text-[11px] px-4 h-[26px] border border-border text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-colors select-none"
                onClick={onSkip}
              >
                SKIP
              </button>
              <button
                className="font-mono text-[11px] px-4 h-[26px] border border-foreground bg-foreground text-background hover:opacity-90 transition-opacity select-none"
                onClick={() => void handleInstall()}
              >
                {stage === "error" ? "RETRY" : "INSTALL AI"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
