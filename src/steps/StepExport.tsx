import React, { useEffect, useRef, useState } from "react";
import { sceneSeconds, type Aspect } from "../../shared/spec";
import type { StepProps } from "../App";
import { api, type Job } from "../api";
import { Preview } from "../Preview";

export function StepExport({ project, update, replace, flush }: StepProps) {
  const spec = project.spec!;
  const [voicing, setVoicing] = useState<{ done: number; total: number } | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState("");
  const [guide, setGuide] = useState(true);
  const poll = useRef<number | undefined>(undefined);

  const missing = spec.scenes.filter((s) => !s.audio);
  const total = spec.scenes.reduce((a, s) => a + sceneSeconds(s), 0);

  const voiceAll = async (force = false) => {
    setError("");
    await flush();
    const todo = force ? spec.scenes : missing;
    setVoicing({ done: 0, total: todo.length });
    try {
      for (let i = 0; i < todo.length; i++) {
        await api.voiceover(project.id, todo[i].id);
        setVoicing({ done: i + 1, total: todo.length });
      }
      replace(await api.get(project.id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setVoicing(null);
    }
  };

  // Generar la locución automáticamente al entrar si falta
  useEffect(() => {
    if (missing.length && !voicing) voiceAll();
    return () => window.clearInterval(poll.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const exportVideo = async (quality: "draft" | "hd") => {
    setError("");
    try {
      await flush();
      const j = await api.render(project.id, spec.aspect, quality);
      setJob(j);
      window.clearInterval(poll.current);
      poll.current = window.setInterval(async () => {
        const s = await api.job(j.id);
        setJob(s);
        if (s.status === "done" || s.status === "error") {
          window.clearInterval(poll.current);
          if (s.status === "error") setError(s.error ?? "Error al renderizar");
          else replace(await api.get(project.id));
        }
      }, 1500);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const setAspect = (aspect: Aspect) => update({ spec: { ...spec, aspect } });
  const rendering = job && (job.status === "queued" || job.status === "bundling" || job.status === "rendering");

  return (
    <div className="step-body">
      <div className="step-head">
        <h2>5 · Vista previa y exportación</h2>
        <p>La locución se genera escena por escena en tu CPU. Revisa el video y expórtalo en MP4 (H.264) listo para redes.</p>
      </div>
      <div className="two-col export">
        <div>
          <Preview spec={spec} maxHeight={spec.aspect === "9:16" ? 560 : 420} safeZone={guide && spec.aspect === "9:16"} />
          {voicing && (
            <div className="progress">
              <div style={{ width: `${(voicing.done / Math.max(1, voicing.total)) * 100}%` }} />
              <span>Generando voz… escena {Math.min(voicing.done + 1, voicing.total)} de {voicing.total}</span>
            </div>
          )}
        </div>
        <div className="side">
          <div className="card">
            <b>{spec.title}</b>
            <small className="muted">{spec.scenes.length} escenas · {Math.round(total)} s · voz {project.voice.voiceId}</small>
            <div className="row">
              <button className="btn sm" onClick={() => voiceAll(false)} disabled={!!voicing || !missing.length}>
                {missing.length ? `Generar voz (${missing.length})` : "✓ Voz lista"}
              </button>
              <button className="btn sm" onClick={() => voiceAll(true)} disabled={!!voicing}>↻ Regenerar toda la voz</button>
            </div>
          </div>
          <div className="card">
            <label className="label">Formato</label>
            <div className="tabs">
              {(["16:9", "9:16", "1:1"] as Aspect[]).map((a) => (
                <button key={a} className={`tab ${spec.aspect === a ? "on" : ""}`} onClick={() => setAspect(a)}>
                  {a === "16:9" ? "16:9 YouTube" : a === "9:16" ? "9:16 Reels/TikTok" : "1:1 Feed"}
                </button>
              ))}
            </div>
            {spec.aspect === "9:16" && (
              <label className="check"><input type="checkbox" checked={guide} onChange={(e) => setGuide(e.target.checked)} /> Mostrar lo que tapa la app (solo vista previa)</label>
            )}
            <label className="check"><input type="checkbox" checked={spec.captions} onChange={(e) => update({ spec: { ...spec, captions: e.target.checked } })} /> Subtítulos quemados en el video</label>
          </div>
          <div className="card">
            <b>Exportar</b>
            <div className="row">
              <button className="btn" onClick={() => exportVideo("draft")} disabled={!!rendering || !!voicing}>Borrador rápido (½ res.)</button>
              <button className="btn primary" onClick={() => exportVideo("hd")} disabled={!!rendering || !!voicing}>Exportar MP4 HD</button>
            </div>
            {missing.length > 0 && !voicing && <small className="warn">Hay {missing.length} escenas sin voz: se exportarán mudas.</small>}
            {job && (
              <div className="progress">
                <div style={{ width: `${Math.round(job.progress * 100)}%` }} />
                <span>
                  {job.status === "queued" && "En cola…"}
                  {job.status === "bundling" && "Preparando el motor de render (la primera vez tarda ~1 min)…"}
                  {job.status === "rendering" && `Renderizando ${Math.round(job.progress * 100)}%`}
                  {job.status === "done" && "¡Listo!"}
                  {job.status === "error" && "Falló el render"}
                </span>
              </div>
            )}
            {job?.url && (
              <a className="btn primary" href={job.url} download>⤓ Descargar MP4</a>
            )}
            <a className="link" href={`/api/projects/${project.id}/srt`} download>Descargar subtítulos .srt</a>
          </div>
          {error && <div className="error">{error}</div>}
          {project.renders.length > 0 && (
            <div className="card">
              <b>Exportaciones</b>
              {project.renders.map((r) => (
                <a key={r.file} className="link" href={`/files/${project.id}/renders/${r.file}`} download>
                  {r.file} <small className="muted">{new Date(r.createdAt).toLocaleString()}</small>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
