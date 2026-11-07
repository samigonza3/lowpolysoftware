import { HOOK_SECONDS } from "./safezone";
import { sceneSeconds, type Scene, type VideoSpec } from "./spec";

/**
 * Chequeos automáticos del VideoSpec (la idea de los `checks` de WAM aplicada a nuestros videos):
 * reglas baratas que detectan errores que la vista previa no deja ver o que se escapan al ojo.
 * Se corren en la UI en vivo y antes/después de la revisión visual del agente.
 */
export interface Issue {
  level: "error" | "warn";
  code: string;
  sceneId?: string;
  scene?: number; // 1-based, para mostrar
  msg: string;
}

const WEAK_OPENERS = [
  /^hola\b/i, /^bienvenid/i, /^en este video/i, /^hoy (te |les |vamos|voy)/i, /^¿?sabías que hoy/i, /^había una vez/i,
  /^este video/i, /^hello\b/i, /^hi\b/i, /^welcome/i, /^in this video/i, /^today (we|i)/i, /^érase una vez/i,
];
const words = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
const BIG = new Set(["mountain", "building"]);
const FLOATERS = new Set(["cloud", "sun", "moon", "star", "planet", "balloon", "heart", "question", "exclamation", "lightbulb", "coin"]);

export function lintSpec(spec: VideoSpec, opts: { targetSec?: number } = {}): Issue[] {
  const out: Issue[] = [];
  const add = (level: Issue["level"], code: string, msg: string, s?: Scene, i?: number) =>
    out.push({ level, code, msg, sceneId: s?.id, scene: i === undefined ? undefined : i + 1 });
  const scenes = spec.scenes;
  if (!scenes.length) {
    add("error", "empty", "El video no tiene escenas.");
    return out;
  }

  /* ---------- Gancho (primeros 3 s) ---------- */
  const h = scenes[0];
  const hookSec = sceneSeconds(h);
  if (hookSec > HOOK_SECONDS + 0.8)
    add("error", "hook_long", `El gancho dura ${hookSec.toFixed(1)} s; debe resolverse en ~${HOOK_SECONDS} s (máx. ~8 palabras).`, h, 0);
  if (WEAK_OPENERS.some((r) => r.test(h.narration.trim())))
    add("error", "hook_weak", `El gancho empieza con una fórmula débil ("${h.narration.split(/\s+/).slice(0, 4).join(" ")}…"). Abre con una pregunta, un dato sorprendente o un conflicto.`, h, 0);
  if (!h.onScreenText.trim()) add("warn", "hook_text", "El gancho no tiene texto en pantalla; muchos ven Reels sin sonido.", h, 0);
  else if (h.onScreenText.trim().toLowerCase() === spec.title.trim().toLowerCase())
    add("warn", "hook_title", "El texto del gancho es solo el título; mejor una frase que provoque curiosidad.", h, 0);
  if (h.camera === "static" || h.camera === "orbit")
    add("warn", "hook_camera", "Cámara poco dinámica en el gancho; usa dolly_in o closeup.", h, 0);
  if (!h.characters.length && !h.props.some((p) => p.placement === "center" || p.placement === "floating"))
    add("warn", "hook_subject", "El gancho no tiene un sujeto claro (personaje o objeto al centro).", h, 0);
  if (h.characters.length && h.characters.every((c) => c.action === "idle"))
    add("warn", "hook_still", "En el gancho los personajes están quietos; usa una acción expresiva.", h, 0);
  if (h.emotion === "calm" || h.emotion === "neutral")
    add("warn", "hook_emotion", "Emoción plana en el gancho; prueba excited o mysterious.", h, 0);

  /* ---------- Por escena ---------- */
  scenes.forEach((s, i) => {
    const n = words(s.narration);
    if (!n) add("error", "no_narration", "Escena sin narración.", s, i);
    if (n > 34) add("warn", "long_narration", `Narración larga (${n} palabras); divide la escena.`, s, i);
    if (words(s.onScreenText) > 6) add("warn", "long_text", "Texto en pantalla de más de 6 palabras.", s, i);

    const pos = new Map<string, number>();
    for (const c of s.characters) pos.set(c.position, (pos.get(c.position) ?? 0) + 1);
    for (const [p, k] of pos) if (k > 1) add("error", "overlap", `${k} personajes en la misma posición (${p}): se atraviesan.`, s, i);

    if (s.characters.filter((c) => c.speaking).length > 1) add("warn", "two_speakers", "Más de un personaje marcado como el que habla.", s, i);
    if (spec.aspect === "9:16" && s.characters.length > 2)
      add("warn", "crowded_vertical", "Más de 2 personajes en vertical: quedan muy pequeños o apretados.", s, i);
    if (spec.aspect === "9:16" && s.characters.some((c) => c.position === "far_left" || c.position === "far_right"))
      add("warn", "edge_vertical", "En 9:16 los extremos quedan cerca de los botones de la app; usa left/center/right.", s, i);
    if (s.camera === "closeup" && !s.characters.length) add("warn", "closeup_empty", "Primer plano sin personaje: la cámara no tiene a quién enfocar.", s, i);

    const centerProps = s.props.filter((p) => p.placement === "center" && !BIG.has(p.kind) && !FLOATERS.has(p.kind));
    const centerChar = s.characters.some((c) => c.position === "center");
    if (centerChar && centerProps.some((p) => p.count >= 1))
      add("error", "prop_blocks", `Un prop al centro (${centerProps.map((p) => p.kind).join(", ")}) choca con el personaje del centro.`, s, i);
    const objects = s.props.reduce((a, p) => a + p.count, 0);
    if (objects > 18) add("warn", "clutter", `${objects} objetos en escena: se ve recargado.`, s, i);
    const speaker = s.characters.find((c) => c.speaking);
    if (speaker && !["talk", "point", "wave", "think", "celebrate"].includes(speaker.action))
      add("warn", "speaker_action", "El personaje que habla no hace un gesto de hablar.", s, i);
  });

  /* ---------- Ritmo ---------- */
  for (let i = 2; i < scenes.length; i++) {
    const [a, b, c] = [scenes[i - 2], scenes[i - 1], scenes[i]];
    if (a.camera === b.camera && b.camera === c.camera)
      add("warn", "same_camera", `Tres escenas seguidas con la misma cámara (${c.camera}).`, c, i);
  }
  const total = scenes.reduce((a, s) => a + sceneSeconds(s), 0);
  if (opts.targetSec && Math.abs(total - opts.targetSec) / opts.targetSec > 0.35)
    add("warn", "duration", `Dura ~${Math.round(total)} s y pediste ~${opts.targetSec} s.`);
  return out;
}

export const issueText = (i: Issue) => `${i.scene ? `Escena ${i.scene}: ` : ""}${i.msg}`;
