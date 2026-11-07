import React, { useEffect, useRef, useState } from "react";
import type { Asset, AssetType } from "../shared/library";
import { api, fileToBase64, loadLibrary, shrinkImage } from "./api";

/** Biblioteca de texturas de suelo y cielos 360°: catálogo de Poly Haven (CC0) + lo que suba el usuario. */
export function LibraryPanel({ textured }: { textured: boolean }) {
  const [lib, setLib] = useState<Asset[]>([]);
  const [tab, setTab] = useState<AssetType>("texture");
  const [busy, setBusy] = useState<string>("");
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    setLib(await loadLibrary(true));
    window.dispatchEvent(new Event("library-changed"));
  };
  useEffect(() => {
    loadLibrary().then(setLib).catch((e) => setError((e as Error).message));
  }, []);

  const install = async (id: string) => {
    setBusy(id);
    setError("");
    try {
      await api.installAsset(id);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };
  const upload = async (file: File) => {
    setBusy("upload");
    setError("");
    try {
      const hdr = /\.hdr$/i.test(file.name);
      // texturas a ≤2048 px; panorámicas JPG/PNG a ≤4096 px; los .hdr se suben tal cual
      const data = hdr ? await fileToBase64(file) : await shrinkImage(file, tab === "sky" ? 4096 : 2048);
      const label = name.trim() || file.name.replace(/\.[^.]+$/, "");
      await api.uploadAsset({ type: tab, name: label, description: label, data, mime: hdr ? "image/vnd.radiance" : "image/jpeg", filename: file.name });
      setName("");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };
  const remove = async (id: string) => {
    if (!confirm("¿Borrar este recurso de la biblioteca?")) return;
    await api.removeAsset(id);
    await refresh();
  };

  const items = lib.filter((a) => a.type === tab);
  const installed = lib.filter((a) => a.installed).length;

  return (
    <div className="card">
      <div className="row between">
        <b>🧱 Biblioteca: texturas y cielos 360°</b>
        <small className="muted">{installed} instalados</small>
      </div>
      {!textured && <small className="warn">El estilo de este proyecto (2D o neón) no usa texturas realistas.</small>}
      <small className="muted">Instala los que quieras: el agente los usará en las escenas donde combinen. Gratis y libres (Poly Haven, CC0).</small>
      <div className="tabs">
        <button className={`tab ${tab === "texture" ? "on" : ""}`} onClick={() => setTab("texture")}>Suelos</button>
        <button className={`tab ${tab === "sky" ? "on" : ""}`} onClick={() => setTab("sky")}>Cielos 360°</button>
      </div>
      <div className="assets">
        {items.map((a) => (
          <div key={a.id} className={`asset ${a.installed ? "on" : ""}`} title={a.description}>
            {a.thumb ? <img src={a.thumb} alt="" loading="lazy" /> : <div className="noimg">HDR</div>}
            <span>{a.name}</span>
            {a.installed ? (
              a.source === "upload" ? <button className="icon-btn" onClick={() => remove(a.id)}>✕</button> : <small className="ok">✓</small>
            ) : (
              <button className="btn sm" disabled={!!busy} onClick={() => install(a.id)}>
                {busy === a.id ? <span className="spin" /> : "Instalar"}
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="row tight">
        <input className="input sm" placeholder={tab === "texture" ? "Nombre: ej. baldosa de mi local" : "Nombre: ej. mi calle 360"}
          value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn sm" disabled={!!busy} onClick={() => input.current?.click()}>
          {busy === "upload" ? <span className="spin" /> : tab === "texture" ? "Subir textura" : "Subir panorámica"}
        </button>
      </div>
      <small className="muted">
        {tab === "texture" ? "JPG/PNG que se pueda repetir en mosaico (seamless)." : "Panorámica 360° equirectangular (2:1) en JPG/PNG o HDR."}
      </small>
      <input ref={input} type="file" hidden accept={tab === "sky" ? "image/*,.hdr" : "image/*"}
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upload(f); }} />
      {error && <div className="error">{error}</div>}
    </div>
  );
}

/** Hook para listar lo instalado en los selectores de cada escena. */
export function useInstalledLibrary() {
  const [lib, setLib] = useState<Asset[]>([]);
  useEffect(() => {
    const on = () => loadLibrary().then((l) => setLib(l.filter((a) => a.installed))).catch(() => {});
    on();
    window.addEventListener("library-changed", on);
    return () => window.removeEventListener("library-changed", on);
  }, []);
  return lib;
}
