import React, { useEffect, useRef, useState } from "react";
import type { StepProps } from "../App";
import { api, type Voice } from "../api";

const LANGS: Record<string, string> = { es: "Español", en: "Inglés", pt: "Portugués", fr: "Francés", it: "Italiano" };
const SAMPLE: Record<string, string> = {
  es: "¡Hola! Soy la voz de tu próximo video. ¿Listos para una historia increíble?",
  en: "Hi there! I'm the voice of your next video. Ready for an amazing story?",
  pt: "Olá! Eu sou a voz do seu próximo vídeo. Prontos para uma história incrível?",
  fr: "Bonjour ! Je suis la voix de ta prochaine vidéo. Prêts pour une histoire incroyable ?",
  it: "Ciao! Sono la voce del tuo prossimo video. Pronti per una storia incredibile?",
};

export function StepVoice({ project, update, go }: StepProps) {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const audio = useRef<HTMLAudioElement | null>(null);
  const lang = project.language;
  const { voiceId, speed } = project.voice;

  const load = () => api.voices().then(setVoices).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const setVoice = (v: Voice) => {
    const voice = { engine: v.engine, voiceId: v.id, speed };
    update({ voice, language: v.lang, spec: project.spec ? { ...project.spec, voice, language: v.lang } : null });
  };
  const setSpeed = (s: number) => {
    const voice = { ...project.voice, speed: s };
    update({ voice, spec: project.spec ? { ...project.spec, voice } : null });
  };

  const play = async (v: Voice) => {
    setBusy(v.id);
    setError("");
    try {
      if (!v.installed) {
        await api.installVoice(v.id);
        await load();
      }
      const { url } = await api.preview(v.id, SAMPLE[v.lang] ?? SAMPLE.es, speed);
      audio.current?.pause();
      audio.current = new Audio(url);
      await audio.current.play();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  const shown = voices.filter((v) => v.lang === lang);
  return (
    <div className="step-body">
      <div className="step-head">
        <h2>3 · Elige la voz del narrador</h2>
        <p>
          Voces open source que corren en tu PC: <b>Kokoro-82M</b> (Apache 2.0) y <b>Piper</b> (acentos latinos, se descargan al primer uso ~60 MB).
          El idioma de la voz define el idioma del guion.
        </p>
      </div>
      <div className="tabs">
        {Object.entries(LANGS).map(([k, label]) => (
          <button key={k} className={`tab ${lang === k ? "on" : ""}`} onClick={() => update({ language: k })}>{label}</button>
        ))}
      </div>
      {error && <div className="error">{error}</div>}
      <div className="voice-grid">
        {shown.map((v) => (
          <div key={v.id} className={`voice ${voiceId === v.id ? "selected" : ""}`} onClick={() => setVoice(v)}>
            <div className="v-top">
              <span className={`gender ${v.gender}`}>{v.gender === "F" ? "♀" : "♂"}</span>
              <div>
                <b>{v.name}</b>
                <small>{v.accent}</small>
              </div>
              <button className="icon-btn play" title={v.installed ? "Escuchar" : "Descargar y escuchar"}
                onClick={(e) => { e.stopPropagation(); play(v); }} disabled={!!busy}>
                {busy === v.id ? <span className="spin" /> : v.installed ? "▶" : "⤓"}
              </button>
            </div>
            <div className="v-meta">
              <span className="tag">{v.engine === "kokoro" ? "Kokoro" : v.engine === "piper" ? "Piper" : "Externo"}</span>
              {v.note && <small>{v.note}</small>}
            </div>
          </div>
        ))}
      </div>
      <div className="row">
        <label className="label inline">Velocidad {speed.toFixed(2)}×</label>
        <input type="range" min={0.8} max={1.25} step={0.01} value={speed} onChange={(e) => setSpeed(+e.target.value)} />
        <small className="muted">El agente ajusta un poco la velocidad según la emoción de cada escena.</small>
      </div>
      <div className="row end">
        <button className="btn primary" onClick={() => go(4)} disabled={!shown.some((v) => v.id === voiceId)}>Ir al guion →</button>
      </div>
    </div>
  );
}
