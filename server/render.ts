import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import type { VideoSpec } from "../shared/spec";
import { PORT, ROOT } from "./paths";

/**
 * Render con Remotion (Chrome headless + FFmpeg incluidos en @remotion/renderer).
 * El bundle de webpack se hace una vez y se reutiliza.
 */
/**
 * Windows no puede lanzar ejecutables con rutas > 260 caracteres. Si el proyecto vive en una
 * carpeta muy profunda, copiamos Chrome headless a ~/.estudio-ia/chrome una sola vez.
 */
export function browserExecutable(): string | null {
  if (process.env.BROWSER_EXECUTABLE) return process.env.BROWSER_EXECUTABLE;
  if (process.platform !== "win32") return null;
  const srcDir = path.join(ROOT, "node_modules", ".remotion", "chrome-headless-shell", "win64", "chrome-headless-shell-win64");
  const exe = path.join(srcDir, "chrome-headless-shell.exe");
  if (exe.length < 240 || !fs.existsSync(exe)) return null;
  const dstDir = path.join(os.homedir(), ".estudio-ia", "chrome");
  const dst = path.join(dstDir, "chrome-headless-shell.exe");
  if (!fs.existsSync(dst)) {
    console.log(`[render] ruta de Chrome muy larga, copiando a ${dstDir}`);
    fs.cpSync(srcDir, dstDir, { recursive: true });
  }
  return dst;
}

let bundlePromise: Promise<string> | null = null;
let bundleStamp = 0;
/** Fecha del último cambio en el código del video: si cambió, se vuelve a empaquetar. */
function sourceStamp(): number {
  let max = 0;
  for (const dir of ["remotion", "shared"]) {
    for (const e of fs.readdirSync(path.join(ROOT, dir), { recursive: true, withFileTypes: true })) {
      if (e.isFile()) max = Math.max(max, fs.statSync(path.join(e.parentPath, e.name)).mtimeMs);
    }
  }
  return max;
}
export function getBundle() {
  const stamp = sourceStamp();
  if (stamp !== bundleStamp) {
    bundlePromise = null;
    bundleStamp = stamp;
  }
  bundlePromise ??= bundle({
    entryPoint: path.join(ROOT, "remotion", "index.tsx"),
    onProgress: (p) => p % 25 === 0 && console.log(`[render] bundle ${p}%`),
  }).catch((e) => {
    bundlePromise = null;
    throw e;
  });
  return bundlePromise;
}

export interface RenderJob {
  id: string;
  projectId: string;
  status: "queued" | "bundling" | "rendering" | "done" | "error";
  progress: number;
  file?: string; // ruta /files/...
  error?: string;
  startedAt: number;
}

export const jobs = new Map<string, RenderJob>();

export const QUALITY = {
  draft: { scale: 0.5, crf: 28 },
  hd: { scale: 1, crf: 20 },
} as const;

let renderQueue: Promise<unknown> = Promise.resolve();

export function startRender(projectId: string, spec: VideoSpec, outDir: string, quality: keyof typeof QUALITY): RenderJob {
  const id = `${projectId}-${Date.now()}`;
  const job: RenderJob = { id, projectId, status: "queued", progress: 0, startedAt: Date.now() };
  jobs.set(id, job);
  const run = async () => {
    try {
      job.status = "bundling";
      const serveUrl = await getBundle();
      const inputProps = { spec, assetBase: `http://localhost:${PORT}` };
      const browser = browserExecutable();
      const composition = await selectComposition({ serveUrl, id: "Video", inputProps, chromiumOptions: { gl: "angle" }, browserExecutable: browser });
      fs.mkdirSync(outDir, { recursive: true });
      const name = `${slug(spec.title)}-${spec.aspect.replace(":", "x")}-${quality}-${Date.now()}.mp4`;
      const out = path.join(outDir, name);
      job.status = "rendering";
      await renderMedia({
        serveUrl,
        composition,
        codec: "h264",
        outputLocation: out,
        inputProps,
        crf: QUALITY[quality].crf,
        scale: QUALITY[quality].scale,
        imageFormat: "jpeg",
        jpegQuality: 90,
        chromiumOptions: { gl: "angle" },
        browserExecutable: browser,
        concurrency: Math.max(1, Math.min(4, Math.floor(os.cpus().length / 2))),
        timeoutInMilliseconds: 120_000,
        onProgress: ({ progress }) => {
          job.progress = progress;
        },
      });
      job.status = "done";
      job.progress = 1;
      job.file = name;
    } catch (e) {
      job.status = "error";
      job.error = e instanceof Error ? e.message : String(e);
      console.error("[render]", e);
    }
  };
  renderQueue = renderQueue.then(run);
  return job;
}

const slug = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "video";

/** Subtítulos .srt a partir de la narración y la duración de cada escena. */
export function buildSrt(spec: VideoSpec, sceneSeconds: (s: VideoSpec["scenes"][number]) => number): string {
  let t = 0;
  const lines: string[] = [];
  const fmt = (s: number) => {
    const ms = Math.round(s * 1000);
    const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), sec = Math.floor((ms % 60000) / 1000);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`;
  };
  spec.scenes.forEach((s, i) => {
    const d = sceneSeconds(s);
    lines.push(`${i + 1}\n${fmt(t + 0.1)} --> ${fmt(t + d - 0.3)}\n${s.narration}\n`);
    t += d;
  });
  return lines.join("\n");
}
