/**
 * AI Assistant — animated sprite helper (Clippy-style) with chat panel.
 * - Draggable via mouse/touch
 * - Theme-aware recoloring via CSS filters
 * - GSAP-powered sprite animation
 * - Click sprite to open/close chat panel
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { gsap } from "gsap";
import { useTheme } from "../context/ThemeContext";
import {
  AICharacterId,
  AnimationState,
  AI_CHARACTERS,
  THEME_STYLES,
  getThemeFamily,
} from "../lib/aiCharacters";
import type { ChatMessage } from "../services/ollama";

type Props = {
  characterId: AICharacterId;
  visible: boolean;
  onToggle: () => void;
  /** True while Ollama is processing — triggers "think" animation */
  analyzing?: boolean;
  chatMessages?: ChatMessage[];
  chatAnalyzing?: boolean;
  onSendMessage?: (text: string) => void;
  onClearChat?: () => void;
};

// ── TypingDots ────────────────────────────────────────────────────────────────
function TypingDots() {
  const [dots, setDots] = useState(".");
  useEffect(() => {
    const t = setInterval(() => setDots((d) => (d.length >= 3 ? "." : d + ".")), 400);
    return () => clearInterval(t);
  }, []);
  return <span>Thinking{dots}</span>;
}

// ── ChatPanel ─────────────────────────────────────────────────────────────────
function ChatPanel({
  messages,
  analyzing,
  onSend,
  onClose,
  onClear,
  frameWidth,
  frameHeight,
  positionX,
}: {
  messages: ChatMessage[];
  analyzing: boolean;
  onSend: (text: string) => void;
  onClose: () => void;
  onClear?: () => void;
  frameWidth: number;
  frameHeight: number;
  positionX: number;
}) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const PANEL_W = 300;
  const openRight = positionX < PANEL_W + 20;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, analyzing]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || analyzing) return;
    onSend(text);
    setInput("");
  };

  return (
    <div
      style={{
        position: "absolute",
        bottom: frameHeight + 10,
        ...(openRight ? { left: frameWidth + 8 } : { right: 0 }),
        width: PANEL_W,
        height: 320,
        zIndex: 1,
        display: "flex",
        flexDirection: "column",
      }}
      className="bg-background border border-border shadow-lg font-mono"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-2 h-7 border-b border-border bg-muted/30 shrink-0">
        <span className="text-[10px] text-muted-foreground tracking-widest select-none">// AI ASSISTANT</span>
        <div className="flex gap-1">
          {onClear && messages.length > 0 && (
            <button
              className="text-[10px] text-muted-foreground hover:text-foreground px-1"
              onClick={onClear}
              title="Clear chat"
            >
              CLR
            </button>
          )}
          <button
            className="text-[10px] text-muted-foreground hover:text-foreground px-1"
            onClick={onClose}
          >
            ×
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-2 py-1 flex flex-col gap-2">
        {messages.length === 0 && !analyzing && (
          <div className="text-[10px] text-muted-foreground/50 mt-2 select-none">
            {"// Ask anything about the current file"}
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={msg.role === "user" ? "text-right" : "text-left"}>
            <span
              className={`inline-block text-[11px] leading-relaxed px-2 py-1 rounded-sm max-w-[90%] text-left ${
                msg.role === "user"
                  ? "bg-accent/20 text-foreground"
                  : "bg-muted/30 text-foreground/90"
              }`}
            >
              {msg.content}
            </span>
          </div>
        ))}
        {analyzing && (
          <div className="text-left">
            <span className="inline-block text-[11px] px-2 py-1 bg-muted/30 text-muted-foreground">
              <TypingDots />
            </span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex border-t border-border shrink-0">
        <input
          className="flex-1 bg-transparent text-[11px] text-foreground px-2 py-1 outline-none placeholder:text-muted-foreground/40"
          placeholder="Ask about this code…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          disabled={analyzing}
          autoFocus
        />
        <button
          className="px-2 text-[10px] text-muted-foreground hover:text-foreground border-l border-border disabled:opacity-40"
          onClick={handleSend}
          disabled={!input.trim() || analyzing}
        >
          ▶
        </button>
      </div>
    </div>
  );
}

// ── AIAssistant ───────────────────────────────────────────────────────────────
export function AIAssistant({
  characterId,
  visible,
  onToggle,
  analyzing = false,
  chatMessages = [],
  chatAnalyzing = false,
  onSendMessage,
  onClearChat,
}: Props) {
  const { themeId } = useTheme();
  const themeFamily = getThemeFamily(themeId);
  const style = THEME_STYLES[themeFamily] ?? THEME_STYLES.mtcode;
  const charDef = AI_CHARACTERS[characterId];

  // Position state — drives CSS left/top only (no GSAP x/y used for position)
  const [position, setPosition] = useState(() => ({
    x: window.innerWidth  - charDef.frameWidth  - 30,
    y: window.innerHeight - charDef.frameHeight - 30,
  }));
  const isDragging = useRef(false);
  const hasMoved = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const spriteRef = useRef<HTMLDivElement>(null);

  // Controls whether the component stays in the DOM during exit animation
  const [displayed, setDisplayed] = useState(false);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animation state
  const [currentFrame, setCurrentFrame] = useState(0);
  const animTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Chat panel open state
  const [chatOpen, setChatOpen] = useState(false);

  // ── Animation engine ──────────────────────────────────────────────────────
  const playAnimation = useCallback(
    (state: AnimationState) => {
      if (animTimer.current) clearTimeout(animTimer.current);

      const animDef = charDef.animations[state];
      if (!animDef) return;

      if (animDef.frames.length <= 1) {
        setCurrentFrame(animDef.frames[0] ?? 0);
        return;
      }

      let frameIdx = 0;
      const tick = () => {
        frameIdx = (frameIdx + 1) % animDef.frames.length;
        setCurrentFrame(animDef.frames[frameIdx]);
        if (animDef.loop) {
          animTimer.current = setTimeout(tick, animDef.speed);
        }
      };

      tick();

      if (!animDef.loop) {
        const totalDuration = animDef.frames.length * animDef.speed;
        animTimer.current = setTimeout(() => {
          playAnimation("idle");
        }, totalDuration);
      }
    },
    [charDef],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animTimer.current) clearTimeout(animTimer.current);
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    };
  }, []);

  // ── React to AI analysis state ────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    if (analyzing || chatAnalyzing) {
      playAnimation("think");
    } else if (chatMessages.length > 0) {
      playAnimation("wave");
    } else {
      playAnimation("idle");
    }
  }, [analyzing, chatAnalyzing, chatMessages, visible, playAnimation]);

  // ── Auto-open chat when analyzing starts or new assistant message arrives ─
  useEffect(() => {
    if (chatAnalyzing) {
      setChatOpen(true);
    }
  }, [chatAnalyzing]);

  useEffect(() => {
    const lastMsg = chatMessages[chatMessages.length - 1];
    if (lastMsg?.role === "assistant") {
      setChatOpen(true);
    }
  }, [chatMessages]);

  // ── Random idle animations (paused while analyzing or showing messages) ───
  useEffect(() => {
    if (!visible || analyzing || chatAnalyzing || chatMessages.length > 0) return;

    const randomIdle = () => {
      const roll = Math.random();
      if (roll < 0.3) playAnimation("blink");
      else if (roll < 0.5) playAnimation("think");
      else if (roll < 0.6) playAnimation("wave");
    };

    const interval = setInterval(randomIdle, 4000 + Math.random() * 3000);
    return () => clearInterval(interval);
  }, [visible, analyzing, chatAnalyzing, chatMessages, playAnimation]);

  // ── Dragging logic ─────────────────────────────────────────────────────────
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest(".ai-btn")) return;
    isDragging.current = true;
    hasMoved.current = false;
    const rect = containerRef.current!.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging.current) return;
      const dx = e.clientX - dragOffset.current.x - (containerRef.current?.getBoundingClientRect().left ?? 0);
      const dy = e.clientY - dragOffset.current.y - (containerRef.current?.getBoundingClientRect().top ?? 0);
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) hasMoved.current = true;
      const newX = Math.max(0, Math.min(window.innerWidth  - charDef.frameWidth  - 20, e.clientX - dragOffset.current.x));
      const newY = Math.max(0, Math.min(window.innerHeight - charDef.frameHeight - 20, e.clientY - dragOffset.current.y));
      setPosition({ x: newX, y: newY });
    },
    [charDef.frameWidth, charDef.frameHeight],
  );

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  const handleSpriteClick = useCallback(() => {
    if (hasMoved.current) return;
    setChatOpen((v) => !v);
  }, []);

  // ── Keyboard shortcut ─────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "A") {
        e.preventDefault();
        onToggle();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onToggle]);

  // ── Entry/exit animation — keeps component in DOM during exit ─────────────
  useEffect(() => {
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current);

    if (visible) {
      setDisplayed(true);
      // Wait one tick for the DOM node to be present after setDisplayed(true)
      requestAnimationFrame(() => {
        if (!containerRef.current) return;
        // Reset any GSAP transform state before animating in
        gsap.set(containerRef.current, { clearProps: "transform" });
        gsap.fromTo(
          containerRef.current,
          { scale: 0, opacity: 0, y: 20 },
          { scale: 1, opacity: 1, y: 0, duration: 0.5, ease: "back.out(1.7)" },
        );
      });
    } else {
      if (!containerRef.current) {
        setDisplayed(false);
        return;
      }
      gsap.to(containerRef.current, {
        scale: 0,
        opacity: 0,
        y: 20,
        duration: 0.3,
        ease: "power2.in",
        onComplete: () => setDisplayed(false),
      });
    }
  }, [visible]);

  // ── Compute sprite background position ────────────────────────────────────
  // sheetColumns = real number of frames per row in the spritesheet file
  const sheetColumns = charDef.sheetColumns;
  const col = currentFrame % sheetColumns;
  const row = Math.floor(currentFrame / sheetColumns);
  const bgX = -(col * charDef.frameWidth);
  const bgY = -(row * charDef.frameHeight);
  // backgroundSize scales the sheet so one frame occupies exactly frameWidth × frameHeight
  const bgW = charDef.frameWidth * sheetColumns;

  if (!displayed) return null;

  return (
    <div
      ref={containerRef}
      className="fixed z-[9999] select-none ai-assistant"
      style={{
        left: position.x,
        top: position.y,
        pointerEvents: "auto",
        touchAction: "none",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {/* Chat panel */}
      {chatOpen && (
        <ChatPanel
          messages={chatMessages}
          analyzing={chatAnalyzing}
          onSend={onSendMessage ?? (() => {})}
          onClose={() => setChatOpen(false)}
          onClear={onClearChat}
          frameWidth={charDef.frameWidth}
          frameHeight={charDef.frameHeight}
          positionX={position.x}
        />
      )}

      {/* Sprite container — sized to exactly one frame */}
      <div
        ref={spriteRef}
        className="ai-sprite cursor-grab active:cursor-grabbing"
        style={{
          width: charDef.frameWidth,
          height: charDef.frameHeight,
          backgroundImage: `url(/assets/ai-assistant/${characterId}-spritesheet.png)`,
          backgroundSize: `${bgW}px auto`,
          backgroundPosition: `${bgX}px ${bgY}px`,
          backgroundRepeat: "no-repeat",
          imageRendering: "pixelated",
          filter: style.filter,
        }}
        onClick={handleSpriteClick}
      />

      {/* Close button */}
      <button
        className="ai-btn absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center border border-destructive/50 hover:scale-110 transition-transform z-10"
        onClick={onToggle}
        title="Hide assistant"
      >
        ×
      </button>
    </div>
  );
}
