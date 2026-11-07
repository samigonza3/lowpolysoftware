import type { Aspect } from "./spec";

/**
 * Zonas seguras por formato, como fracción del alto/ancho del video.
 * 9:16 sigue la guía de Meta para Reels (dejar libre ~14 % arriba y ~35 % abajo) y deja
 * margen a la derecha para la columna de botones (me gusta, comentar, compartir) de Reels/TikTok/Shorts.
 */
export interface SafeZone {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export const SAFE_ZONES: Record<Aspect, SafeZone> = {
  "9:16": { top: 0.14, bottom: 0.35, left: 0.06, right: 0.15 },
  "1:1": { top: 0.06, bottom: 0.12, left: 0.06, right: 0.06 },
  "16:9": { top: 0.07, bottom: 0.1, left: 0.05, right: 0.05 },
};

export function safeZoneFor(width: number, height: number): SafeZone {
  if (height > width * 1.2) return SAFE_ZONES["9:16"];
  if (Math.abs(width - height) < 10) return SAFE_ZONES["1:1"];
  return SAFE_ZONES["16:9"];
}

export const HOOK_SECONDS = 3;
