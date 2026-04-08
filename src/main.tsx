import ReactDOM from "react-dom/client";
import { loader } from "@monaco-editor/react";
import { App } from "./App";
import { ThemeProvider } from "./context/ThemeContext";
import "./styles/globals.css";

const monacoBase = `${window.location.origin}/monaco/vs`;
loader.config({
  paths: { vs: monacoBase },
  "vs/nls": {
    availableLanguages: {
      "*": "ru",
    },
  },
});

const rootEl = document.getElementById("root");

function isIgnorableRuntimeError(message: string): boolean {
  const text = message.toLowerCase();
  return (
    text.includes("resizeobserver loop limit exceeded") ||
    text.includes("resizeobserver loop completed with undelivered notifications")
  );
}

function showFatalError(message: string) {
  if (!rootEl) return;
  rootEl.innerHTML = [
    '<div style="padding:16px;font-family:Consolas,monospace;color:#CEC0A2;background:#120806;height:100%;box-sizing:border-box">',
    '<h3 style="margin:0 0 12px 0">MTCode UI Error</h3>',
    '<pre style="white-space:pre-wrap;overflow:auto;background:#1A0D08;border:1px solid #3C1D10;padding:10px;border-radius:2px">',
    message.replace(/</g, "&lt;"),
    "</pre>",
    '<p style="margin-top:10px;color:#8A7060">Try reinstalling runtime / launch with dev mode for details.</p>',
    "</div>",
  ].join("");
}

window.addEventListener("error", (event) => {
  const message = String(event.error ?? event.message ?? "Unknown runtime error");
  if (isIgnorableRuntimeError(message)) return;
  // DEV: log full stack to console instead of killing UI — helps diagnose removeChild origin
  if (import.meta.env.DEV) {
    console.error("[MTCode fatal]", event.error ?? event.message);
    console.error("[MTCode stack]", event.error?.stack ?? "(no stack)");
    event.preventDefault(); // prevent default browser error handling but keep UI alive
    return;
  }
  showFatalError(message);
});

window.addEventListener("unhandledrejection", (event) => {
  const reason =
    event.reason instanceof Error
      ? event.reason.stack ?? event.reason.message
      : String(event.reason);
  if (isIgnorableRuntimeError(reason || "")) return;
  showFatalError(reason || "Unhandled promise rejection");
});

try {
  if (!rootEl) throw new Error("Root element #root was not found");

  ReactDOM.createRoot(rootEl).render(
    <ThemeProvider>
      <App />
    </ThemeProvider>
  );
} catch (error) {
  const text = error instanceof Error ? error.stack ?? error.message : String(error);
  showFatalError(text || "Failed to mount React app");
}
