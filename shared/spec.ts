import { z } from "zod";

/**
 * VideoSpec: el "guion técnico" que produce el agente y que interpreta el motor
 * de render. Todo lo visual se expresa con vocabularios cerrados (enums) para que
 * el LLM no pueda pedir algo que el motor no sabe dibujar.
 */

export const STYLES = ["lowpoly", "cartoon3d", "flat2d", "neon", "clay"] as const;
export const SETTINGS = [
  "city", "forest", "space", "ocean", "desert", "mountains", "room", "office",
  "lab", "farm", "snow", "abstract",
] as const;
export const TIMES = ["day", "sunset", "night"] as const;
export const CAMERAS = [
  "static", "orbit", "dolly_in", "dolly_out", "pan_left", "pan_right", "crane_up", "closeup",
] as const;
export const ACTIONS = [
  "idle", "talk", "walk", "run", "wave", "jump", "dance", "think", "celebrate", "sad", "point",
] as const;
export const KINDS = ["person", "child", "dog", "cat", "bird", "robot", "mascot", "monster"] as const;
export const ACCESSORIES = ["none", "hat", "cap", "glasses", "bow", "crown", "scarf", "headphones"] as const;
export const POSITIONS = ["far_left", "left", "center", "right", "far_right", "back"] as const;
export const PROPS = [
  "tree", "pine", "house", "building", "rock", "car", "cloud", "sun", "moon", "star", "heart",
  "flower", "lightbulb", "book", "computer", "phone", "coin", "gift", "rocket", "planet", "globe",
  "cup", "chart", "question", "exclamation", "trophy", "clock", "mountain", "boat", "fish",
  "balloon", "cactus", "lamp", "table", "chair", "sign",
] as const;
export const PLACEMENTS = ["scattered", "background", "center", "floating", "around"] as const;
export const TRANSITIONS = ["fade", "cut", "wipe", "zoom"] as const;
export const EMOTIONS = ["neutral", "happy", "excited", "serious", "mysterious", "sad", "calm"] as const;
export const ASPECTS = { "16:9": [1920, 1080], "9:16": [1080, 1920], "1:1": [1080, 1080] } as const;
export type Aspect = keyof typeof ASPECTS;
export type StyleId = (typeof STYLES)[number];

const hex = z.string().describe("Color hex, p. ej. #ff8844");

export const CharacterSchema = z.object({
  id: z.string().describe("id corto en minúsculas, p. ej. 'luna'"),
  name: z.string(),
  kind: z.enum(KINDS),
  color: hex.describe("color principal (ropa/pelaje/carcasa)"),
  accent: hex.describe("color secundario"),
  accessory: z.enum(ACCESSORIES),
  description: z.string().describe("personalidad y aspecto en una frase"),
});

export const SceneCharacterSchema = z.object({
  id: z.string().describe("id de un personaje definido en characters"),
  action: z.enum(ACTIONS),
  position: z.enum(POSITIONS),
  speaking: z.boolean().describe("true si es quien narra/habla en esta escena"),
});

export const ScenePropSchema = z.object({
  kind: z.enum(PROPS),
  count: z.number().int().describe("1 a 12"),
  placement: z.enum(PLACEMENTS),
});

export const SceneSchema = z.object({
  id: z.string(),
  narration: z.string().describe("texto exacto que dirá la voz en off (1-3 frases)"),
  onScreenText: z.string().describe("título corto en pantalla (máx. 6 palabras) o cadena vacía"),
  setting: z.enum(SETTINGS),
  timeOfDay: z.enum(TIMES),
  camera: z.enum(CAMERAS),
  emotion: z.enum(EMOTIONS),
  transition: z.enum(TRANSITIONS),
  characters: z.array(SceneCharacterSchema),
  props: z.array(ScenePropSchema),
});

export const PaletteSchema = z.object({
  sky: hex,
  ground: hex,
  primary: hex,
  secondary: hex,
  accent: hex,
});

/** Lo que genera el agente. */
export const DraftSchema = z.object({
  title: z.string(),
  summary: z.string().describe("de qué trata el video, 1-2 frases"),
  palette: PaletteSchema,
  characters: z.array(CharacterSchema),
  scenes: z.array(SceneSchema),
});

export type Draft = z.infer<typeof DraftSchema>;
export type Scene = z.infer<typeof SceneSchema> & {
  audio?: string; // ruta /files/... del wav
  audioSec?: number;
};
export type Character = z.infer<typeof CharacterSchema>;
export type Palette = z.infer<typeof PaletteSchema>;

export interface VoiceChoice {
  engine: "kokoro" | "piper" | "remote";
  voiceId: string;
  speed: number;
}

export interface VideoSpec extends Omit<Draft, "scenes"> {
  version: 1;
  style: StyleId;
  aspect: Aspect;
  fps: number;
  captions: boolean;
  language: string; // es, en, pt...
  voice: VoiceChoice;
  scenes: Scene[];
}

/** Segundos que dura una escena: audio + respiro, o estimado por palabras. */
export function sceneSeconds(s: Scene): number {
  if (s.audioSec && s.audioSec > 0) return s.audioSec + 0.6;
  const words = s.narration.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(3, words / 2.6 + 0.8);
}

export function sceneFrames(s: Scene, fps: number): number {
  return Math.max(1, Math.round(sceneSeconds(s) * fps));
}

export function totalFrames(spec: VideoSpec): number {
  return spec.scenes.reduce((a, s) => a + sceneFrames(s, spec.fps), 0);
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const safeHex = (v: string, fallback: string) => (HEX_RE.test(v) ? v : fallback);
const pick = <T extends readonly string[]>(list: T, v: string, d: T[number]): T[number] =>
  (list as readonly string[]).includes(v) ? (v as T[number]) : d;

/** Limpia lo que venga del LLM para que el motor nunca reciba algo inválido. */
export function sanitizeDraft(d: Draft): Draft {
  const charIds = new Set<string>();
  const characters = d.characters.slice(0, 6).map((c, i) => {
    let id = (c.id || c.name || `p${i}`).toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 20) || `p${i}`;
    while (charIds.has(id)) id += "_";
    charIds.add(id);
    return {
      ...c,
      id,
      kind: pick(KINDS, c.kind, "person"),
      accessory: pick(ACCESSORIES, c.accessory, "none"),
      color: safeHex(c.color, "#e07a5f"),
      accent: safeHex(c.accent, "#3d405b"),
    };
  });
  const scenes = d.scenes.slice(0, 20).map((s, i) => ({
    ...s,
    id: `s${i + 1}`,
    narration: (s.narration || "").trim(),
    onScreenText: (s.onScreenText || "").slice(0, 60),
    setting: pick(SETTINGS, s.setting, "abstract"),
    timeOfDay: pick(TIMES, s.timeOfDay, "day"),
    camera: pick(CAMERAS, s.camera, "orbit"),
    emotion: pick(EMOTIONS, s.emotion, "neutral"),
    transition: pick(TRANSITIONS, s.transition, "fade"),
    characters: s.characters
      .filter((c) => charIds.has(c.id))
      .slice(0, 4)
      .map((c) => ({
        ...c,
        action: pick(ACTIONS, c.action, "idle"),
        position: pick(POSITIONS, c.position, "center"),
      })),
    props: s.props.slice(0, 6).map((p) => ({
      ...p,
      kind: pick(PROPS, p.kind, "tree"),
      placement: pick(PLACEMENTS, p.placement, "scattered"),
      count: Math.min(12, Math.max(1, Math.round(p.count || 1))),
    })),
  }));
  const pal = d.palette ?? ({} as Palette);
  return {
    ...d,
    palette: {
      sky: safeHex(pal.sky, "#8ecae6"),
      ground: safeHex(pal.ground, "#90be6d"),
      primary: safeHex(pal.primary, "#f4a261"),
      secondary: safeHex(pal.secondary, "#2a9d8f"),
      accent: safeHex(pal.accent, "#e76f51"),
    },
    characters,
    scenes,
  };
}
