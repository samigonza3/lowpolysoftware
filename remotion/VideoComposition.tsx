import React from "react";
import { AbsoluteFill, Easing, Series, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { ThreeCanvas } from "@remotion/three";
import { sceneFrames, type Scene, type VideoSpec } from "../shared/spec";
import { safeZoneFor, type SafeZone } from "../shared/safezone";
import { KITS, KitProvider } from "./kit";
import { World } from "./scene/World";

export interface VideoProps {
  spec: VideoSpec;
  /** Prefijo para las URLs de audio: "" en el navegador, "http://localhost:3210" al renderizar. */
  assetBase: string;
  /** Dibuja encima las zonas que tapa la interfaz de Reels/TikTok (solo vista previa y revisión). */
  showSafeZone?: boolean;
}

const FONT = '"Segoe UI Black","Segoe UI",system-ui,-apple-system,"Helvetica Neue",Arial,sans-serif';

const titleStyle = (style: string) => {
  switch (style) {
    case "neon":
      return { color: "#fff", textShadow: "0 0 18px #ff2a6d, 0 0 36px #05d9e8", fontStyle: "italic" as const };
    case "flat2d":
      return { color: "#fff", background: "#1d3557", padding: "0.15em 0.5em", borderRadius: 8 };
    case "cartoon3d":
      return { color: "#fff", textShadow: "0 6px 0 rgba(0,0,0,.25), 0 0 30px rgba(0,0,0,.25)", WebkitTextStroke: "3px #ff6b6b" };
    case "clay":
      return { color: "#fff8e7", textShadow: "0 5px 0 #b5651d", };
    default:
      return { color: "#fff", textShadow: "0 4px 18px rgba(0,0,0,.45)" };
  }
};

const TitleCard: React.FC<{ text: string; style: string; scale: number; safe: SafeZone; hook: boolean; dur: number }> = ({
  text, style, scale, safe, hook, dur,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  if (!text) return null;
  // El gancho entra de golpe en el frame 0 y se queda toda la escena; los demás títulos entran suave y salen a los 3 s.
  const s = hook
    ? spring({ frame, fps, config: { damping: 9, stiffness: 220 }, from: 0.6 })
    : spring({ frame: frame - 4, fps, config: { damping: 12 } });
  const out = hook
    ? interpolate(frame, [dur - 8, dur], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : interpolate(frame, [fps * 3, fps * 3.5], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill
      style={{
        alignItems: "center", justifyContent: "flex-start",
        paddingTop: safe.top * height + 12 * scale, paddingLeft: safe.left * width, paddingRight: safe.right * width,
      }}
    >
      <div
        style={{
          fontFamily: FONT, fontWeight: 900, fontSize: (hook ? 104 : 92) * scale, letterSpacing: -1, textAlign: "center",
          transform: `scale(${s}) translateY(${(1 - s) * -40}px)`, opacity: out, lineHeight: 1.05,
          ...titleStyle(style),
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

/** Subtítulos por bloques de ~7 palabras con la palabra activa resaltada. */
const Captions: React.FC<{ scene: Scene; style: string; scale: number; dur: number; safe: SafeZone; hook: boolean }> = ({
  scene, style, scale, dur, safe, hook,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const vertical = height > width;
  const words = scene.narration.split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  const speechFrames = Math.max(1, (scene.audioSec ? scene.audioSec * fps : dur - fps * 0.6));
  const weights = words.map((w) => w.length + 2 + (/[.,;:!?]$/.test(w) ? 4 : 0));
  const total = weights.reduce((a, b) => a + b, 0);
  let acc = 0;
  const starts = weights.map((w) => {
    const s = (acc / total) * speechFrames + (hook ? 0 : 4);
    acc += w;
    return s;
  });
  let current = 0;
  for (let i = 0; i < words.length; i++) if (frame >= starts[i]) current = i;
  const CH = vertical ? 5 : 7; // en vertical, bloques más cortos se leen mejor
  const chunk = Math.floor(current / CH);
  const shown = words.slice(chunk * CH, chunk * CH + CH);
  const accent = style === "neon" ? "#05d9e8" : style === "flat2d" ? "#ffb703" : "#ffd166";
  return (
    // Siempre dentro de la zona segura: en 9:16 queda por encima de la descripción, el audio y los botones de la app.
    <AbsoluteFill
      style={{
        justifyContent: "flex-end", alignItems: "center",
        paddingBottom: safe.bottom * height, paddingLeft: safe.left * width, paddingRight: safe.right * width,
      }}
    >
      <div
        style={{
          fontFamily: FONT, fontWeight: 800, fontSize: (vertical ? 60 : 54) * scale, textAlign: "center", lineHeight: 1.2,
          color: "#fff", background: "rgba(10,10,20,.55)", padding: `${14 * scale}px ${26 * scale}px`, borderRadius: 18 * scale,
        }}
      >
        {shown.map((w, i) => {
          const idx = chunk * CH + i;
          return (
            <span key={idx} style={{ color: idx === current ? accent : "#fff", transition: "none" }}>
              {w}{" "}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const SceneView: React.FC<{ scene: Scene; spec: VideoSpec; dur: number; assetBase: string; first: boolean }> = ({ scene, spec, dur, assetBase, first }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const kit = KITS[spec.style] ?? KITS.lowpoly;
  const vertical = height > width;
  const scale = Math.min(width, height) / 1080;
  const T = Math.round(fps * 0.4);
  const tr = first ? "cut" : scene.transition;
  const safe = safeZoneFor(width, height);
  // Escena 1 = gancho: sin fundido desde negro (el primer frame ya tiene imagen) y un "punch-in" de cámara.
  const pIn = first ? 1 : interpolate(frame, [0, T], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const punch = first ? interpolate(frame, [0, 10], [1.12, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }) : 1;
  const fadeOut = interpolate(frame, [dur - 6, dur], [1, 0.0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const wrap: React.CSSProperties =
    tr === "cut" ? {} :
    tr === "wipe" ? { clipPath: `inset(0 ${(1 - pIn) * 100}% 0 0)` } :
    tr === "zoom" ? { transform: `scale(${1.25 - pIn * 0.25})`, opacity: pIn } :
    { opacity: pIn };
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill style={{ ...wrap, opacity: (wrap.opacity as number ?? 1) * (scene.transition === "cut" ? 1 : fadeOut) }}>
        <AbsoluteFill style={{ transform: punch !== 1 ? `scale(${punch})` : undefined }}>
        <KitProvider value={kit}>
          <ThreeCanvas
            key={`${spec.style}-${width}x${height}`}
            width={width}
            height={height}
            orthographic={kit.ortho}
            shadows={kit.shadows}
            camera={kit.ortho ? { position: [0, 10, 30], zoom: 100, near: 0.1, far: 200 } : { position: [0, 3, 12], fov: 40 }}
            gl={{ antialias: true, preserveDrawingBuffer: true }}
          >
            <KitProvider value={kit}>
              <World scene={scene} characters={spec.characters} pal={spec.palette} style={spec.style} frame={frame} fps={fps} dur={dur} vertical={vertical} hook={first} />
            </KitProvider>
          </ThreeCanvas>
        </KitProvider>
        </AbsoluteFill>
        <TitleCard text={scene.onScreenText} style={spec.style} scale={scale} safe={safe} hook={first} dur={dur} />
        {spec.captions && <Captions scene={scene} style={spec.style} scale={scale} dur={dur} safe={safe} hook={first} />}
      </AbsoluteFill>
      {scene.audio ? <Audio src={assetBase + scene.audio} /> : null}
    </AbsoluteFill>
  );
};

/** Guía visual de lo que tapa la app (no se usa en el MP4 final). */
export const SafeZoneGuide: React.FC = () => {
  const { width, height } = useVideoConfig();
  const z = safeZoneFor(width, height);
  const scale = Math.min(width, height) / 1080;
  const band: React.CSSProperties = {
    position: "absolute", background: "rgba(255,40,80,.28)", border: `${3 * scale}px dashed rgba(255,80,110,.9)`,
    color: "#fff", fontFamily: FONT, fontWeight: 700, fontSize: 30 * scale, display: "flex", alignItems: "center",
    justifyContent: "center", textAlign: "center", textShadow: "0 2px 6px #000", boxSizing: "border-box",
  };
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ ...band, left: 0, right: 0, top: 0, height: z.top * height }}>Zona de la app (arriba)</div>
      <div style={{ ...band, left: 0, right: 0, bottom: 0, height: z.bottom * height }}>Zona de la app: descripción, audio, botones</div>
      <div style={{ ...band, right: 0, top: z.top * height, bottom: z.bottom * height, width: z.right * width, writingMode: "vertical-rl" }}>Botones</div>
    </AbsoluteFill>
  );
};

export const VideoComposition: React.FC<VideoProps> = ({ spec, assetBase, showSafeZone }) => {
  const { fps } = useVideoConfig();
  if (!spec.scenes.length) return <AbsoluteFill style={{ background: "#111" }} />;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Series>
        {spec.scenes.map((s, i) => {
          const dur = sceneFrames(s, fps);
          return (
            <Series.Sequence key={s.id + i} durationInFrames={dur} name={`${i + 1}. ${s.onScreenText || s.setting}`}>
              <SceneView scene={s} spec={spec} dur={dur} assetBase={assetBase} first={i === 0} />
            </Series.Sequence>
          );
        })}
      </Series>
      {showSafeZone ? <SafeZoneGuide /> : null}
    </AbsoluteFill>
  );
};
