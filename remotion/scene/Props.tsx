import React from "react";
import { spring } from "remotion";
import type { Palette } from "../../shared/spec";
import { Ball, Box, Capsule, Cone, Cyl, Torus, rng, shade, useKit } from "../kit";

interface PropCtx {
  pal: Palette;
  t: number;
  night: boolean;
  seed: number;
}

/** Cada prop es un modelito hecho de primitivas, ~1-2 unidades de alto. */
const MODELS: Record<string, React.FC<PropCtx>> = {
  tree: ({ pal, seed }) => (
    <group>
      <Cyl rt={0.12} rb={0.18} h={1} position={[0, 0.5, 0]} color="#7a5230" />
      <Ball r={0.75} color={shade(pal.ground, -0.15 + seed * 0.2)} position={[0, 1.4, 0]} />
      <Ball r={0.5} color={shade(pal.ground, -0.05)} position={[0.35, 1.8, 0.1]} />
    </group>
  ),
  pine: ({ pal }) => (
    <group>
      <Cyl rt={0.1} h={0.6} position={[0, 0.3, 0]} color="#6b4226" />
      <Cone r={0.8} h={1.2} position={[0, 1.1, 0]} color={shade(pal.ground, -0.35)} />
      <Cone r={0.6} h={1} position={[0, 1.7, 0]} color={shade(pal.ground, -0.3)} />
      <Cone r={0.4} h={0.8} position={[0, 2.2, 0]} color={shade(pal.ground, -0.25)} />
    </group>
  ),
  house: ({ pal, night }) => (
    <group>
      <Box size={[1.6, 1.2, 1.4]} position={[0, 0.6, 0]} color={shade(pal.primary, 0.35)} />
      <Cone r={1.25} h={0.9} sides={4} position={[0, 1.65, 0]} rotation={[0, Math.PI / 4, 0]} color={pal.accent} />
      <Box size={[0.35, 0.6, 0.05]} position={[0, 0.3, 0.71]} color={shade(pal.secondary, -0.3)} />
      <Box size={[0.35, 0.3, 0.05]} position={[-0.5, 0.75, 0.71]} color={night ? "#ffd166" : "#bde0fe"} glow={night} />
      <Box size={[0.35, 0.3, 0.05]} position={[0.5, 0.75, 0.71]} color={night ? "#ffd166" : "#bde0fe"} glow={night} />
    </group>
  ),
  building: ({ pal, night, seed }) => {
    const h = 2.5 + seed * 4;
    const rows = Math.floor(h / 0.6);
    return (
      <group>
        <Box size={[1.4, h, 1.4]} position={[0, h / 2, 0]} color={shade(pal.secondary, -0.2 + seed * 0.3)} />
        {Array.from({ length: rows }).map((_, r) =>
          [-0.35, 0.35].map((x) => (
            <Box key={`${r}${x}`} size={[0.3, 0.3, 0.04]} position={[x, 0.5 + r * 0.6, 0.71]}
              color={night && (r + Math.round(x * 10)) % 3 !== 0 ? "#ffe066" : shade(pal.sky, 0.3)} glow={night} />
          )),
        )}
      </group>
    );
  },
  rock: ({ pal }) => <Ball r={0.5} color={shade(pal.ground, -0.45)} position={[0, 0.25, 0]} scale={[1.3, 0.7, 1]} />,
  car: ({ pal, t }) => (
    <group>
      <Box size={[1.8, 0.5, 0.9]} position={[0, 0.45, 0]} color={pal.accent} />
      <Box size={[1, 0.4, 0.8]} position={[-0.1, 0.9, 0]} color={shade(pal.accent, 0.2)} />
      {[[-0.6, 0.45], [0.6, 0.45], [-0.6, -0.45], [0.6, -0.45]].map(([x, z], i) => (
        <Cyl key={i} rt={0.22} h={0.15} color="#222" position={[x, 0.22, z]} rotation={[Math.PI / 2, t * 6, 0]} />
      ))}
    </group>
  ),
  cloud: ({ t, seed }) => (
    <group position={[Math.sin(t * 0.3 + seed * 6) * 0.6, 0, 0]}>
      <Ball r={0.6} color="#ffffff" />
      <Ball r={0.45} color="#ffffff" position={[0.6, -0.1, 0]} />
      <Ball r={0.45} color="#ffffff" position={[-0.6, -0.1, 0]} />
    </group>
  ),
  sun: ({ t }) => (
    <group rotation={[0, 0, t * 0.3]}>
      <Ball r={0.8} color="#ffd166" glow />
      {Array.from({ length: 8 }).map((_, i) => (
        <Cone key={i} r={0.12} h={0.4} color="#ffb703" glow position={[Math.cos((i / 8) * Math.PI * 2) * 1.1, Math.sin((i / 8) * Math.PI * 2) * 1.1, 0]}
          rotation={[0, 0, (i / 8) * Math.PI * 2 - Math.PI / 2]} />
      ))}
    </group>
  ),
  moon: () => (
    <group>
      <Ball r={0.7} color="#f1f1e6" glow />
      <Ball r={0.15} color="#d6d6c8" position={[0.2, 0.2, 0.62]} />
    </group>
  ),
  star: ({ t, seed }) => (
    <group rotation={[0, t * 1.5 + seed, 0]} scale={1 + Math.sin(t * 4 + seed * 9) * 0.1}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Cone key={i} r={0.18} h={0.55} color="#ffd60a" glow
          position={[Math.sin((i / 5) * Math.PI * 2) * 0.28, Math.cos((i / 5) * Math.PI * 2) * 0.28, 0]}
          rotation={[0, 0, -(i / 5) * Math.PI * 2]} />
      ))}
      <Ball r={0.22} color="#ffd60a" glow />
    </group>
  ),
  heart: ({ t, pal }) => (
    <group scale={1 + Math.max(0, Math.sin(t * 6)) * 0.15} rotation={[0, 0, Math.PI]}>
      <Ball r={0.36} color={pal.accent} position={[-0.27, -0.05, 0]} />
      <Ball r={0.36} color={pal.accent} position={[0.27, -0.05, 0]} />
      <Cone r={0.62} h={0.72} color={pal.accent} position={[0, 0.38, 0]} scale={[1, 1, 0.6]} />
    </group>
  ),
  flower: ({ pal, seed }) => (
    <group>
      <Cyl rt={0.03} h={0.6} position={[0, 0.3, 0]} color="#4f772d" />
      {Array.from({ length: 6 }).map((_, i) => (
        <Ball key={i} r={0.1} color={seed > 0.5 ? pal.accent : pal.primary}
          position={[Math.cos((i / 6) * Math.PI * 2) * 0.13, 0.65, Math.sin((i / 6) * Math.PI * 2) * 0.13]} />
      ))}
      <Ball r={0.08} color="#ffd166" position={[0, 0.67, 0]} />
    </group>
  ),
  lightbulb: ({ t }) => (
    <group scale={1 + Math.sin(t * 5) * 0.05}>
      <Ball r={0.5} color="#fff3b0" glow position={[0, 0.6, 0]} />
      <Cyl rt={0.22} h={0.35} color="#9e9e9e" position={[0, 0, 0]} />
    </group>
  ),
  book: ({ pal }) => (
    <group rotation={[0.2, 0.4, 0]}>
      <Box size={[0.9, 0.15, 1.2]} color={pal.secondary} />
      <Box size={[0.85, 0.12, 1.15]} position={[0.03, 0, 0]} color="#fdfcdc" />
    </group>
  ),
  computer: ({ pal, t }) => (
    <group>
      <Box size={[1.4, 0.9, 0.08]} position={[0, 0.85, 0]} color="#2b2d42" />
      <Box size={[1.25, 0.75, 0.02]} position={[0, 0.85, 0.05]} color={Math.floor(t * 2) % 2 ? pal.secondary : shade(pal.secondary, 0.2)} glow />
      <Cyl rt={0.05} h={0.4} position={[0, 0.3, 0]} color="#555" />
      <Box size={[0.6, 0.05, 0.4]} position={[0, 0.1, 0]} color="#555" />
    </group>
  ),
  phone: ({ pal }) => (
    <group rotation={[0, 0.3, 0]}>
      <Box size={[0.55, 1, 0.08]} position={[0, 0.5, 0]} color="#1d1d1f" />
      <Box size={[0.47, 0.88, 0.02]} position={[0, 0.5, 0.05]} color={pal.primary} glow />
    </group>
  ),
  coin: ({ t, seed }) => (
    <group rotation={[0, t * 3 + seed * 5, 0]}>
      <Cyl rt={0.4} h={0.08} color="#ffc300" rotation={[Math.PI / 2, 0, 0]} />
    </group>
  ),
  gift: ({ pal }) => (
    <group>
      <Box size={[0.8, 0.7, 0.8]} position={[0, 0.35, 0]} color={pal.accent} />
      <Box size={[0.15, 0.72, 0.82]} position={[0, 0.35, 0]} color={pal.primary} />
      <Box size={[0.9, 0.12, 0.9]} position={[0, 0.72, 0]} color={pal.accent} />
    </group>
  ),
  rocket: ({ t, pal }) => (
    <group position={[0, Math.sin(t * 2) * 0.15, 0]}>
      <Capsule r={0.3} len={1} position={[0, 0.9, 0]} color="#f1faee" />
      <Cone r={0.3} h={0.45} position={[0, 1.75, 0]} color={pal.accent} />
      <Ball r={0.13} color={pal.secondary} position={[0, 1.05, 0.27]} />
      {[0, 1, 2].map((i) => (
        <Box key={i} size={[0.06, 0.4, 0.35]} color={pal.accent} position={[Math.cos((i / 3) * Math.PI * 2) * 0.3, 0.45, Math.sin((i / 3) * Math.PI * 2) * 0.3]}
          rotation={[0, -(i / 3) * Math.PI * 2, 0]} />
      ))}
      <Cone r={0.2} h={0.5 + Math.sin(t * 20) * 0.1} color="#ff9f1c" glow position={[0, 0.05, 0]} rotation={[Math.PI, 0, 0]} />
    </group>
  ),
  planet: ({ t, pal }) => (
    <group rotation={[0.4, t * 0.4, 0.2]}>
      <Ball r={0.8} color={pal.secondary} />
      <Torus r={1.2} tube={0.06} color={pal.primary} rotation={[Math.PI / 2, 0, 0]} />
    </group>
  ),
  globe: ({ t, pal }) => (
    <group>
      <group rotation={[0.4, t * 0.6, 0]} position={[0, 1, 0]}>
        <Ball r={0.6} color="#4cc9f0" />
        <Ball r={0.3} color={pal.ground} position={[0.3, 0.2, 0.38]} />
        <Ball r={0.25} color={pal.ground} position={[-0.35, -0.2, 0.35]} />
      </group>
      <Cyl rt={0.3} h={0.1} color="#6c757d" />
      <Cyl rt={0.04} h={0.45} color="#6c757d" position={[0, 0.2, 0]} />
    </group>
  ),
  cup: ({ pal }) => (
    <group>
      <Cyl rt={0.3} rb={0.24} h={0.6} position={[0, 0.3, 0]} color={pal.primary} />
      <Torus r={0.15} tube={0.04} color={pal.primary} position={[0.32, 0.32, 0]} />
    </group>
  ),
  chart: ({ t, pal }) => (
    <group>
      {[0.6, 1.0, 0.8, 1.5].map((h, i) => {
        const g = Math.min(1, t * 1.2 - i * 0.2);
        const hh = Math.max(0.05, h * g);
        return <Box key={i} size={[0.3, hh, 0.3]} position={[-0.6 + i * 0.4, hh / 2, 0]} color={i === 3 ? pal.accent : pal.secondary} />;
      })}
    </group>
  ),
  question: ({ t, pal }) => (
    <group rotation={[0, Math.sin(t * 2) * 0.4, 0]}>
      <Torus r={0.3} tube={0.1} arc={Math.PI * 1.4} color={pal.primary} position={[0, 0.8, 0]} rotation={[0, 0, -Math.PI * 0.4]} />
      <Cyl rt={0.1} h={0.3} color={pal.primary} position={[0, 0.38, 0]} />
      <Ball r={0.11} color={pal.primary} position={[0, 0.05, 0]} />
    </group>
  ),
  exclamation: ({ t, pal }) => (
    <group scale={1 + Math.abs(Math.sin(t * 5)) * 0.1}>
      <Cyl rt={0.14} rb={0.08} h={0.8} color={pal.accent} position={[0, 0.7, 0]} />
      <Ball r={0.12} color={pal.accent} position={[0, 0.05, 0]} />
    </group>
  ),
  trophy: ({ t }) => (
    <group rotation={[0, t * 0.8, 0]}>
      <Cyl rt={0.45} rb={0.15} h={0.6} color="#ffc300" position={[0, 0.85, 0]} />
      <Cyl rt={0.06} h={0.35} color="#ffc300" position={[0, 0.4, 0]} />
      <Box size={[0.6, 0.2, 0.4]} color="#8d6e63" position={[0, 0.1, 0]} />
      <Torus r={0.2} tube={0.04} color="#ffc300" position={[-0.45, 0.9, 0]} rotation={[0, 0, Math.PI / 2]} />
      <Torus r={0.2} tube={0.04} color="#ffc300" position={[0.45, 0.9, 0]} rotation={[0, 0, Math.PI / 2]} />
    </group>
  ),
  clock: ({ t, pal }) => (
    <group position={[0, 0.8, 0]}>
      <Cyl rt={0.6} h={0.1} color="#ffffff" rotation={[Math.PI / 2, 0, 0]} />
      <Torus r={0.6} tube={0.06} color={pal.secondary} />
      <Box size={[0.05, 0.4, 0.02]} color="#222" position={[0, 0, 0.07]} rotation={[0, 0, -t * 2]} />
      <Box size={[0.06, 0.28, 0.02]} color="#222" position={[0, 0, 0.08]} rotation={[0, 0, -t * 0.2]} />
    </group>
  ),
  mountain: ({ pal }) => (
    <group>
      <Cone r={2.5} h={3.5} position={[0, 1.75, 0]} color={shade(pal.ground, -0.3)} />
      <Cone r={0.9} h={1.2} position={[0, 2.95, 0]} color="#ffffff" />
    </group>
  ),
  boat: ({ t, pal }) => (
    <group position={[0, Math.sin(t * 2) * 0.08, 0]} rotation={[0, 0, Math.sin(t * 1.5) * 0.06]}>
      <Box size={[1.6, 0.35, 0.7]} position={[0, 0.2, 0]} color="#8d5524" />
      <Cyl rt={0.04} h={1.4} position={[0, 1, 0]} color="#6b4226" />
      <Cone r={0.55} h={1.1} sides={3} position={[0.3, 1.05, 0]} rotation={[0, 0, -Math.PI / 2]} color={pal.primary} scale={[1, 1, 0.1]} />
    </group>
  ),
  fish: ({ t, pal, seed }) => (
    <group position={[Math.sin(t + seed * 6) * 0.8, Math.sin(t * 2 + seed) * 0.2, 0]}>
      <Ball r={0.3} color={seed > 0.5 ? pal.primary : pal.accent} scale={[1.4, 1, 0.6]} />
      <Cone r={0.2} h={0.3} position={[-0.5, 0, 0]} rotation={[0, 0, Math.PI / 2 + Math.sin(t * 8) * 0.3]} color={pal.secondary} />
    </group>
  ),
  balloon: ({ t, pal, seed }) => (
    <group position={[0, 1.6 + Math.sin(t * 1.5 + seed * 5) * 0.15, 0]}>
      <Ball r={0.4} color={seed > 0.66 ? pal.accent : seed > 0.33 ? pal.primary : pal.secondary} scale={[1, 1.2, 1]} />
      <Cyl rt={0.01} h={1.2} color="#999" position={[0, -1, 0]} />
    </group>
  ),
  cactus: () => (
    <group>
      <Capsule r={0.22} len={1.2} position={[0, 0.8, 0]} color="#2d6a4f" />
      <Capsule r={0.13} len={0.4} position={[0.35, 1.0, 0]} color="#2d6a4f" />
      <Capsule r={0.13} len={0.35} position={[-0.35, 0.8, 0]} color="#2d6a4f" />
    </group>
  ),
  lamp: ({ night }) => (
    <group>
      <Cyl rt={0.05} h={2.2} position={[0, 1.1, 0]} color="#444" />
      <Ball r={0.22} color="#ffe5a0" glow={night} position={[0, 2.3, 0]} />
    </group>
  ),
  table: ({ pal }) => (
    <group>
      <Box size={[1.8, 0.1, 1]} position={[0, 0.8, 0]} color={shade(pal.primary, -0.4)} />
      {[[-0.8, -0.4], [0.8, -0.4], [-0.8, 0.4], [0.8, 0.4]].map(([x, z], i) => (
        <Cyl key={i} rt={0.05} h={0.8} position={[x, 0.4, z]} color={shade(pal.primary, -0.5)} />
      ))}
    </group>
  ),
  chair: ({ pal }) => (
    <group>
      <Box size={[0.6, 0.08, 0.6]} position={[0, 0.5, 0]} color={pal.secondary} />
      <Box size={[0.6, 0.6, 0.08]} position={[0, 0.8, -0.26]} color={pal.secondary} />
      {[[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]].map(([x, z], i) => (
        <Cyl key={i} rt={0.03} h={0.5} position={[x, 0.25, z]} color="#555" />
      ))}
    </group>
  ),
  sign: ({ pal }) => (
    <group>
      <Cyl rt={0.05} h={1.2} position={[0, 0.6, 0]} color="#7a5230" />
      <Box size={[1.1, 0.6, 0.08]} position={[0, 1.3, 0]} color={pal.primary} />
    </group>
  ),
};

const BIG = new Set(["mountain", "building"]);
const FLOATERS = new Set(["cloud", "sun", "moon", "star", "planet", "balloon", "heart", "question", "exclamation", "lightbulb", "coin"]);

export interface PropItem {
  kind: string;
  count: number;
  placement: string;
}

export const PropGroup: React.FC<{
  item: PropItem;
  index: number;
  sceneId: string;
  pal: Palette;
  frame: number;
  fps: number;
  night: boolean;
  wide: number; // ancho útil (más angosto en vertical)
}> = ({ item, index, sceneId, pal, frame, fps, night, wide }) => {
  const kit = useKit();
  const rand = rng(`${sceneId}-${item.kind}-${index}`);
  const Model = MODELS[item.kind] ?? MODELS.tree;
  const t = frame / fps;
  const items = Array.from({ length: item.count }).map((_, i) => {
    let x = 0, y = 0, z = 0, s = 1;
    const floats = FLOATERS.has(item.kind);
    // objetos enormes siempre al fondo para no tapar a los personajes
    const placement = BIG.has(item.kind) && item.placement !== "background" ? "background" : item.placement;
    switch (placement) {
      case "background":
        x = (i / Math.max(1, item.count - 1) - 0.5) * wide * 2.2 + (rand() - 0.5);
        z = -7 - rand() * 4;
        s = 1.2 + rand() * 0.6;
        break;
      case "center":
        x = item.count === 1 ? 0 : (i - (item.count - 1) / 2) * 1.6;
        z = -1.2;
        y = floats ? 2.4 : 0;
        s = item.count === 1 ? 1.5 : 1.1;
        break;
      case "floating":
        x = (rand() - 0.5) * wide * 1.6;
        y = 3 + rand() * 2.5;
        z = -2 - rand() * 4;
        s = 0.7 + rand() * 0.5;
        break;
      case "around": {
        const a = (i / item.count) * Math.PI * 2;
        x = Math.cos(a) * 5.2 * (wide / 9);
        z = Math.sin(a) * 4 - 2;
        // nunca delante de los personajes ni a la altura de sus cabezas
        if (z > -1) z = -1 - (z + 1) * 0.5;
        y = floats ? 3.4 : 0;
        break;
      }
      default: {
        // scattered: evitar la zona central donde están los personajes
        x = (rand() - 0.5) * wide * 2;
        z = -2 - rand() * 7;
        if (Math.abs(x) < 3 && z > -4) x += x < 0 ? -3 : 3;
        y = floats ? 2.5 + rand() * 2 : 0;
        s = 0.8 + rand() * 0.5;
      }
    }
    if (kit.ortho) z = Math.min(z, -1); // en 2D todo queda detrás de los personajes
    const bob = placement === "floating" ? Math.sin(t * 1.4 + i) * 0.25 : 0;
    const pop = spring({ frame: frame - 6 - index * 4 - i * 2, fps, config: { damping: 12, mass: 0.5 } });
    return (
      <group key={i} position={[x, y + bob, z]} scale={s * pop} rotation={[0, kit.ortho ? 0 : (rand() - 0.5) * 0.8, 0]}>
        <Model pal={pal} t={t} night={night} seed={rand()} />
      </group>
    );
  });
  return <group>{items}</group>;
};

export { MODELS };
