// AI Assistant character definitions
// Each character has multiple theme-based styles (recolors)

export type AICharacterId = "clippy";

export type AnimationState = "idle" | "wave" | "think" | "point" | "blink" | "alert";

export interface AICharacterStyle {
  /** CSS filter to apply to the sprite sheet for this theme */
  filter: string;
  /** Fallback color if sprite fails to load */
  fallbackColor: string;
}

export const AI_CHARACTERS: Record<AICharacterId, {
  name: string;
  // Default sprite dimensions (adjust to match your sprite sheet)
  frameWidth: number;
  frameHeight: number;
  // Animation frame indices in the sprite sheet
  animations: Record<AnimationState, { frames: number[]; loop: boolean; speed: number }>;
}> = {
  clippy: {
    name: "Clippy",
    frameWidth: 70,
    frameHeight: 96,
    animations: {
      idle:    { frames: [0],      loop: false, speed: 0 },
      wave:    { frames: [1, 2, 3, 2], loop: true, speed: 200 },
      think:   { frames: [4, 5],   loop: true, speed: 600 },
      point:   { frames: [6],      loop: false, speed: 0 },
      blink:   { frames: [7],      loop: false, speed: 150 },
      alert:   { frames: [8, 9],   loop: true, speed: 300 },
    },
  },
};

// Theme-based style mappings
// These use CSS filters to recolor the sprite sheet
export const THEME_STYLES: Record<string, AICharacterStyle> = {
  // MTCode / Mahogany — original silver Clippy
  "mtcode": {
    filter: "none",
    fallbackColor: "#C0C0C0",
  },
  // Norton — cyan/blue tint (NC colors)
  "norton": {
    filter: "hue-rotate(180deg) saturate(1.5) brightness(1.1)",
    fallbackColor: "#57FFFF",
  },
  // Monokai — dark with neon accents
  "monokai": {
    filter: "hue-rotate(90deg) saturate(1.8) contrast(1.2) brightness(0.9)",
    fallbackColor: "#A6E22E",
  },
  // Linen (light MTCode) — slightly warmer
  "linen": {
    filter: "sepia(0.3) saturate(0.8)",
    fallbackColor: "#A09080",
  },
};

// Helper: get theme family for AI character styling
export function getThemeFamily(themeId: string): string {
  if (themeId.startsWith("norton")) return "norton";
  if (themeId.startsWith("monokai")) return "monokai";
  if (themeId.startsWith("linen")) return "linen";
  return "mtcode";
}
