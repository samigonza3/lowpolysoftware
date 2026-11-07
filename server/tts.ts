import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { MODELS_DIR } from "./paths";

const require = createRequire(import.meta.url);
// sherpa-onnx (motor ONNX en C++ con binarios para Windows/Mac/Linux, solo CPU, sin Python)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sherpa: any = require("sherpa-onnx-node");

export interface Voice {
  id: string;
  engine: "kokoro" | "piper" | "remote";
  name: string;
  gender: "F" | "M";
  lang: string; // es, en, pt, fr, it
  accent: string; // "España", "México", "EE. UU."...
  model: string; // carpeta en /models
  sid?: number;
  espeak?: string; // código de idioma espeak
  note?: string;
  installed?: boolean;
}

const KOKORO = "kokoro-multi-lang-v1_0";

/** Catálogo de voces por defecto. Kokoro-82M (Apache 2.0) + Piper (MIT) para acentos latinos. */
export const VOICES: Voice[] = [
  { id: "ef_dora", engine: "kokoro", name: "Dora", gender: "F", lang: "es", accent: "Español neutro", model: KOKORO, sid: 28, espeak: "es", note: "Cálida y clara" },
  { id: "em_alex", engine: "kokoro", name: "Alex", gender: "M", lang: "es", accent: "Español neutro", model: KOKORO, sid: 29, espeak: "es", note: "Narrador versátil" },
  { id: "em_santa", engine: "kokoro", name: "Santa", gender: "M", lang: "es", accent: "Español neutro", model: KOKORO, sid: 53, espeak: "es", note: "Grave y alegre" },
  { id: "piper_es_MX-claude-high", engine: "piper", name: "Claude", gender: "F", lang: "es", accent: "México", model: "vits-piper-es_MX-claude-high", note: "Latina, alta calidad" },
  { id: "piper_es_AR-daniela-high", engine: "piper", name: "Daniela", gender: "F", lang: "es", accent: "Argentina", model: "vits-piper-es_AR-daniela-high", note: "Rioplatense" },
  { id: "piper_es_MX-ald-medium", engine: "piper", name: "Ald", gender: "M", lang: "es", accent: "México", model: "vits-piper-es_MX-ald-medium", note: "Latino masculino" },
  { id: "piper_es_ES-davefx-medium", engine: "piper", name: "Davefx", gender: "M", lang: "es", accent: "España", model: "vits-piper-es_ES-davefx-medium", note: "Castellano" },
  { id: "af_heart", engine: "kokoro", name: "Heart", gender: "F", lang: "en", accent: "EE. UU.", model: KOKORO, sid: 3, espeak: "en-us", note: "La más expresiva de Kokoro" },
  { id: "af_bella", engine: "kokoro", name: "Bella", gender: "F", lang: "en", accent: "EE. UU.", model: KOKORO, sid: 2, espeak: "en-us" },
  { id: "am_michael", engine: "kokoro", name: "Michael", gender: "M", lang: "en", accent: "EE. UU.", model: KOKORO, sid: 16, espeak: "en-us" },
  { id: "am_fenrir", engine: "kokoro", name: "Fenrir", gender: "M", lang: "en", accent: "EE. UU.", model: KOKORO, sid: 14, espeak: "en-us" },
  { id: "bf_emma", engine: "kokoro", name: "Emma", gender: "F", lang: "en", accent: "Reino Unido", model: KOKORO, sid: 21, espeak: "en-gb" },
  { id: "bm_george", engine: "kokoro", name: "George", gender: "M", lang: "en", accent: "Reino Unido", model: KOKORO, sid: 26, espeak: "en-gb" },
  { id: "pf_dora", engine: "kokoro", name: "Dora", gender: "F", lang: "pt", accent: "Brasil", model: KOKORO, sid: 42, espeak: "pt-br" },
  { id: "pm_alex", engine: "kokoro", name: "Alex", gender: "M", lang: "pt", accent: "Brasil", model: KOKORO, sid: 43, espeak: "pt-br" },
  { id: "ff_siwis", engine: "kokoro", name: "Siwis", gender: "F", lang: "fr", accent: "Francia", model: KOKORO, sid: 30, espeak: "fr" },
  { id: "if_sara", engine: "kokoro", name: "Sara", gender: "F", lang: "it", accent: "Italia", model: KOKORO, sid: 35, espeak: "it" },
  { id: "im_nicola", engine: "kokoro", name: "Nicola", gender: "M", lang: "it", accent: "Italia", model: KOKORO, sid: 36, espeak: "it" },
];

/** Voces de un servidor TTS externo compatible con OpenAI (/v1/audio/speech): Chatterbox, IndexTTS, etc. */
function remoteVoices(): Voice[] {
  const url = process.env.TTS_REMOTE_URL;
  if (!url) return [];
  const list = (process.env.TTS_REMOTE_VOICES || "default").split(",").map((s) => s.trim()).filter(Boolean);
  const lang = process.env.TTS_REMOTE_LANG || "es";
  return list.map((v) => ({
    id: `remote:${v}`, engine: "remote", name: v, gender: "F", lang, accent: process.env.TTS_REMOTE_NAME || "Servidor externo", model: "", note: "GPU / alta expresividad",
  }));
}

export const isInstalled = (v: Voice) => v.engine === "remote" || fs.existsSync(path.join(MODELS_DIR, v.model));

export function listVoices(): Voice[] {
  return [...VOICES, ...remoteVoices()].map((v) => ({ ...v, installed: isInstalled(v) }));
}

export const voiceById = (id: string) => listVoices().find((v) => v.id === id);

/* ---------- descarga de modelos ---------- */
const installing = new Map<string, Promise<void>>();

export function installModel(model: string): Promise<void> {
  if (fs.existsSync(path.join(MODELS_DIR, model))) return Promise.resolve();
  const running = installing.get(model);
  if (running) return running;
  const p = (async () => {
    fs.mkdirSync(MODELS_DIR, { recursive: true });
    const url = `https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/${model}.tar.bz2`;
    console.log(`[tts] descargando ${url}`);
    const res = await fetch(url);
    if (!res.ok || !res.body) throw new Error(`Descarga fallida (${res.status}) ${url}`);
    const tmp = path.join(MODELS_DIR, `${model}.tar.bz2`);
    fs.writeFileSync(tmp, Buffer.from(await res.arrayBuffer()));
    await new Promise<void>((resolve, reject) => {
      const tar = spawn("tar", ["-xjf", tmp, "-C", MODELS_DIR], { windowsHide: true });
      tar.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`tar salió con código ${code}`))));
      tar.on("error", reject);
    });
    fs.rmSync(tmp, { force: true });
    console.log(`[tts] modelo listo: ${model}`);
  })().finally(() => installing.delete(model));
  installing.set(model, p);
  return p;
}

/* ---------- motores locales ---------- */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const engines = new Map<string, Promise<any>>();

function engineKey(v: Voice) {
  return v.engine === "kokoro" ? `kokoro:${v.espeak}` : `piper:${v.model}`;
}

function createEngine(v: Voice) {
  const dir = path.join(MODELS_DIR, v.model);
  const numThreads = Math.max(2, Math.min(8, Number(process.env.TTS_THREADS) || 4));
  if (v.engine === "kokoro") {
    const english = v.espeak?.startsWith("en");
    const kokoro: Record<string, string> = {
      model: path.join(dir, "model.onnx"),
      voices: path.join(dir, "voices.bin"),
      tokens: path.join(dir, "tokens.txt"),
      dataDir: path.join(dir, "espeak-ng-data"),
      lang: v.espeak ?? "es",
    };
    if (english) kokoro.lexicon = path.join(dir, v.espeak === "en-gb" ? "lexicon-gb-en.txt" : "lexicon-us-en.txt");
    return sherpa.OfflineTts.createAsync({ model: { kokoro, numThreads, debug: false }, maxNumSentences: 1 });
  }
  const onnx = fs.readdirSync(dir).find((f) => f.endsWith(".onnx"));
  if (!onnx) throw new Error(`No hay .onnx en ${dir}`);
  return sherpa.OfflineTts.createAsync({
    model: {
      vits: { model: path.join(dir, onnx), tokens: path.join(dir, "tokens.txt"), dataDir: path.join(dir, "espeak-ng-data") },
      numThreads,
      debug: false,
    },
    maxNumSentences: 1,
  });
}

function getEngine(v: Voice) {
  const key = engineKey(v);
  let e = engines.get(key);
  if (!e) {
    // máximo 2 motores en memoria (Kokoro ocupa ~350 MB)
    if (engines.size >= 2) engines.delete(engines.keys().next().value!);
    const created = Promise.resolve().then(() => createEngine(v));
    engines.set(key, created);
    created.catch(() => engines.delete(key));
    e = created;
  }
  return e;
}

/** Una cola: el TTS usa todos los núcleos, mejor una síntesis a la vez. */
let queue: Promise<unknown> = Promise.resolve();
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

export const EMOTION_SPEED: Record<string, number> = {
  excited: 1.08, happy: 1.03, neutral: 1, serious: 0.96, mysterious: 0.92, calm: 0.93, sad: 0.9,
};

/** Normaliza texto para locución (números, símbolos). */
function prepText(text: string) {
  return text.replace(/\s+/g, " ").replace(/%/g, " por ciento").replace(/&/g, " y ").trim();
}

export async function synthesize(voiceId: string, text: string, speed: number, outFile: string): Promise<{ seconds: number }> {
  const v = voiceById(voiceId);
  if (!v) throw new Error(`Voz desconocida: ${voiceId}`);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const clean = v.lang === "es" ? prepText(text) : text.trim();
  if (!clean) throw new Error("Texto vacío");

  if (v.engine === "remote") {
    const res = await fetch(process.env.TTS_REMOTE_URL!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: process.env.TTS_REMOTE_MODEL || "tts-1", input: clean, voice: v.name, response_format: "wav", speed }),
    });
    if (!res.ok) throw new Error(`Servidor TTS respondió ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(outFile, buf);
    return { seconds: wavSeconds(buf) };
  }

  if (!isInstalled(v)) await installModel(v.model);
  return enqueue(async () => {
    const tts = await getEngine(v);
    const audio = await tts.generateAsync({ text: clean, sid: v.sid ?? 0, speed });
    sherpa.writeWave(outFile, { samples: audio.samples, sampleRate: audio.sampleRate });
    return { seconds: audio.samples.length / audio.sampleRate };
  });
}

export function wavSeconds(buf: Buffer): number {
  // busca el chunk "data" y usa byteRate del chunk "fmt "
  let off = 12, byteRate = 0, dataLen = 0;
  while (off + 8 <= buf.length) {
    const id = buf.toString("ascii", off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === "fmt ") byteRate = buf.readUInt32LE(off + 16);
    if (id === "data") { dataLen = Math.min(size, buf.length - off - 8); break; }
    off += 8 + size + (size % 2);
  }
  return byteRate ? dataLen / byteRate : 0;
}
