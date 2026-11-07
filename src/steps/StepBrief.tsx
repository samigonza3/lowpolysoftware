import React, { useState } from "react";
import type { StepProps } from "../App";
import { api } from "../api";

export function StepBrief({ project, update, replace, go }: StepProps) {
  const [ideas, setIdeas] = useState<{ title: string; logline: string }[]>([]);
  const [busy, setBusy] = useState<"" | "ideas" | "questions">("");
  const [error, setError] = useState("");

  const run = async (kind: "ideas" | "questions") => {
    setBusy(kind);
    setError("");
    try {
      if (kind === "ideas") {
        const r = await api.ideas(project.style, project.idea, project.language);
        setIdeas(r.ideas);
      } else {
        replace(await api.questions(project.id, project.idea));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  const answered = project.questions.filter((q) => project.answers[q.id]?.trim()).length;

  return (
    <div className="step-body">
      <div className="step-head">
        <h2>2 · ¿Qué quieres ver en el video?</h2>
        <p>Escribe la idea con tus palabras (o pide sugerencias). Luego el agente te hará unas preguntas para entenderla bien.</p>
      </div>

      <label className="label">Tu idea</label>
      <textarea
        className="input"
        rows={3}
        placeholder="Ej.: Un video para niños que explique cómo las abejas hacen la miel, con una abeja simpática como guía."
        value={project.idea}
        onChange={(e) => update({ idea: e.target.value })}
      />
      <div className="row">
        <button className="btn" onClick={() => run("ideas")} disabled={!!busy}>
          {busy === "ideas" ? <span className="spin" /> : "✨"} Sugiérame ideas
        </button>
        <button className="btn primary" onClick={() => run("questions")} disabled={!!busy || !project.idea.trim()}>
          {busy === "questions" ? <><span className="spin" /> El agente está pensando…</> : project.questions.length ? "↻ Volver a preguntar" : "Que el agente me pregunte →"}
        </button>
      </div>
      {error && <div className="error">{error}</div>}

      {ideas.length > 0 && (
        <div className="ideas">
          {ideas.map((i) => (
            <button key={i.title} className="idea" onClick={() => { update({ idea: `${i.title}: ${i.logline}` }); setIdeas([]); }}>
              <b>{i.title}</b>
              <small>{i.logline}</small>
            </button>
          ))}
        </div>
      )}

      {project.questions.length > 0 && (
        <div className="questions">
          <div className="agent-bubble">
            <span className="avatar">◆</span>
            <p>Para que el video quede como lo imaginas, cuéntame un poco más. Elige una opción o escribe tu respuesta.</p>
          </div>
          {project.questions.map((q) => (
            <div key={q.id} className="question">
              <b>{q.question}</b>
              <div className="chips">
                {q.options.map((o) => (
                  <button key={o} className={`chip ${project.answers[q.id] === o ? "on" : ""}`}
                    onClick={() => update({ answers: { ...project.answers, [q.id]: o } })}>
                    {o}
                  </button>
                ))}
              </div>
              <input className="input" placeholder="Otra respuesta…" value={project.answers[q.id] ?? ""}
                onChange={(e) => update({ answers: { ...project.answers, [q.id]: e.target.value } })} />
            </div>
          ))}
          <div className="row end">
            <small className="muted">{answered}/{project.questions.length} respondidas (puedes dejar alguna en blanco)</small>
            <button className="btn primary" onClick={() => go(3)}>Elegir la voz →</button>
          </div>
        </div>
      )}
    </div>
  );
}
