import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { ImageInput } from "./llm";
import { loadProject, projectDir, saveProject, type Project } from "./projects";

export const MAX_REFERENCES = 6;

/** Guarda una foto de referencia (la UI ya la reduce a JPG de ≤1280 px). */
export function addReference(projectId: string, data: string, note: string) {
  const p = loadProject(projectId);
  const refs = p.references ?? [];
  if (refs.length >= MAX_REFERENCES) throw Object.assign(new Error(`Máximo ${MAX_REFERENCES} referencias`), { status: 400 });
  const buf = Buffer.from(data, "base64");
  if (buf.length > 6 * 1024 * 1024) throw Object.assign(new Error("Imagen muy grande"), { status: 400 });
  const id = crypto.randomBytes(4).toString("hex");
  const dir = path.join(projectDir(p.id), "refs");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${id}.jpg`), buf);
  p.references = [...refs, { id, url: `/files/${p.id}/refs/${id}.jpg`, note: note.trim() }];
  return saveProject(p);
}

export function removeReference(projectId: string, refId: string) {
  const p = loadProject(projectId);
  if (!/^[a-f0-9]{8}$/.test(refId)) throw Object.assign(new Error("id inválido"), { status: 400 });
  fs.rmSync(path.join(projectDir(p.id), "refs", `${refId}.jpg`), { force: true });
  p.references = (p.references ?? []).filter((r) => r.id !== refId);
  return saveProject(p);
}

/** Imágenes + texto que acompañan a los prompts del agente. */
export function referenceInputs(p: Project): { images: ImageInput[]; text: string } {
  const refs = (p.references ?? []).filter((r) => fs.existsSync(path.join(projectDir(p.id), "refs", `${r.id}.jpg`)));
  if (!refs.length) return { images: [], text: "" };
  return {
    images: refs.map((r) => ({ mediaType: "image/jpeg", data: fs.readFileSync(path.join(projectDir(p.id), "refs", `${r.id}.jpg`)).toString("base64") })),
    text: refs.map((r, i) => `- Referencia ${i + 1}: ${r.note || "(sin descripción)"}`).join("\n"),
  };
}
