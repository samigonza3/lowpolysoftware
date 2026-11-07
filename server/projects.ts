import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { VideoSpec, VoiceChoice } from "../shared/spec";
import { PROJECTS_DIR } from "./paths";

/** Estado completo del asistente; se guarda tal cual en data/projects/<id>/project.json */
export interface Project {
  id: string;
  createdAt: string;
  updatedAt: string;
  step: number;
  style: string;
  idea: string;
  questions: { id: string; question: string; options: string[] }[];
  answers: Record<string, string>;
  scriptMode: "suggest" | "own";
  userScript: string;
  notes: string;
  durationSec: number;
  language: string;
  voice: VoiceChoice;
  spec: VideoSpec | null;
  renders: { file: string; createdAt: string; aspect: string }[];
}

const file = (id: string) => path.join(PROJECTS_DIR, safeId(id), "project.json");
export const projectDir = (id: string) => path.join(PROJECTS_DIR, safeId(id));

function safeId(id: string) {
  if (!/^[a-z0-9-]{6,40}$/.test(id)) throw new Error("id de proyecto inválido");
  return id;
}

export function createProject(style: string): Project {
  const now = new Date().toISOString();
  const p: Project = {
    id: crypto.randomUUID().slice(0, 13),
    createdAt: now, updatedAt: now, step: 1, style, idea: "", questions: [], answers: {},
    scriptMode: "suggest", userScript: "", notes: "", durationSec: 45, language: "es", voice: { engine: "kokoro", voiceId: "ef_dora", speed: 1 }, spec: null, renders: [],
  };
  saveProject(p);
  return p;
}

export function saveProject(p: Project) {
  p.updatedAt = new Date().toISOString();
  fs.mkdirSync(projectDir(p.id), { recursive: true });
  fs.writeFileSync(file(p.id), JSON.stringify(p, null, 2));
  return p;
}

export function loadProject(id: string): Project {
  const f = file(id);
  if (!fs.existsSync(f)) throw Object.assign(new Error("Proyecto no encontrado"), { status: 404 });
  return JSON.parse(fs.readFileSync(f, "utf8"));
}

export function listProjects() {
  if (!fs.existsSync(PROJECTS_DIR)) return [];
  return fs
    .readdirSync(PROJECTS_DIR)
    .filter((d) => fs.existsSync(path.join(PROJECTS_DIR, d, "project.json")))
    .map((d) => {
      const p = JSON.parse(fs.readFileSync(path.join(PROJECTS_DIR, d, "project.json"), "utf8")) as Project;
      return { id: p.id, title: p.spec?.title || p.idea || "Sin título", style: p.style, updatedAt: p.updatedAt, step: p.step, renders: p.renders.length };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function deleteProject(id: string) {
  fs.rmSync(projectDir(id), { recursive: true, force: true });
}
