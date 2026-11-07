import { z } from "zod";
import {
  ACCESSORIES, ACTIONS, CAMERAS, DraftSchema, EMOTIONS, KINDS, PLACEMENTS, POSITIONS, PROPS, SETTINGS, TIMES, TRANSITIONS,
  sanitizeDraft, type Draft,
} from "../shared/spec";
import { templateById } from "../shared/templates";
import { issueText, type Issue } from "../shared/checks";
import { generateJSON, type ImageInput } from "./llm";

const LANG_NAMES: Record<string, string> = { es: "español", en: "inglés", pt: "portugués", fr: "francés", it: "italiano" };

const BASE_SYSTEM = `Eres el director creativo de un estudio de animación que produce videos cortos con un motor 3D procedural.
El motor SOLO sabe dibujar este vocabulario cerrado; nunca inventes otros valores:
- Escenarios (setting): ${SETTINGS.join(", ")}
- Hora (timeOfDay): ${TIMES.join(", ")}
- Cámara: ${CAMERAS.join(", ")}
- Tipos de personaje (kind): ${KINDS.join(", ")}
- Accesorios: ${ACCESSORIES.join(", ")}
- Acciones de personaje: ${ACTIONS.join(", ")}
- Posiciones: ${POSITIONS.join(", ")}
- Props: ${PROPS.join(", ")}
- Colocación de props: ${PLACEMENTS.join(", ")}
- Emociones: ${EMOTIONS.join(", ")}
- Transiciones: ${TRANSITIONS.join(", ")}
Traduce las ideas abstractas a metáforas visuales con esos elementos (p. ej. "ahorro" → coin + chart; "idea" → lightbulb).`;

/** Reglas del gancho: los primeros 3 segundos deciden si la gente se queda. */
export const HOOK_RULES = `GANCHO (escena 1 = los primeros 3 segundos, lo más importante del video):
- Narración de MÁXIMO 8 palabras (se dice en ~3 s). Debe atrapar de inmediato con UNA de estas técnicas:
  pregunta que pica la curiosidad, dato o número sorprendente, promesa concreta de lo que van a ganar,
  afirmación que contradice lo que todos creen, o empezar en medio de un conflicto ("in media res").
- PROHIBIDO abrir con saludos o fórmulas: "Hola", "Bienvenidos", "En este video", "Hoy te voy a", "Había una vez".
- onScreenText de la escena 1: 2-5 palabras que refuercen el gancho (no el título tal cual); se lee sin sonido.
- Cámara dolly_in o closeup, emoción excited o mysterious, transición cut, protagonista con acción expresiva
  (jump, point, celebrate, think…) y como máximo 1-2 grupos de props que hagan visible el gancho.
- La escena 2 cumple rápido la promesa del gancho; nada de introducciones largas.`;

function formatRules(aspect?: string) {
  if (aspect !== "9:16") return "";
  return `
FORMATO VERTICAL 9:16 (Reels/TikTok/Shorts):
- Máx. 2 personajes por escena, en left / center / right (nunca far_left / far_right: quedan bajo los botones de la app).
- Composición simple y centrada; textos en pantalla muy cortos.`;
}

/* ---------- 1. Sugerir ideas / temas ---------- */
const IdeasSchema = z.object({
  ideas: z.array(z.object({ title: z.string(), logline: z.string() })),
});

export async function suggestIdeas(style: string, hint: string, language: string) {
  const t = templateById(style);
  return generateJSON({
    system: BASE_SYSTEM,
    prompt: `Plantilla: ${t.name}. Dirección de arte: ${t.artDirection}
${hint ? `Pista del usuario: "${hint}"` : "El usuario no dio pista; propone temas variados (educativo, historia, marca, curiosidad)."}
Propón 5 ideas de video corto (30-90 s) que luzcan bien en este estilo. Escribe en ${LANG_NAMES[language] ?? "español"}.
Cada idea: título pegajoso y logline de una frase.`,
    schema: IdeasSchema,
    effort: "low",
  });
}

/* ---------- 2. Preguntas del agente ---------- */
const QuestionsSchema = z.object({
  questions: z.array(
    z.object({
      id: z.string(),
      question: z.string(),
      options: z.array(z.string()).describe("3-4 respuestas sugeridas cortas"),
    }),
  ),
});
export type Questions = z.infer<typeof QuestionsSchema>;

export async function askQuestions(style: string, idea: string) {
  const t = templateById(style);
  return generateJSON({
    system: BASE_SYSTEM,
    prompt: `El usuario quiere un video en estilo "${t.name}" sobre: "${idea}".
Antes de escribir el guion, hazle entre 4 y 6 preguntas clave para entender qué quiere ver: público objetivo,
duración aproximada, tono/emoción, protagonistas (quiénes son, cómo se ven), mensaje o llamado a la acción final,
y cualquier detalle visual importante para ESTA idea. Preguntas concretas y en español, cada una con 3-4 opciones sugeridas.
No preguntes por la voz ni por el estilo visual (ya están elegidos). ids en snake_case.`,
    schema: QuestionsSchema,
    effort: "low",
  });
}

/* ---------- 3. Guion + storyboard ---------- */
export interface BriefInput {
  style: string;
  idea: string;
  answers: Record<string, string>; // pregunta -> respuesta
  language: string;
  mode: "suggest" | "own";
  userScript?: string;
  durationSec?: number;
  notes?: string; // personajes o tema extra que escribió el usuario
  aspect?: string;
}

export async function buildDraft(input: BriefInput): Promise<Draft> {
  const t = templateById(input.style);
  const lang = LANG_NAMES[input.language] ?? input.language;
  const qa = Object.entries(input.answers)
    .filter(([, a]) => a?.trim())
    .map(([q, a]) => `- ${q}: ${a}`)
    .join("\n");
  const duration = input.durationSec ?? 45;
  const scriptPart =
    input.mode === "own" && input.userScript?.trim()
      ? `El usuario YA escribió el guion. Respétalo palabra por palabra (solo corrige errores evidentes) y divídelo en escenas;
la narración de cada escena es un fragmento consecutivo de su texto. La escena 1 es solo la primera frase (o su primer
fragmento corto) para que funcione como gancho; aplica las reglas visuales del gancho aunque no cambies el texto:
"""${input.userScript.trim()}"""`
      : `Escribe tú el guion de narración en ${lang}: natural, frases cortas fáciles de locutar,
ritmo de ~2.5 palabras por segundo para una duración total aproximada de ${duration} segundos.`;

  const draft = await generateJSON({
    system: BASE_SYSTEM,
    prompt: `Crea el guion técnico completo de un video animado.
Estilo: ${t.name}. Dirección de arte: ${t.artDirection}
Idea: "${input.idea}"
Respuestas del usuario a tus preguntas:
${qa || "(sin respuestas)"}
${input.notes ? `Notas extra del usuario (tema/personajes): ${input.notes}` : ""}

${scriptPart}

Reglas:
- Idioma de la narración y de los textos en pantalla: ${lang}.
- Entre 4 y 10 escenas. Cada escena 1-3 frases de narración (máx. ~30 palabras).
- Define 1-4 personajes recurrentes con colores que combinen con la paleta; usa sus ids en las escenas.
- Máx. 3 personajes por escena y máx. 3 grupos de props por escena (count razonable: 1-8).
- Varía cámaras y escenarios para mantener el ritmo (no repitas la misma cámara 3 veces seguidas).
- Nunca pongas dos personajes en la misma posición, ni un prop con placement "center" si hay un personaje en el centro.

${HOOK_RULES}${formatRules(input.aspect)}
- Si un personaje "habla" en la escena, márcalo speaking=true y usa la acción talk/point/wave; la narración en off sin personaje que hable = todos speaking=false.
- La paleta (hex) debe sentirse propia del estilo ${t.name}; puedes partir de: ${JSON.stringify(t.palette)}.`,
    schema: DraftSchema,
    effort: "medium",
  });
  return sanitizeDraft(draft);
}

/* ---------- 4. Revisión por instrucción ---------- */
export async function reviseDraft(style: string, draft: Draft, instruction: string, language: string, aspect?: string): Promise<Draft> {
  const t = templateById(style);
  const updated = await generateJSON({
    system: BASE_SYSTEM,
    prompt: `Este es el guion técnico actual de un video estilo ${t.name} (JSON):
${JSON.stringify(draft)}

Aplica este cambio pedido por el usuario y devuelve el guion COMPLETO actualizado (mismo formato):
"${instruction}"
Mantén todo lo que no se pidió cambiar. Narración en ${LANG_NAMES[language] ?? language}.
Sigue respetando estas reglas:
${HOOK_RULES}${formatRules(aspect)}`,
    schema: DraftSchema,
    effort: "medium",
  });
  return sanitizeDraft(updated);
}

/* ---------- 5. Revisión visual del director ---------- */
const ReviewSchema = z.object({
  ok: z.boolean().describe("true si el video está listo y no hace falta cambiar nada importante"),
  hookScore: z.number().int().describe("1-10: qué tanto atrapan los primeros 3 segundos"),
  problems: z.array(
    z.object({
      scene: z.number().int().describe("número de escena (1 = gancho); 0 si es general"),
      problem: z.string().describe("lo que se ve mal o no funciona, concreto"),
      fix: z.string().describe("cambio concreto en el guion técnico usando el vocabulario del motor"),
    }),
  ),
});
export type Review = z.infer<typeof ReviewSchema>;

export async function reviewStoryboard(opts: {
  style: string;
  draft: Draft;
  aspect: string;
  stills: { scene: number; image: ImageInput; label: string }[];
  lint: Issue[];
}): Promise<Review> {
  const t = templateById(opts.style);
  const vertical = opts.aspect === "9:16";
  return generateJSON({
    system: BASE_SYSTEM,
    images: opts.stills.map((s) => s.image),
    prompt: `Eres el director revisando el storyboard ANTES de entregar el video. Te adjunto, en orden, un fotograma por escena
renderizado por el motor (${opts.stills.map((s, i) => `imagen ${i + 1} = ${s.label}`).join("; ")}).
${vertical ? "Formato 9:16: las franjas rojas punteadas marcan lo que tapa la interfaz de Reels/TikTok (arriba, abajo y la columna de botones a la derecha). Nada importante (caras, texto, objeto clave) debe quedar debajo de ellas." : `Formato ${opts.aspect}.`}
Estilo: ${t.name}.

Guion técnico actual (JSON):
${JSON.stringify(opts.draft)}

Chequeos automáticos que fallaron:
${opts.lint.length ? opts.lint.map((i) => `- [${i.level}] ${issueText(i)}`).join("\n") : "(ninguno)"}

Mira las imágenes con ojo crítico y busca problemas reales que se VEN: personajes cortados o fuera de cuadro, objetos que tapan
caras o se atraviesan, escena vacía o confusa, metáfora visual que no se entiende, texto o subtítulo ilegible o tapado,
colores que no contrastan, el gancho no se entiende de un vistazo. Evalúa además si el gancho atrapa en 3 segundos.
${HOOK_RULES}

Devuelve ok=true solo si no hay nada importante que arreglar. Cada "fix" debe ser un cambio aplicable en el JSON
(cambiar position, camera, placement, props, action, narración del gancho, etc.). No propongas cambios cosméticos menores.`,
    schema: ReviewSchema,
    effort: "medium",
  });
}
