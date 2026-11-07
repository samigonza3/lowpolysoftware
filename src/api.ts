import type { VideoSpec, VoiceChoice } from "../shared/spec";
import type { Template } from "../shared/templates";

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

export interface ProjectSummary { id: string; title: string; style: string; updatedAt: string; step: number; renders: number }

export interface Voice {
  id: string;
  engine: "kokoro" | "piper" | "remote";
  name: string;
  gender: "F" | "M";
  lang: string;
  accent: string;
  note?: string;
  installed?: boolean;
}

export interface ReviewRound {
  round: number;
  lint: { level: "error" | "warn"; code: string; scene?: number; msg: string }[];
  hookScore: number;
  ok: boolean;
  problems: { scene: number; problem: string; fix: string }[];
  stills: { scene: number; url: string }[];
  fixed: boolean;
}
export interface ReviewJob {
  id: string;
  status: "running" | "done" | "error";
  stage: string;
  rounds: ReviewRound[];
  finalStills?: { scene: number; url: string }[];
  error?: string;
}

export interface Job { id: string; status: string; progress: number; url?: string; error?: string }

async function req<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data as T;
}

export const api = {
  status: () => req<{ llm: string; model: string; voices: number; remoteTts: boolean }>("GET", "/api/status"),
  templates: () => req<Template[]>("GET", "/api/templates"),
  projects: () => req<ProjectSummary[]>("GET", "/api/projects"),
  create: (style: string) => req<Project>("POST", "/api/projects", { style }),
  get: (id: string) => req<Project>("GET", `/api/projects/${id}`),
  save: (id: string, patch: Partial<Project>) => req<Project>("PUT", `/api/projects/${id}`, patch),
  remove: (id: string) => req<{ ok: true }>("DELETE", `/api/projects/${id}`),
  ideas: (style: string, hint: string, language: string) =>
    req<{ ideas: { title: string; logline: string }[] }>("POST", "/api/agent/ideas", { style, hint, language }),
  questions: (id: string, idea: string) => req<Project>("POST", `/api/projects/${id}/questions`, { idea }),
  script: (id: string, body: Partial<Project> & { language: string }) => req<Project>("POST", `/api/projects/${id}/script`, body),
  revise: (id: string, instruction: string) => req<Project>("POST", `/api/projects/${id}/revise`, { instruction }),
  voices: () => req<Voice[]>("GET", "/api/voices"),
  installVoice: (id: string) => req<{ ok: true }>("POST", `/api/voices/${encodeURIComponent(id)}/install`),
  preview: (voiceId: string, text: string, speed: number) => req<{ url: string }>("POST", "/api/voices/preview", { voiceId, text, speed }),
  voiceover: (id: string, sceneId: string) =>
    req<{ sceneId: string; audio: string; audioSec: number }>("POST", `/api/projects/${id}/voiceover/${sceneId}`),
  render: (id: string, aspect: string, quality: string) => req<Job>("POST", `/api/projects/${id}/render`, { aspect, quality }),
  job: (id: string) => req<Job>("GET", `/api/jobs/${id}`),
  review: (id: string) => req<ReviewJob>("POST", `/api/projects/${id}/review`),
  reviewJob: (id: string) => req<ReviewJob>("GET", `/api/review/${id}`),
};
