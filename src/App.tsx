import React, { useCallback, useEffect, useRef, useState } from "react";
import type { Template } from "../shared/templates";
import { api, type Project, type ProjectSummary } from "./api";
import { StepTemplate } from "./steps/StepTemplate";
import { StepBrief } from "./steps/StepBrief";
import { StepVoice } from "./steps/StepVoice";
import { StepScript } from "./steps/StepScript";
import { StepExport } from "./steps/StepExport";

export interface StepProps {
  project: Project;
  templates: Template[];
  /** Cambia el proyecto localmente y lo guarda (con debounce). */
  update: (patch: Partial<Project>) => void;
  /** Reemplaza el proyecto con lo que devolvió el servidor. */
  replace: (p: Project) => void;
  go: (step: number) => void;
  /** Guarda ya mismo los cambios pendientes. */
  flush: () => Promise<void>;
}

const STEPS = [
  { n: 1, label: "Plantilla", hint: "Estilo visual" },
  { n: 2, label: "Idea", hint: "El agente pregunta" },
  { n: 3, label: "Voz", hint: "Narrador" },
  { n: 4, label: "Guion", hint: "Escenas y personajes" },
  { n: 5, label: "Exportar", hint: "Vista previa y MP4" },
];

export function App() {
  const [status, setStatus] = useState<{ llm: string; model: string; voices: number } | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const pending = useRef<Partial<Project>>({});

  const refresh = useCallback(() => api.projects().then(setProjects).catch(() => {}), []);
  useEffect(() => {
    // el API puede tardar unos segundos en arrancar: reintentar hasta que responda
    let stop = false;
    let retry: number | undefined;
    const initialId = new URLSearchParams(location.search).get("p");
    const boot = async () => {
      try {
        const [s, t] = await Promise.all([api.status(), api.templates()]);
        if (stop) return;
        setStatus(s);
        setTemplates(t);
        refresh();
        if (initialId) api.get(initialId).then(setProject).catch(() => {});
      } catch {
        setStatus({ llm: "offline", model: "", voices: 0 });
        retry = window.setTimeout(boot, 2000);
      }
    };
    boot();
    return () => {
      stop = true;
      window.clearTimeout(retry);
    };
  }, [refresh]);

  const booted = templates.length > 0;
  useEffect(() => {
    if (!booted) return;
    const url = project ? `?p=${project.id}` : location.pathname;
    history.replaceState(null, "", url);
  }, [project?.id, booted]); // eslint-disable-line react-hooks/exhaustive-deps

  const projectId = project?.id;
  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    const patch = pending.current;
    pending.current = {};
    if (projectId && Object.keys(patch).length) await api.save(projectId, patch);
  }, [projectId]);

  const update = useCallback((patch: Partial<Project>) => {
    setProject((p) => (p ? { ...p, ...patch } : p));
    pending.current = { ...pending.current, ...patch };
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setProject((p) => {
        if (p) {
          const body = pending.current;
          pending.current = {};
          if (Object.keys(body).length) api.save(p.id, body).catch(console.error);
        }
        return p;
      });
    }, 500);
  }, []);

  const replace = useCallback((p: Project) => {
    pending.current = {};
    window.clearTimeout(timer.current);
    setProject(p);
  }, []);

  const go = useCallback((step: number) => update({ step }), [update]);

  const newProject = async (style = "lowpoly") => {
    const p = await api.create(style);
    setProject(p);
  };

  const home = async () => {
    await flush();
    setProject(null);
    refresh();
  };

  const props: StepProps | null = project ? { project, templates, update, replace, go, flush } : null;
  const step = project?.step ?? 1;
  const unlocked = (n: number) => {
    if (!project) return false;
    if (n <= 3) return true;
    if (n === 4) return Boolean(project.idea);
    return Boolean(project.spec);
  };

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={home}>
          <span className="logo">◆</span> Estudio IA
        </button>
        {project && <span className="crumb">{project.spec?.title || project.idea || "Nuevo video"}</span>}
        <div className="spacer" />
        {status && (
          <span className={`pill ${status.llm === "none" || status.llm === "offline" ? "bad" : "ok"}`} title={status.model}>
            Agente: {status.llm === "cli" ? "Claude Code" : status.llm === "api" ? "Claude API" : status.llm === "offline" ? "servidor apagado" : "no configurado"}
          </span>
        )}
      </header>

      {!project && (
        <main className="home">
          <section className="hero">
            <h1>Crea videos animados con un agente</h1>
            <p>Elige un estilo, cuéntale tu idea al agente, escoge una voz open source y exporta en MP4. Todo corre en tu computador.</p>
            <button className="btn primary big" onClick={() => newProject()}>＋ Nuevo video</button>
          </section>
          {projects.length > 0 && (
            <section>
              <h2>Tus proyectos</h2>
              <div className="project-grid">
                {projects.map((p) => {
                  const t = templates.find((x) => x.id === p.style);
                  return (
                    <div key={p.id} className="project-card" onClick={() => api.get(p.id).then(setProject)}>
                      <div className="swatch" style={{ background: t?.gradient }} />
                      <div className="pc-body">
                        <strong>{p.title}</strong>
                        <small>{t?.name} · paso {p.step}/5 {p.renders ? `· ${p.renders} export.` : ""}</small>
                        <small>{new Date(p.updatedAt).toLocaleString()}</small>
                      </div>
                      <button
                        className="icon-btn"
                        title="Eliminar"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`¿Eliminar "${p.title}"? Se borran su audio y sus exportaciones.`)) api.remove(p.id).then(refresh);
                        }}
                      >✕</button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </main>
      )}

      {props && (
        <div className="wizard">
          <nav className="steps">
            {STEPS.map((s) => (
              <button key={s.n} className={`step ${step === s.n ? "active" : ""} ${step > s.n ? "done" : ""}`} disabled={!unlocked(s.n)} onClick={() => go(s.n)}>
                <span className="num">{step > s.n ? "✓" : s.n}</span>
                <span>
                  <b>{s.label}</b>
                  <small>{s.hint}</small>
                </span>
              </button>
            ))}
          </nav>
          <main className="panel">
            {step === 1 && <StepTemplate {...props} />}
            {step === 2 && <StepBrief {...props} />}
            {step === 3 && <StepVoice {...props} />}
            {step === 4 && <StepScript {...props} />}
            {step === 5 && <StepExport {...props} />}
          </main>
        </div>
      )}
    </div>
  );
}
