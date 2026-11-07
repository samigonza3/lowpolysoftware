import React, { useMemo } from "react";
import { demoSpec } from "../../shared/templates";
import type { StyleId } from "../../shared/spec";
import type { StepProps } from "../App";
import { Preview } from "../Preview";

export function StepTemplate({ project, templates, update, go }: StepProps) {
  const spec = useMemo(() => demoSpec(project.style as StyleId), [project.style]);
  const choose = (id: string) => {
    const t = templates.find((x) => x.id === id);
    const patch: Parameters<typeof update>[0] = { style: id };
    // si ya hay guion, se conserva y solo cambia el estilo (y la paleta del estilo)
    if (project.spec && t) patch.spec = { ...project.spec, style: t.id, palette: t.palette };
    update(patch);
  };
  return (
    <div className="step-body">
      <div className="step-head">
        <h2>1 · Elige el estilo del video</h2>
        <p>La plantilla define el look: materiales, luces, cámara y tipografía. Puedes cambiarla después sin perder el guion.</p>
      </div>
      <div className="two-col">
        <div className="template-grid">
          {templates.map((t) => (
            <button key={t.id} className={`template-card ${project.style === t.id ? "selected" : ""}`} onClick={() => choose(t.id)}>
              <div className="tc-swatch" style={{ background: t.gradient }}>
                <span>{t.name}</span>
              </div>
              <div className="tc-body">
                <b>{t.tagline}</b>
                <small>{t.description}</small>
              </div>
            </button>
          ))}
        </div>
        <div className="side">
          <div className="label">Vista previa en vivo</div>
          <Preview spec={spec} autoPlay maxHeight={300} />
          <button className="btn primary" onClick={() => go(2)}>Continuar con {templates.find((t) => t.id === project.style)?.name} →</button>
        </div>
      </div>
    </div>
  );
}
