import "./env";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import express, { type NextFunction, type Request, type Response } from "express";
import { sanitizeDraft, sceneSeconds, type Aspect, type Draft, type VideoSpec } from "../shared/spec";
import { TEMPLATES, templateById } from "../shared/templates";
import { askQuestions, buildDraft, reviseDraft, suggestIdeas } from "./agent";
import { MODEL, llmBackend } from "./llm";
import { DATA_DIR, PORT, PROJECTS_DIR, ROOT } from "./paths";
import { createProject, deleteProject, listProjects, loadProject, projectDir, saveProject, type Project } from "./projects";
import { buildSrt, jobs, startRender, QUALITY } from "./render";
import { carryAudio, reviewJobs, startReview } from "./review";
import { LIBRARY_DIR, installAsset, installedLibrary, listLibrary, removeAsset, uploadAsset } from "./library";
import { addReference, referenceInputs, removeReference } from "./references";
import { withAssets } from "../shared/library";
import { EMOTION_SPEED, installModel, listVoices, synthesize, voiceById, wavSeconds } from "./tts";

const app = express();
app.use(express.json({ limit: "40mb" }));

type H = (req: Request, res: Response) => Promise<unknown> | unknown;
const h = (fn: H) => (req: Request, res: Response, next: NextFunction) =>
  Promise.resolve(fn(req, res)).then((r) => r !== undefined && !res.headersSent && res.json(r)).catch(next);

/* ---------- archivos generados (audio, mp4) ---------- */
app.use(
  "/files",
  (_req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    next();
  },
  express.static(PROJECTS_DIR, { fallthrough: false }),
);

app.use(
  "/library",
  (_req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    next();
  },
  express.static(LIBRARY_DIR, { fallthrough: false }),
);

/* ---------- biblioteca: texturas y cielos 360° ---------- */
app.get("/api/library", h(() => listLibrary()));
app.post("/api/library/upload", h((req) => uploadAsset(req.body)));
app.post("/api/library/:id/install", h(async (req) => (await installAsset(req.params.id), { ok: true })));
app.delete("/api/library/:id", h((req) => (removeAsset(req.params.id), { ok: true })));

/* ---------- fotos de referencia ---------- */
app.post("/api/projects/:id/references", h((req) => addReference(req.params.id, String(req.body.data ?? ""), String(req.body.note ?? ""))));
app.delete("/api/projects/:id/references/:refId", h((req) => removeReference(req.params.id, req.params.refId)));

/* ---------- estado ---------- */
app.get("/api/status", h(() => ({
  llm: llmBackend(),
  model: MODEL,
  voices: listVoices().filter((v) => v.installed).length,
  remoteTts: Boolean(process.env.TTS_REMOTE_URL),
})));
app.get("/api/templates", h(() => TEMPLATES));

/* ---------- proyectos ---------- */
app.get("/api/projects", h(() => listProjects()));
app.post("/api/projects", h((req) => createProject(templateById(req.body?.style ?? "lowpoly").id)));
app.get("/api/projects/:id", h((req) => loadProject(req.params.id)));
app.delete("/api/projects/:id", h((req) => (deleteProject(req.params.id), { ok: true })));
app.put("/api/projects/:id", h((req) => {
  const p = loadProject(req.params.id);
  const allowed: (keyof Project)[] = ["step", "style", "idea", "answers", "scriptMode", "userScript", "notes", "durationSec", "spec", "questions", "language", "voice", "references"];
  for (const k of allowed) if (k in req.body) (p as unknown as Record<string, unknown>)[k] = req.body[k];
  if (p.spec) {
    p.spec.style = templateById(p.style).id;
    if ("voice" in req.body) p.spec.voice = p.voice;
    if ("language" in req.body) p.spec.language = p.language;
  }
  return saveProject(p);
}));

/* ---------- agente ---------- */
app.post("/api/agent/ideas", h((req) => suggestIdeas(req.body.style, req.body.hint ?? "", req.body.language ?? "es")));

app.post("/api/projects/:id/questions", h(async (req) => {
  const p = loadProject(req.params.id);
  if (req.body?.idea) p.idea = req.body.idea;
  if (!p.idea.trim()) throw Object.assign(new Error("Escribe primero la idea del video"), { status: 400 });
  const q = await askQuestions(p.style, p.idea, { refs: referenceInputs(p) });
  p.questions = q.questions;
  return saveProject(p);
}));

function defaultSpec(p: Project, draft: Draft, prev: VideoSpec | null): VideoSpec {
  return {
    version: 1,
    ...draft,
    style: templateById(p.style).id,
    aspect: prev?.aspect ?? "16:9",
    fps: 30,
    captions: prev?.captions ?? true,
    language: p.language ?? "es",
    voice: p.voice ?? { engine: "kokoro", voiceId: "ef_dora", speed: 1 },
  };
}

app.post("/api/projects/:id/script", h(async (req) => {
  const p = loadProject(req.params.id);
  Object.assign(p, pick(req.body, ["scriptMode", "userScript", "notes", "durationSec", "answers"]));
  const language = p.language ?? "es";
  const draft = await buildDraft({
    style: p.style, idea: p.idea, language, mode: p.scriptMode, userScript: p.userScript, notes: p.notes, durationSec: p.durationSec,
    answers: Object.fromEntries(p.questions.map((q) => [q.question, p.answers[q.id] ?? ""])),
    aspect: p.spec?.aspect,
  }, { refs: referenceInputs(p), library: installedLibrary() });
  p.spec = withAssets(defaultSpec(p, draft, p.spec), installedLibrary());
  return saveProject(p);
}));

app.post("/api/projects/:id/revise", h(async (req) => {
  const p = loadProject(req.params.id);
  if (!p.spec) throw Object.assign(new Error("Aún no hay guion"), { status: 400 });
  const { version, style, aspect, fps, captions, language, voice, ...draft } = p.spec;
  void version; void style; void fps;
  const updated = await reviseDraft(p.style, draft as Draft, String(req.body.instruction ?? ""), language, aspect, {
    refs: referenceInputs(p), library: installedLibrary(),
  });
  p.spec = withAssets(
    { ...defaultSpec(p, updated, p.spec), aspect, captions, language, voice, scenes: carryAudio(p.spec.scenes, updated.scenes) },
    installedLibrary(),
  );
  return saveProject(p);
}));

/* ---------- revisión del director (fotogramas + agente) ---------- */
app.post("/api/projects/:id/review", h((req) => {
  const p = loadProject(req.params.id);
  if (!p.spec) throw Object.assign(new Error("Aún no hay guion"), { status: 400 });
  return startReview(p.id);
}));
app.get("/api/review/:id", h((req) => {
  const job = reviewJobs.get(req.params.id);
  if (!job) throw Object.assign(new Error("Revisión no encontrada"), { status: 404 });
  return job;
}));

/* ---------- voces ---------- */
app.get("/api/voices", h(() => listVoices()));
app.post("/api/voices/:id/install", h(async (req) => {
  const v = voiceById(req.params.id);
  if (!v) throw Object.assign(new Error("Voz no encontrada"), { status: 404 });
  if (v.engine !== "remote") await installModel(v.model);
  return { ok: true };
}));

const PREVIEW_DIR = path.join(PROJECTS_DIR, "_previews");
app.post("/api/voices/preview", h(async (req) => {
  const { voiceId, text, speed = 1 } = req.body;
  const key = crypto.createHash("sha1").update(`${voiceId}|${speed}|${text}`).digest("hex").slice(0, 16);
  const out = path.join(PREVIEW_DIR, `${key}.wav`);
  if (!fs.existsSync(out)) await synthesize(voiceId, text, speed, out);
  return { url: `/files/_previews/${key}.wav` };
}));

/** Locución de una escena (cacheada por voz+velocidad+texto). */
app.post("/api/projects/:id/voiceover/:sceneId", h(async (req) => {
  const p = loadProject(req.params.id);
  const scene = p.spec?.scenes.find((s) => s.id === req.params.sceneId);
  if (!p.spec || !scene) throw Object.assign(new Error("Escena no encontrada"), { status: 404 });
  const { voiceId, speed } = p.spec.voice;
  const sp = +(speed * (EMOTION_SPEED[scene.emotion] ?? 1)).toFixed(2);
  const key = crypto.createHash("sha1").update(`${voiceId}|${sp}|${scene.narration}`).digest("hex").slice(0, 12);
  const rel = `audio/${scene.id}-${key}.wav`;
  const abs = path.join(projectDir(p.id), rel);
  const seconds = fs.existsSync(abs)
    ? wavSeconds(fs.readFileSync(abs))
    : (await synthesize(voiceId, scene.narration, sp, abs)).seconds;
  // recargar por si otro request guardó mientras sintetizábamos
  const fresh = loadProject(p.id);
  const s2 = fresh.spec?.scenes.find((s) => s.id === scene.id);
  if (fresh.spec && s2 && s2.narration === scene.narration) {
    s2.audio = `/files/${p.id}/${rel}`;
    s2.audioSec = +seconds.toFixed(3);
    saveProject(fresh);
  }
  return { sceneId: scene.id, audio: `/files/${p.id}/${rel}`, audioSec: seconds };
}));

/* ---------- exportar ---------- */
app.post("/api/projects/:id/render", h((req) => {
  const p = loadProject(req.params.id);
  if (!p.spec) throw Object.assign(new Error("Aún no hay guion"), { status: 400 });
  const aspect = (req.body.aspect ?? p.spec.aspect) as Aspect;
  const quality = (req.body.quality in QUALITY ? req.body.quality : "hd") as keyof typeof QUALITY;
  const spec: VideoSpec = withAssets({ ...sanitizeSpec(p.spec), aspect }, installedLibrary());
  const job = startRender(p.id, spec, path.join(projectDir(p.id), "renders"), quality);
  return job;
}));

app.get("/api/jobs/:id", h((req) => {
  const job = jobs.get(req.params.id);
  if (!job) throw Object.assign(new Error("Trabajo no encontrado"), { status: 404 });
  if (job.status === "done" && job.file) {
    const p = loadProject(job.projectId);
    if (!p.renders.some((r) => r.file === job.file)) {
      p.renders.unshift({ file: job.file, createdAt: new Date().toISOString(), aspect: p.spec?.aspect ?? "16:9" });
      saveProject(p);
    }
  }
  return { ...job, url: job.file ? `/files/${job.projectId}/renders/${job.file}` : undefined };
}));

app.get("/api/projects/:id/srt", h((req, res) => {
  const p = loadProject(req.params.id);
  if (!p.spec) throw Object.assign(new Error("Aún no hay guion"), { status: 400 });
  res.setHeader("Content-Type", "application/x-subrip; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="subtitulos.srt"`);
  res.send(buildSrt(p.spec, sceneSeconds));
}));

function sanitizeSpec(spec: VideoSpec): VideoSpec {
  const d = sanitizeDraft(spec);
  return { ...spec, ...d, scenes: d.scenes.map((s, i) => ({ ...s, audio: spec.scenes[i]?.audio, audioSec: spec.scenes[i]?.audioSec })) };
}

function pick<T extends Record<string, unknown>>(o: T, keys: string[]) {
  return Object.fromEntries(Object.entries(o ?? {}).filter(([k]) => keys.includes(k)));
}

/* ---------- UI compilada (modo npm start) ---------- */
const dist = path.join(ROOT, "dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api|files).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

app.use((err: Error & { status?: number }, _req: Request, res: Response, _next: NextFunction) => {
  void _next;
  console.error("[api]", err.message);
  res.status(err.status ?? 500).json({ error: err.message });
});

fs.mkdirSync(DATA_DIR, { recursive: true });
app.listen(PORT, () => {
  console.log(`Estudio IA API en http://localhost:${PORT}  (agente: ${llmBackend()} · modelo: ${MODEL})`);
});

// que un fallo puntual (descarga, render) no tumbe el servidor
process.on("unhandledRejection", (e) => console.error("[unhandled]", e));
process.on("uncaughtException", (e) => console.error("[uncaught]", e));
