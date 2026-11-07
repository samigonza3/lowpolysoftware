import React, { useMemo } from "react";
import * as THREE from "three";
import type { Palette } from "../../shared/spec";
import { Ball, Box, Cone, rng, shade, useKit } from "../kit";
import { MODELS } from "./Props";

interface EnvProps {
  setting: string;
  time: string;
  pal: Palette;
  frame: number;
  fps: number;
  sceneId: string;
  wide: number;
  /** Textura de la biblioteca para el suelo (opcional). */
  groundTex?: THREE.Texture | null;
}

/** Color de cielo según hora del día y estilo. */
export function skyColor(pal: Palette, time: string, style: string, setting: string) {
  if (setting === "space") return style === "neon" ? "#07001a" : "#0b1026";
  if (style === "neon") return time === "day" ? shade(pal.sky, 0.1) : pal.sky;
  const base = new THREE.Color(pal.sky);
  if (time === "sunset") base.lerp(new THREE.Color("#ff9e6d"), 0.55);
  if (time === "night") base.lerp(new THREE.Color("#0d1b3d"), 0.82);
  return "#" + base.getHexString();
}

export function groundColor(pal: Palette, setting: string) {
  switch (setting) {
    case "desert": return "#e9c46a";
    case "snow": return "#f1f5f9";
    case "ocean": return "#1e88e5";
    case "city": return "#8d99ae";
    case "room": case "office": case "lab": return shade(pal.primary, 0.45);
    default: return pal.ground;
  }
}

const Stars: React.FC<{ count: number; seed: string; spread?: number }> = ({ count, seed, spread = 60 }) => {
  const geo = useMemo(() => {
    const r = rng(seed);
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (r() - 0.5) * spread * 2;
      pos[i * 3 + 1] = r() * spread * 0.6 + 2;
      pos[i * 3 + 2] = -15 - r() * 30;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, [count, seed, spread]);
  return (
    <points geometry={geo}>
      <pointsMaterial color="#ffffff" size={0.18} sizeAttenuation />
    </points>
  );
};

const Snowfall: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const r = rng("snow");
  const flakes = Array.from({ length: 70 }).map(() => [(r() - 0.5) * 24, r() * 10, -r() * 10, r()]);
  const t = frame / fps;
  return (
    <group>
      {flakes.map(([x, y, z, s], i) => (
        <Ball key={i} r={0.05 + s * 0.04} color="#ffffff" position={[x + Math.sin(t + i) * 0.3, 10 - ((y + t * (0.8 + s)) % 10), z]} />
      ))}
    </group>
  );
};

const Ring: React.FC<{ kind: string; n: number; pal: Palette; night: boolean; t: number; seed: string; radius?: number; wide: number }> = ({
  kind, n, pal, night, t, seed, wide,
}) => {
  const r = rng(seed);
  const Model = MODELS[kind];
  return (
    <group>
      {Array.from({ length: n }).map((_, i) => {
        const x = (i / (n - 1) - 0.5) * wide * 3 + (r() - 0.5) * 1.5;
        const z = -10 - r() * 8;
        const s = 1.2 + r() * 1.3;
        return (
          <group key={i} position={[x, 0, z]} scale={s}>
            <Model pal={pal} t={t} night={night} seed={r()} />
          </group>
        );
      })}
    </group>
  );
};

export const Environment: React.FC<EnvProps> = ({ setting, time, pal, frame, fps, sceneId, wide, groundTex }) => {
  const kit = useKit();
  const t = frame / fps;
  const night = time === "night" || kit.id === "neon";
  const ground = groundColor(pal, setting);
  const seed = `${sceneId}-${setting}`;

  const floor =
    setting === "space" ? null : (
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -10]} receiveShadow={kit.shadows}>
        <planeGeometry args={[120, 60, kit.lowpoly ? 24 : 1, kit.lowpoly ? 12 : 1]} />
        {groundTex ? (
          // la textura manda; el color de la paleta la tiñe un poco para que combine con el estilo
          <meshStandardMaterial map={groundTex} color={new THREE.Color(ground).lerp(new THREE.Color("#ffffff"), 0.6)} roughness={0.95} />
        ) : kit.id === "flat2d" ? (
          <meshBasicMaterial color={ground} />
        ) : (
          <meshStandardMaterial color={ground} flatShading={kit.lowpoly} roughness={setting === "ocean" ? 0.25 : 1}
            emissive={kit.id === "neon" ? ground : "#000"} emissiveIntensity={kit.id === "neon" ? 0.25 : 0} />
        )}
      </mesh>
    );

  let decor: React.ReactNode = null;
  switch (setting) {
    case "forest":
      decor = <><Ring kind="tree" n={9} pal={pal} night={night} t={t} seed={seed} wide={wide} /><Ring kind="pine" n={6} pal={pal} night={night} t={t} seed={seed + "p"} wide={wide} /></>;
      break;
    case "city":
      decor = <Ring kind="building" n={10} pal={pal} night={night} t={t} seed={seed} wide={wide} />;
      break;
    case "mountains":
      decor = <Ring kind="mountain" n={5} pal={pal} night={night} t={t} seed={seed} wide={wide} />;
      break;
    case "desert":
      decor = (
        <>
          <Ring kind="cactus" n={6} pal={pal} night={night} t={t} seed={seed} wide={wide} />
          {[-12, 0, 12].map((x, i) => <Ball key={i} r={5} color={shade("#e9c46a", -0.1)} position={[x, -3.2, -16]} scale={[2, 1, 1]} />)}
        </>
      );
      break;
    case "snow":
      decor = <><Ring kind="pine" n={9} pal={{ ...pal, ground: "#2d6a4f" }} night={night} t={t} seed={seed} wide={wide} /><Snowfall frame={frame} fps={fps} /></>;
      break;
    case "farm":
      decor = (
        <>
          <group position={[-6, 0, -9]} scale={2}>{React.createElement(MODELS.house, { pal: { ...pal, primary: "#c1121f", accent: "#780000" }, t, night, seed: 0.3 })}</group>
          {Array.from({ length: 14 }).map((_, i) => (
            <group key={i} position={[-10 + i * 1.6, 0, -5]}>
              <Box size={[0.12, 0.8, 0.12]} position={[0, 0.4, 0]} color="#a47148" />
              <Box size={[1.6, 0.1, 0.06]} position={[0, 0.55, 0]} color="#a47148" />
            </group>
          ))}
          <Ring kind="tree" n={4} pal={pal} night={night} t={t} seed={seed} wide={wide} />
        </>
      );
      break;
    case "ocean":
      decor = (
        <>
          {Array.from({ length: 8 }).map((_, i) => (
            <Ball key={i} r={0.6} color="#bde0fe" opacity={0.5} position={[-12 + i * 3.5, 0.02 + Math.sin(t * 2 + i) * 0.08, -4 - (i % 3) * 3]} scale={[2.5, 0.08, 0.6]} />
          ))}
          <group position={[8, -0.3, -14]}><Ball r={3} color="#e9c46a" scale={[1.6, 0.5, 1]} /><group position={[0, 1, 0]} scale={2}>{React.createElement(MODELS.tree, { pal, t, night, seed: 0.5 })}</group></group>
        </>
      );
      break;
    case "room":
    case "office":
    case "lab": {
      const wall = setting === "lab" ? "#e0f2f1" : setting === "office" ? shade(pal.secondary, 0.65) : shade(pal.primary, 0.6);
      decor = (
        <>
          <Box size={[40, 14, 0.3]} position={[0, 7, -8]} color={wall} />
          <Box size={[0.3, 14, 20]} position={[-14, 7, 0]} color={shade(wall, -0.08)} />
          <Box size={[3.2, 2, 0.1]} position={[4, 4.5, -7.8]} color={night ? "#1b263b" : "#bde0fe"} />
          {setting === "office" && <group position={[-4, 0, -6]}>{React.createElement(MODELS.table, { pal, t, night, seed: 0 })}<group position={[0, 0.85, 0]}>{React.createElement(MODELS.computer, { pal, t, night, seed: 0 })}</group></group>}
          {setting === "lab" && [0, 1, 2].map((i) => (
            <group key={i} position={[-6 + i * 1.2, 0.95, -6]}>
              <Cone r={0.35} h={0.7} position={[0, 0.35, 0]} color={[pal.accent, pal.secondary, pal.primary][i]} opacity={0.75} />
            </group>
          ))}
          {setting === "lab" && <group position={[-5, 0, -6]}>{React.createElement(MODELS.table, { pal, t, night, seed: 0 })}</group>}
          {setting === "room" && <group position={[-5, 0, -6]}>{React.createElement(MODELS.lamp, { pal, t, night, seed: 0 })}</group>}
        </>
      );
      break;
    }
    case "space":
      decor = (
        <>
          <group position={[-8, 6, -18]} scale={3}>{React.createElement(MODELS.planet, { pal, t, night, seed: 0 })}</group>
          <Ball r={2.5} color="#adb5bd" position={[10, 4, -22]} />
          <Ball r={20} color={shade(pal.secondary, -0.2)} position={[0, -21, -6]} />
        </>
      );
      break;
    default: {
      // abstract: formas flotantes suaves
      const r = rng(seed);
      decor = (
        <>
          {Array.from({ length: 10 }).map((_, i) => {
            const c = [pal.primary, pal.secondary, pal.accent][i % 3];
            const x = (r() - 0.5) * wide * 2.6, y = 1 + r() * 7, z = -6 - r() * 10;
            const rot = t * (0.2 + r() * 0.5);
            return i % 2 ? (
              <Ball key={i} r={0.6 + r()} color={c} position={[x, y + Math.sin(t + i) * 0.3, z]} />
            ) : (
              <Cone key={i} r={0.7} h={1.2} sides={kit.lowpoly ? 4 : 3} color={c} position={[x, y, z]} rotation={[rot, rot, 0]} />
            );
          })}
        </>
      );
    }
  }

  return (
    <group>
      {floor}
      {kit.id === "neon" && setting !== "space" && (
        <gridHelper args={[120, 60, pal.primary, pal.secondary]} position={[0, 0.01, -10]} />
      )}
      {(night || setting === "space") && <Stars count={setting === "space" ? 600 : 250} seed={seed} />}
      {night && setting !== "space" && setting !== "room" && setting !== "office" && setting !== "lab" && (
        <group position={[wide * 0.9, 9, -25]} scale={2.2}>{React.createElement(MODELS.moon, { pal, t, night, seed: 0 })}</group>
      )}
      {time === "day" && !night && ["forest", "farm", "desert", "mountains", "ocean", "abstract"].includes(setting) && kit.id !== "neon" && (
        <group position={[-wide * 0.9, 10, -25]} scale={2}>{React.createElement(MODELS.sun, { pal, t, night, seed: 0 })}</group>
      )}
      {decor}
    </group>
  );
};

export const Lights: React.FC<{ time: string; setting: string }> = ({ time, setting }) => {
  const kit = useKit();
  if (kit.id === "flat2d") return null;
  const indoor = ["room", "office", "lab"].includes(setting);
  if (kit.id === "neon") {
    return (
      <>
        <ambientLight intensity={0.35} />
        <pointLight position={[-6, 5, 4]} intensity={60} color="#ff2a6d" />
        <pointLight position={[6, 5, 4]} intensity={60} color="#05d9e8" />
        <directionalLight position={[0, 8, 6]} intensity={0.6} color="#b388ff" />
      </>
    );
  }
  const sunColor = time === "sunset" ? "#ffb37a" : time === "night" ? "#9db4ff" : "#fff4e0";
  const sunI = time === "night" ? 0.7 : kit.id === "cartoon3d" ? 2.4 : 2;
  const sunPos: [number, number, number] = time === "sunset" ? [-8, 4, 6] : [6, 12, 8];
  return (
    <>
      <hemisphereLight args={[time === "night" ? "#30407a" : "#ffffff", time === "night" ? "#101020" : "#80705a", indoor ? 1.2 : time === "night" ? 0.5 : 0.9]} />
      <directionalLight
        position={sunPos}
        intensity={sunI}
        color={sunColor}
        castShadow={kit.shadows}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={10}
        shadow-camera-bottom={-4}
      />
      {kit.id === "cartoon3d" && <directionalLight position={[0, 5, -10]} intensity={1.6} color="#ffe2c4" />}
      {kit.id === "clay" && <directionalLight position={[-6, 6, 8]} intensity={0.6} color="#fff" />}
    </>
  );
};
