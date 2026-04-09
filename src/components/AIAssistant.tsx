/**
 * AI Assistant — animated sprite helper (Clippy-style).
 * - Draggable via mouse/touch
 * - Theme-aware recoloring via CSS filters
 * - GSAP-powered sprite animation
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { gsap } from "gsap";
import { cn } from "../lib/utils";
import { useTheme } from "../context/ThemeContext";
import { THEMES } from "../lib/theme";
import {
  AICharacterId,
  AnimationState,
  AI_CHARACTERS,
  THEME_STYLES,
  getThemeFamily,
} from "../lib/aiCharacters";

// Default position (bottom-right corner)
const DEFAULT_X = 20;
const DEFAULT_Y = 20;

type Props = {
  characterId: AICharacterId;
  visible: boolean;
  onToggle: () => void;
};

export function AIAssistant({ characterId, visible, onToggle }: Props) {
  const { themeId } = useTheme();
  const themeFamily = getThemeFamily(themeId);
  const style = THEME_STYLES[themeFamily] ?? THEME_STYLES.mtcode;
  const charDef = AI_CHARACTERS[characterId];

  // Dragging state
  const [position, setPosition] = useState({ x: DEFAULT_X, y: DEFAULT_Y });
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Animation state
  const [currentAnim, setCurrentAnim] = useState<AnimationState>("idle");
  const [currentFrame, setCurrentFrame] = useState(0);
  const animTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sprite container ref
  const spriteRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Sprite animation engine ───────────────────────────────────────────────
  const playAnimation = useCallback(
    (state: AnimationState) => {
      if (animTimer.current) clearTimeout(animTimer.current);

      const animDef = charDef.animations[state];
      if (!animDef) return;

      setCurrentAnim(state);

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

      // Start loop
      tick();

      // Non-looping animations reset to idle after one cycle
      if (!animDef.loop) {
        const totalDuration = animDef.frames.length * animDef.speed;
        animTimer.current = setTimeout(() => {
          playAnimation("idle");
        }, totalDuration);
      }
    },
    [charDef],
  );

  // Cleanup animation timer on unmount
  useEffect(() => {
    return () => {
      if (animTimer.current) clearTimeout(animTimer.current);
    };
  }, []);

  // ── Random idle animations ─────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;

    const randomIdle = () => {
      const roll = Math.random();
      if (roll < 0.3) playAnimation("blink");
      else if (roll < 0.5) playAnimation("think");
      else if (roll < 0.6) playAnimation("wave");
    };

    const interval = setInterval(randomIdle, 4000 + Math.random() * 3000);
    return () => clearInterval(interval);
  }, [visible, playAnimation]);

  // ── Dragging logic ─────────────────────────────────────────────────────────
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest(".ai-btn")) return;
    isDragging.current = true;
    const rect = containerRef.current!.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    const newX = Math.max(0, Math.min(window.innerWidth - 120, e.clientX - dragOffset.current.x));
    const newY = Math.max(0, Math.min(window.innerHeight - 100, e.clientY - dragOffset.current.y));
    // Use GSAP for smooth drag movement
    gsap.to(containerRef.current!, {
      x: newX,
      y: newY,
      duration: 0,
      ease: "none",
    });
    setPosition({ x: newX, y: newY });
  }, []);

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  // ── Keyboard shortcut (Ctrl+Shift+A to toggle) ────────────────────────────
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

  // ── Entry/exit animation ──────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    if (visible) {
      gsap.fromTo(
        containerRef.current,
        { scale: 0, opacity: 0, y: 50 },
        { scale: 1, opacity: 1, y: 0, duration: 0.5, ease: "back.out(1.7)" },
      );
    } else {
      gsap.to(containerRef.current, {
        scale: 0,
        opacity: 0,
        y: 50,
        duration: 0.3,
        ease: "power2.in",
      });
    }
  }, [visible]);

  // ── Compute sprite background position ────────────────────────────────────
  const col = currentFrame % 6; // 6 frames per row (adjust as needed)
  const row = Math.floor(currentFrame / 6);
  const bgX = -(col * charDef.frameWidth);
  const bgY = -(row * charDef.frameHeight);

  if (!visible) return null;

  return (
    <div
      ref={containerRef}
      className="fixed z-[9999] select-none ai-assistant"
      style={{
        pointerEvents: "auto",
        touchAction: "none",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {/* Speech bubble (shows on hover or alert) */}
      <div
        className={cn(
          "ai-bubble absolute bottom-full right-0 mb-2 px-3 py-2 rounded-lg border border-border shadow-lg",
          "bg-card text-foreground font-mono text-[10px] max-w-[180px] leading-relaxed",
          "opacity-0 hover:opacity-100 transition-opacity pointer-events-none",
        )}
        style={{ filter: style.filter }}
      >
        <div className="text-muted-foreground mb-0.5">// AI Assistant</div>
        <div>Нужна помощь? Нажмите для деталей.</div>
        {/* Bubble tail */}
        <div
          className="absolute top-full right-6 w-0 h-0"
          style={{
            borderLeft: "6px solid transparent",
            borderRight: "6px solid transparent",
            borderTop: "6px solid hsl(var(--card))",
          }}
        />
      </div>

      {/* Sprite container */}
      <div
        ref={spriteRef}
        className="ai-sprite w-[70px] h-[96px] rounded-lg overflow-hidden cursor-grab active:cursor-grabbing shadow-xl border border-border bg-card"
        style={{
          backgroundImage: `url(/assets/ai-assistant/${characterId}-spritesheet.png)`,
          backgroundSize: `${charDef.frameWidth * 6}px auto`,
          backgroundPosition: `${bgX}px ${bgY}px`,
          imageRendering: "pixelated",
          filter: style.filter,
        }}
      />

      {/* Close button */}
      <button
        className="ai-btn absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center border border-destructive/50 hover:scale-110 transition-transform"
        onClick={onToggle}
        title="Скрыть помощника"
      >
        ×
      </button>
    </div>
  );
}
