import React, { useRef, useState } from "react";
import { api, shrinkImage, type Project } from "../api";

const MAX = 6;

/** Fotos de referencia: lugares, objetos, personas, productos o la marca. El agente las mira al preguntar y al escribir. */
export function References({ project, update, replace }: {
  project: Project;
  update: (p: Partial<Project>) => void;
  replace: (p: Project) => void;
}) {
  const refs = project.references ?? [];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const add = async (files: FileList | File[]) => {
    setError("");
    setBusy(true);
    try {
      let p = project;
      for (const file of Array.from(files).filter((f) => f.type.startsWith("image/")).slice(0, MAX - refs.length)) {
        const data = await shrinkImage(file);
        p = await api.addReference(project.id, data, "");
      }
      replace(p);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async (id: string) => replace(await api.removeReference(project.id, id));
  const setNote = (id: string, note: string) =>
    update({ references: refs.map((r) => (r.id === id ? { ...r, note } : r)) });

  return (
    <div className="card">
      <div className="row between">
        <b>📎 Referencias (opcional)</b>
        <small className="muted">{refs.length}/{MAX}</small>
      </div>
      <small className="muted">
        Sube fotos de lugares, objetos, personas, tu producto o tu marca. El agente las mira y copia colores, formas y ambiente
        con las piezas del estilo elegido. Escribe qué es cada una.
      </small>
      <div className="refs">
        {refs.map((r, i) => (
          <div key={r.id} className="ref">
            <img src={r.url} alt={`Referencia ${i + 1}`} />
            <button className="icon-btn" title="Quitar" onClick={() => remove(r.id)}>✕</button>
            <input className="input sm" placeholder="¿Qué es? Ej.: mi perro Toby" value={r.note}
              onChange={(e) => setNote(r.id, e.target.value)} />
          </div>
        ))}
        {refs.length < MAX && (
          <button
            className={`ref add ${drag ? "drag" : ""}`}
            disabled={busy}
            onClick={() => input.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}
          >
            {busy ? <span className="spin" /> : <>＋<small>Arrastra o elige fotos</small></>}
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && add(e.target.files)} />
      {error && <div className="error">{error}</div>}
    </div>
  );
}
