import React, { useEffect, useMemo, useRef, useState } from "react";
import { lintSpec } from "../../shared/checks";
import { api, type Project, type ReviewJob } from "../api";

/**
 * Chequeos en vivo + "Revisión del director": el agente renderiza un fotograma por escena,
 * los mira y corrige el guion técnico (hasta 2 rondas).
 */
export function DirectorReview({
  project, replace, flush, kick, onBusy,
}: {
  project: Project;
  replace: (p: Project) => void;
  flush: () => Promise<void>;
  kick: number; // cambia → arranca una revisión automática
  onBusy: (b: boolean) => void;
}) {
  const spec = project.spec!;
  const lint = useMemo(() => lintSpec(spec, { targetSec: project.scriptMode === "suggest" ? project.durationSec : undefined }), [spec, project.scriptMode, project.durationSec]);
  const errors = lint.filter((i) => i.level === "error");
  const [job, setJob] = useState<ReviewJob | null>(null);
  const [err, setErr] = useState("");
  const poll = useRef<number | undefined>(undefined);
  const running = job?.status === "running";

  const start = async () => {
    setErr("");
    try {
      await flush();
      const j = await api.review(project.id);
      setJob(j);
      onBusy(true);
      window.clearInterval(poll.current);
      poll.current = window.setInterval(async () => {
        try {
          const s = await api.reviewJob(j.id);
          setJob(s);
          if (s.status !== "running") {
            window.clearInterval(poll.current);
            onBusy(false);
            if (s.status === "error") setErr(s.error ?? "Falló la revisión");
            replace(await api.get(project.id));
          }
        } catch (e) {
          window.clearInterval(poll.current);
          onBusy(false);
          setErr((e as Error).message);
        }
      }, 2000);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  useEffect(() => {
    if (kick > 0) start();
  }, [kick]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => window.clearInterval(poll.current), []);

  const last = job?.rounds[job.rounds.length - 1];
  const stills = job?.finalStills ?? last?.stills ?? [];

  return (
    <div className="card">
      <div className="row between">
        <b>🎬 Revisión del director</b>
        <small className={errors.length ? "warn" : "muted"}>
          {errors.length ? `${errors.length} error(es)` : lint.length ? `${lint.length} aviso(s)` : "✓ chequeos ok"}
        </small>
      </div>
      {lint.length > 0 && (
        <ul className="lint">
          {lint.slice(0, 8).map((i, k) => (
            <li key={k} className={i.level}>
              {i.level === "error" ? "✕" : "!"} {i.scene ? <b>Esc. {i.scene}: </b> : null}{i.msg}
            </li>
          ))}
          {lint.length > 8 && <li className="muted">…y {lint.length - 8} más</li>}
        </ul>
      )}
      <small className="muted">
        El agente toma un fotograma de cada escena{spec.aspect === "9:16" ? " (con la zona que tapa la app marcada)" : ""}, los mira,
        califica el gancho y corrige lo que se vea mal. Tarda 2-4 min.
      </small>
      <button className="btn" onClick={start} disabled={running}>
        {running ? <><span className="spin" /> {job?.stage}…</> : "Revisar storyboard con el agente"}
      </button>
      {err && <div className="error">{err}</div>}
      {job && job.rounds.length > 0 && (
        <div className="review">
          {job.rounds.map((r) => (
            <div key={r.round} className="review-round">
              <div className="row between">
                <span>Ronda {r.round}</span>
                <span className={r.hookScore >= 7 ? "ok" : "warn"}>Gancho {r.hookScore}/10</span>
              </div>
              {r.problems.length === 0 ? (
                <small className="muted">Sin problemas visuales.</small>
              ) : (
                <ul className="lint">
                  {r.problems.map((p, k) => (
                    <li key={k}>
                      {p.scene ? <b>Esc. {p.scene}: </b> : null}{p.problem} <span className="muted">→ {p.fix}</span>
                    </li>
                  ))}
                </ul>
              )}
              {r.fixed && <small className="ok">✓ Correcciones aplicadas al guion</small>}
            </div>
          ))}
          {stills.length > 0 && (
            <>
              <div className="label">{job.finalStills ? "Así quedó" : "Lo que vio el agente"}</div>
              <div className={`stills ${spec.aspect === "9:16" ? "tall" : ""}`}>
                {stills.map((s) => (
                  <a key={s.url} href={s.url} target="_blank" rel="noreferrer" title={`Escena ${s.scene}`}>
                    <img src={s.url} alt={`Escena ${s.scene}`} />
                    <span>{s.scene}</span>
                  </a>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
