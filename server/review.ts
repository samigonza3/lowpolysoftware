import fs from "node:fs";
import path from "node:path";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";
import { issueText, lintSpec, type Issue } from "../shared/checks";
import { sceneFrames, type Draft, type Scene, type VideoSpec } from "../shared/spec";
import { reviewStoryboard, reviseDraft, type Review } from "./agent";
import { PORT } from "./paths";
import { loadProject, projectDir, saveProject } from "./projects";
import { browserExecutable, getBundle } from "./render";

/**
 * Revisión del director: el agente "mira" su propio storyboard antes de entregarlo.
 * Por ronda: chequeos automáticos → un fotograma por escena → Claude revisa las imágenes → aplica correcciones.
 * Igual que el ciclo compilar/mirar/corregir de WAM, pero sobre el VideoSpec.
 */
const MAX_ROUNDS = 2;

export interface ReviewRound {
  round: number;
  lint: Issue[];
  hookScore: number;
  ok: boolean;
  problems: Review["problems"];
  stills: { scene: number; url: string }[];
  fixed: boolean;
}

export interface ReviewJob {
  id: string;
  projectId: string;
  status: "running" | "done" | "error";
  stage: string;
  rounds: ReviewRound[];
  finalStills?: { scene: number; url: string }[];
  finalLint?: Issue[];
  error?: string;
  startedAt: number;
}

export const reviewJobs = new Map<string, ReviewJob>();
const running = new Map<string, string>(); // projectId -> jobId

/** Conserva la locución de las escenas cuya narración no cambió. */
export function carryAudio(prev: Scene[], next: Scene[]): Scene[] {
  return next.map((s) => {
    const old = prev.find((o) => o.narration.trim() === s.narration.trim() && o.audio);
    return old ? { ...s, audio: old.audio, audioSec: old.audioSec } : s;
  });
}

export function draftOf(spec: VideoSpec): Draft {
  const { title, summary, palette, characters, scenes } = spec;
  return { title, summary, palette, characters, scenes: scenes.map(({ audio, audioSec, ...s }) => (void audio, void audioSec, s)) };
}

/** Frame representativo de cada escena: el gancho a 1 s; las demás cuando ya entraron personajes, título y subtítulo. */
function stillFrames(spec: VideoSpec) {
  let start = 0;
  return spec.scenes.map((s, i) => {
    const dur = sceneFrames(s, spec.fps);
    const at = i === 0 ? Math.min(spec.fps, dur - 1) : Math.round(Math.max(spec.fps, Math.min(dur * 0.5, spec.fps * 2.2)));
    const f = start + Math.min(at, dur - 1);
    start += dur;
    return f;
  });
}

export async function renderStills(projectId: string, spec: VideoSpec, tag: string) {
  const serveUrl = await getBundle();
  const vertical = spec.aspect === "9:16";
  const inputProps = { spec, assetBase: `http://localhost:${PORT}`, showSafeZone: vertical };
  const exe = browserExecutable();
  const browser = await openBrowser("chrome", { browserExecutable: exe, chromiumOptions: { gl: "angle" } });
  const dir = path.join(projectDir(projectId), "review");
  fs.mkdirSync(dir, { recursive: true });
  try {
    const composition = await selectComposition({ serveUrl, id: "Video", inputProps, puppeteerInstance: browser, browserExecutable: exe });
    const frames = stillFrames(spec);
    const out: { scene: number; file: string; url: string }[] = [];
    for (let i = 0; i < frames.length; i++) {
      const name = `${tag}-s${i + 1}.jpg`;
      const file = path.join(dir, name);
      await renderStill({
        serveUrl, composition, frame: frames[i], output: file, inputProps, imageFormat: "jpeg", jpegQuality: 82,
        scale: 0.5, overwrite: true, puppeteerInstance: browser, chromiumOptions: { gl: "angle" }, browserExecutable: exe,
        timeoutInMilliseconds: 120_000,
      });
      out.push({ scene: i + 1, file, url: `/files/${projectId}/review/${name}` });
    }
    return out;
  } finally {
    await browser.close({ silent: true }).catch(() => {});
  }
}

export function startReview(projectId: string): ReviewJob {
  const existing = running.get(projectId);
  if (existing && reviewJobs.get(existing)?.status === "running") return reviewJobs.get(existing)!;
  const job: ReviewJob = { id: `rev-${projectId}-${Date.now()}`, projectId, status: "running", stage: "Preparando", rounds: [], startedAt: Date.now() };
  reviewJobs.set(job.id, job);
  running.set(projectId, job.id);

  (async () => {
    const p = loadProject(projectId);
    if (!p.spec) throw new Error("Aún no hay guion");
    let spec = p.spec;
    const target = p.scriptMode === "suggest" ? p.durationSec : undefined;
    let lastFixed = false;
    for (let round = 1; round <= MAX_ROUNDS; round++) {
      job.stage = `Ronda ${round}: revisando reglas`;
      const lint = lintSpec(spec, { targetSec: target });
      job.stage = `Ronda ${round}: tomando un fotograma de cada escena`;
      const stills = await renderStills(projectId, spec, `r${round}-${Date.now().toString(36)}`);
      job.stage = `Ronda ${round}: el director está mirando el storyboard`;
      const review = await reviewStoryboard({
        style: p.style, draft: draftOf(spec), aspect: spec.aspect, lint,
        stills: stills.map((s) => ({
          scene: s.scene,
          label: s.scene === 1 ? "escena 1 (gancho, segundo 1)" : `escena ${s.scene}`,
          image: { mediaType: "image/jpeg", data: fs.readFileSync(s.file).toString("base64") },
        })),
      });
      const errors = lint.filter((i) => i.level === "error");
      const rr: ReviewRound = {
        round, lint, hookScore: review.hookScore, ok: review.ok, problems: review.problems,
        stills: stills.map(({ scene, url }) => ({ scene, url })), fixed: false,
      };
      job.rounds.push(rr);
      const hookWeak = review.hookScore < 7;
      if (review.ok && !errors.length && !hookWeak) {
        lastFixed = false;
        break;
      }
      job.stage = `Ronda ${round}: aplicando correcciones`;
      const instruction = [
        "Corrige estos problemas detectados en la revisión del storyboard:",
        ...review.problems.map((x) => `- ${x.scene ? `Escena ${x.scene}` : "General"}: ${x.problem} → ${x.fix}`),
        ...errors.map((i) => `- ${issueText(i)}`),
        hookWeak ? `- El gancho (escena 1) sacó ${review.hookScore}/10: reescríbelo para que atrape en 3 segundos.` : "",
      ].filter(Boolean).join("\n");
      const updated = await reviseDraft(p.style, draftOf(spec), instruction, spec.language, spec.aspect);
      spec = { ...spec, ...updated, scenes: carryAudio(spec.scenes, updated.scenes) };
      const fresh = loadProject(projectId);
      fresh.spec = { ...spec, aspect: fresh.spec?.aspect ?? spec.aspect, captions: fresh.spec?.captions ?? spec.captions, voice: fresh.voice, language: fresh.language };
      saveProject(fresh);
      rr.fixed = true;
      lastFixed = true;
    }
    if (lastFixed) {
      job.stage = "Tomando los fotogramas finales";
      job.finalStills = (await renderStills(projectId, spec, `final-${Date.now().toString(36)}`)).map(({ scene, url }) => ({ scene, url }));
    }
    job.finalLint = lintSpec(spec, { targetSec: target });
    job.status = "done";
    job.stage = "Listo";
  })().catch((e) => {
    job.status = "error";
    job.error = e instanceof Error ? e.message : String(e);
    console.error("[review]", e);
  });
  return job;
}
