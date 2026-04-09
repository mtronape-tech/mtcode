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
import {
  AICharacterId,
  AnimationState,
  AI_CHARACTERS,
  THEME_STYLES,
  getThemeFamily,
} from "../lib/aiCharacters";

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

  // Position state
  const [position, setPosition] = useState(() => ({
    x: window.innerWidth - 100,
    y: window.innerHeight - 120,
  }));
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const spriteRef = useRef<HTMLDivElement>(null);

  // Animation state
  const [currentFrame, setCurrentFrame] = useState(0);
  const animTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    const newX = Math.max(0, Math.min(window.innerWidth - 80, e.clientX - dragOffset.current.x));
    const newY = Math.max(0, Math.min(window.innerHeight - 100, e.clientY - dragOffset.current.y));
    gsap.to(containerRef.current!, { x: newX, y: newY, duration: 0 });
    setPosition({ x: newX, y: newY });
  }, []);

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
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
        scale: 0, opacity: 0, y: 50, duration: 0.3, ease: "power2.in",
      });
    }
  }, [visible]);

  // ── Compute sprite background position ────────────────────────────────────
  const framesPerRow = 8;
  const col = currentFrame % framesPerRow;
  const row = Math.floor(currentFrame / framesPerRow);
  const bgX = -(col * charDef.frameWidth);
  const bgY = -(row * charDef.frameHeight);

  if (!visible) return null;

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
      {/* Sprite container */}
      <div
        ref={spriteRef}
        className="ai-sprite w-[70px] h-[96px] cursor-grab active:cursor-grabbing"
        style={{
          backgroundImage: `url(/assets/ai-assistant/${characterId}-spritesheet.png)`,
          backgroundSize: `${charDef.frameWidth * framesPerRow}px auto`,
          backgroundPosition: `${bgX}px ${bgY}px`,
          backgroundRepeat: "no-repeat",
          imageRendering: "pixelated",
          filter: style.filter,
        }}
      />

      {/* Close button */}
      <button
        className="ai-btn absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center border border-destructive/50 hover:scale-110 transition-transform z-10"
        onClick={onToggle}
        title="Скрыть помощника"
      >
        ×
      </button>
    </div>
  );
}
