import React, { useMemo, useState } from "react";
import {
  ACCESSORIES, ACTIONS, CAMERAS, EMOTIONS, KINDS, PLACEMENTS, POSITIONS, PROPS, SETTINGS, TIMES, TRANSITIONS,
  sceneSeconds, type Aspect, type Character, type Scene, type VideoSpec,
} from "../../shared/spec";
import type { StepProps } from "../App";
import { api } from "../api";
import { Preview } from "../Preview";
import { DirectorReview } from "./DirectorReview";

const L: Record<string, string> = {
  city: "Ciudad", forest: "Bosque", space: "Espacio", ocean: "Océano", desert: "Desierto", mountains: "Montañas", room: "Habitación",
  office: "Oficina", lab: "Laboratorio", farm: "Granja", snow: "Nieve", abstract: "Abstracto", day: "Día", sunset: "Atardecer", night: "Noche",
  static: "Fija", orbit: "Órbita", dolly_in: "Acercar", dolly_out: "Alejar", pan_left: "Paneo izq.", pan_right: "Paneo der.", crane_up: "Grúa", closeup: "Primer plano",
  idle: "Quieto", talk: "Habla", walk: "Camina", run: "Corre", wave: "Saluda", jump: "Salta", dance: "Baila", think: "Piensa", celebrate: "Celebra", sad: "Triste", point: "Señala",
  person: "Persona", child: "Niño/a", dog: "Perro", cat: "Gato", bird: "Pájaro", robot: "Robot", mascot: "Mascota", monster: "Monstruo",
  far_left: "Extremo izq.", left: "Izquierda", center: "Centro", right: "Derecha", far_right: "Extremo der.", back: "Fondo",
  neutral: "Neutral", happy: "Alegre", excited: "Emocionado", serious: "Serio", mysterious: "Misterioso", calm: "Calmado",
  fade: "Fundido", cut: "Corte", wipe: "Barrido", zoom: "Zoom", none: "Ninguno", hat: "Sombrero", cap: "Gorra", glasses: "Gafas", bow: "Moño",
  crown: "Corona", scarf: "Bufanda", headphones: "Audífonos", scattered: "Dispersos", background: "Al fondo", floating: "Flotando", around: "Alrededor",
};
const lab = (k: string) => L[k] ?? k;

function Select<T extends string>({ value, options, onChange }: { value: T; options: readonly T[]; onChange: (v: T) => void }) {
  return (
    <select className="input sm" value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => <option key={o} value={o}>{lab(o)}</option>)}
    </select>
  );
}

export function StepScript({ project, update, replace, go, flush }: StepProps) {
  const [busy, setBusy] = useState<"" | "gen" | "rev">("");
  const [error, setError] = useState("");
  const [instruction, setInstruction] = useState("");
  const [open, setOpen] = useState<string | null>("s1");
  const [autoReview, setAutoReview] = useState(true);
  const [kick, setKick] = useState(0);
  const [reviewing, setReviewing] = useState(false);
  const [guide, setGuide] = useState(true);
  const spec = project.spec;

  const generate = async () => {
    if (spec && !confirm("Se generará un guion nuevo y reemplazará el actual. ¿Continuar?")) return;
    setBusy("gen");
    setError("");
    try {
      await flush();
      replace(await api.script(project.id, {
        scriptMode: project.scriptMode, userScript: project.userScript, notes: project.notes,
        durationSec: project.durationSec, answers: project.answers, language: project.language,
      }));
      if (autoReview) setKick((k) => k + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };
  const revise = async () => {
    if (!instruction.trim()) return;
    setBusy("rev");
    setError("");
    try {
      await flush();
      replace(await api.revise(project.id, instruction));
      setInstruction("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  const setSpec = (s: VideoSpec) => update({ spec: s });
  const setScene = (i: number, patch: Partial<Scene>) => {
    if (!spec) return;
    const scenes = spec.scenes.slice();
    const narrationChanged = patch.narration !== undefined && patch.narration !== scenes[i].narration;
    scenes[i] = { ...scenes[i], ...patch, ...(narrationChanged ? { audio: undefined, audioSec: undefined } : {}) };
    setSpec({ ...spec, scenes });
  };
  const setChar = (i: number, patch: Partial<Character>) => {
    if (!spec) return;
    const characters = spec.characters.slice();
    characters[i] = { ...characters[i], ...patch };
    setSpec({ ...spec, characters });
  };
  const moveScene = (i: number, d: number) => {
    if (!spec) return;
    const scenes = spec.scenes.slice();
    const j = i + d;
    if (j < 0 || j >= scenes.length) return;
    [scenes[i], scenes[j]] = [scenes[j], scenes[i]];
    setSpec({ ...spec, scenes });
  };
  const removeScene = (i: number) => spec && setSpec({ ...spec, scenes: spec.scenes.filter((_, k) => k !== i) });
  const addScene = () => {
    if (!spec) return;
    const last = spec.scenes[spec.scenes.length - 1];
    const id = `s${Date.now().toString(36)}`;
    setSpec({ ...spec, scenes: [...spec.scenes, { ...last, id, narration: "Nueva escena.", onScreenText: "", audio: undefined, audioSec: undefined }] });
    setOpen(id);
  };

  const total = useMemo(() => (spec ? spec.scenes.reduce((a, s) => a + sceneSeconds(s), 0) : 0), [spec]);
  const words = project.userScript.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="step-body">
      <div className="step-head">
        <h2>4 · Guion, personajes y escenas</h2>
        <p>Deja que el agente lo escriba a partir de tus respuestas, o pega tu propio guion y el agente lo convierte en escenas animadas.</p>
      </div>

      <div className="card">
        <div className="tabs">
          <button className={`tab ${project.scriptMode === "suggest" ? "on" : ""}`} onClick={() => update({ scriptMode: "suggest" })}>✨ Que lo sugiera el agente</button>
          <button className={`tab ${project.scriptMode === "own" ? "on" : ""}`} onClick={() => update({ scriptMode: "own" })}>✍️ Lo escribo yo</button>
        </div>
        {project.scriptMode === "own" ? (
          <>
            <textarea className="input" rows={6} placeholder="Pega o escribe aquí la narración completa del video…" value={project.userScript}
              onChange={(e) => update({ userScript: e.target.value })} />
            <small className="muted">{words} palabras ≈ {Math.round(words / 2.5)} s de locución</small>
          </>
        ) : (
          <div className="row">
            <label className="label inline">Duración aprox. {project.durationSec} s</label>
            <input type="range" min={15} max={180} step={5} value={project.durationSec} onChange={(e) => update({ durationSec: +e.target.value })} />
          </div>
        )}
        <label className="label">Tema, personajes o detalles extra (opcional)</label>
        <input className="input" placeholder="Ej.: la protagonista es Lía, una abeja con gafas; el final invita a cuidar las flores"
          value={project.notes} onChange={(e) => update({ notes: e.target.value })} />
        <div className="row between">
          <label className="check"><input type="checkbox" checked={autoReview} onChange={(e) => setAutoReview(e.target.checked)} /> Revisión del director al terminar (el agente mira cada escena y corrige)</label>
          <button className="btn primary" onClick={generate} disabled={!!busy || reviewing || (project.scriptMode === "own" && !words)}>
            {busy === "gen" ? <><span className="spin" /> Escribiendo guion y storyboard…</> : spec ? "↻ Regenerar guion" : "Generar guion y storyboard →"}
          </button>
        </div>
        {error && <div className="error">{error}</div>}
      </div>

      {spec && (
        <div className="two-col script">
          <div>
            <div className="card">
              <label className="label">Título</label>
              <input className="input" value={spec.title} onChange={(e) => setSpec({ ...spec, title: e.target.value })} />
              <small className="muted">{spec.summary}</small>
            </div>

            <div className="card">
              <div className="row between"><b>Personajes</b><small className="muted">{spec.characters.length}</small></div>
              <div className="chars">
                {spec.characters.map((c, i) => (
                  <div key={c.id} className="char">
                    <input className="input sm" value={c.name} onChange={(e) => setChar(i, { name: e.target.value })} />
                    <Select value={c.kind} options={KINDS} onChange={(v) => setChar(i, { kind: v })} />
                    <Select value={c.accessory} options={ACCESSORIES} onChange={(v) => setChar(i, { accessory: v })} />
                    <input type="color" value={c.color} onChange={(e) => setChar(i, { color: e.target.value })} title="Color principal" />
                    <input type="color" value={c.accent} onChange={(e) => setChar(i, { accent: e.target.value })} title="Color secundario" />
                    <small className="muted">{c.description}</small>
                  </div>
                ))}
              </div>
            </div>

            <div className="row between">
              <b>Escenas · {spec.scenes.length} · ~{Math.round(total)} s</b>
              <button className="btn sm" onClick={addScene}>＋ Escena</button>
            </div>
            {spec.scenes.map((s, i) => (
              <div key={s.id} className={`scene ${open === s.id ? "open" : ""}`}>
                <div className="scene-head" onClick={() => setOpen(open === s.id ? null : s.id)}>
                  <span className="num">{i + 1}</span>
                  <span className="scene-txt">{s.narration}</span>
                  <small className="muted">{lab(s.setting)} · {sceneSeconds(s).toFixed(1)} s</small>
                </div>
                {open === s.id && (
                  <div className="scene-body">
                    <label className="label">Narración</label>
                    <textarea className="input" rows={3} value={s.narration} onChange={(e) => setScene(i, { narration: e.target.value })} />
                    <label className="label">Texto en pantalla</label>
                    <input className="input" value={s.onScreenText} onChange={(e) => setScene(i, { onScreenText: e.target.value })} />
                    <div className="grid4">
                      <div><label className="label">Escenario</label><Select value={s.setting} options={SETTINGS} onChange={(v) => setScene(i, { setting: v })} /></div>
                      <div><label className="label">Hora</label><Select value={s.timeOfDay} options={TIMES} onChange={(v) => setScene(i, { timeOfDay: v })} /></div>
                      <div><label className="label">Cámara</label><Select value={s.camera} options={CAMERAS} onChange={(v) => setScene(i, { camera: v })} /></div>
                      <div><label className="label">Emoción</label><Select value={s.emotion} options={EMOTIONS} onChange={(v) => setScene(i, { emotion: v })} /></div>
                      <div><label className="label">Transición</label><Select value={s.transition} options={TRANSITIONS} onChange={(v) => setScene(i, { transition: v })} /></div>
                    </div>
                    <label className="label">Personajes en escena</label>
                    {spec.characters.map((c) => {
                      const sc = s.characters.find((x) => x.id === c.id);
                      const toggle = () =>
                        setScene(i, {
                          characters: sc ? s.characters.filter((x) => x.id !== c.id) : [...s.characters, { id: c.id, action: "idle", position: "center", speaking: false }],
                        });
                      const patchSc = (p: Partial<NonNullable<typeof sc>>) =>
                        setScene(i, { characters: s.characters.map((x) => (x.id === c.id ? { ...x, ...p } : x)) });
                      return (
                        <div key={c.id} className="row tight">
                          <label className="check"><input type="checkbox" checked={!!sc} onChange={toggle} /> {c.name}</label>
                          {sc && (
                            <>
                              <Select value={sc.action} options={ACTIONS} onChange={(v) => patchSc({ action: v })} />
                              <Select value={sc.position} options={POSITIONS} onChange={(v) => patchSc({ position: v })} />
                              <label className="check"><input type="checkbox" checked={sc.speaking} onChange={(e) => patchSc({ speaking: e.target.checked })} /> habla</label>
                            </>
                          )}
                        </div>
                      );
                    })}
                    <label className="label">Props</label>
                    {s.props.map((p, k) => (
                      <div key={k} className="row tight">
                        <Select value={p.kind} options={PROPS} onChange={(v) => setScene(i, { props: s.props.map((x, j) => (j === k ? { ...x, kind: v } : x)) })} />
                        <input className="input sm num-in" type="number" min={1} max={12} value={p.count}
                          onChange={(e) => setScene(i, { props: s.props.map((x, j) => (j === k ? { ...x, count: Math.max(1, Math.min(12, +e.target.value)) } : x)) })} />
                        <Select value={p.placement} options={PLACEMENTS} onChange={(v) => setScene(i, { props: s.props.map((x, j) => (j === k ? { ...x, placement: v } : x)) })} />
                        <button className="icon-btn" onClick={() => setScene(i, { props: s.props.filter((_, j) => j !== k) })}>✕</button>
                      </div>
                    ))}
                    {s.props.length < 6 && (
                      <button className="btn sm" onClick={() => setScene(i, { props: [...s.props, { kind: "star", count: 3, placement: "floating" }] })}>＋ Prop</button>
                    )}
                    <div className="row end">
                      <button className="btn sm" onClick={() => moveScene(i, -1)}>↑</button>
                      <button className="btn sm" onClick={() => moveScene(i, 1)}>↓</button>
                      <button className="btn sm danger" onClick={() => removeScene(i)}>Eliminar escena</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="side sticky">
            <div className="label">Storyboard animado</div>
            <div className="tabs">
              {(["16:9", "9:16", "1:1"] as Aspect[]).map((a) => (
                <button key={a} className={`tab ${spec.aspect === a ? "on" : ""}`} onClick={() => setSpec({ ...spec, aspect: a })}>
                  {a === "16:9" ? "16:9" : a === "9:16" ? "9:16 Reels" : "1:1"}
                </button>
              ))}
            </div>
            <Preview spec={spec} maxHeight={spec.aspect === "9:16" ? 420 : 280} safeZone={guide && spec.aspect === "9:16"} />
            {spec.aspect === "9:16" && (
              <label className="check"><input type="checkbox" checked={guide} onChange={(e) => setGuide(e.target.checked)} /> Mostrar lo que tapa la app</label>
            )}
            <DirectorReview project={project} replace={replace} flush={flush} kick={kick} onBusy={setReviewing} />
            <div className="card">
              <b>Pídele cambios al agente</b>
              <textarea className="input" rows={3} placeholder="Ej.: que la escena 3 sea de noche en la ciudad y agrega un perro que acompañe a Lía"
                value={instruction} onChange={(e) => setInstruction(e.target.value)} />
              <button className="btn" onClick={revise} disabled={!!busy || reviewing || !instruction.trim()}>
                {busy === "rev" ? <><span className="spin" /> Aplicando…</> : "Aplicar cambios"}
              </button>
            </div>
            <button className="btn primary" onClick={() => go(5)}>Voz, vista previa y exportar →</button>
          </div>
        </div>
      )}
    </div>
  );
}
