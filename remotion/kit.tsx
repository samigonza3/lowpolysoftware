import React, { createContext, useContext } from "react";
import * as THREE from "three";
import type { StyleId } from "../shared/spec";

/**
 * StyleKit: cómo se "pinta" cada plantilla. Todos los personajes, props y
 * escenarios usan estas primitivas, así un mismo guion se ve distinto por estilo.
 */
export interface StyleKit {
  id: StyleId;
  seg: number; // segmentos de esferas/cilindros
  lowpoly: boolean;
  ortho: boolean;
  shadows: boolean;
  emissive: number; // intensidad emisiva base (neón)
}

export const KITS: Record<StyleId, StyleKit> = {
  lowpoly: { id: "lowpoly", seg: 6, lowpoly: true, ortho: false, shadows: false, emissive: 0 },
  cartoon3d: { id: "cartoon3d", seg: 40, lowpoly: false, ortho: false, shadows: true, emissive: 0 },
  flat2d: { id: "flat2d", seg: 32, lowpoly: false, ortho: true, shadows: false, emissive: 0 },
  neon: { id: "neon", seg: 24, lowpoly: false, ortho: false, shadows: false, emissive: 0.55 },
  clay: { id: "clay", seg: 20, lowpoly: false, ortho: false, shadows: true, emissive: 0 },
};

const KitCtx = createContext<StyleKit>(KITS.lowpoly);
export const KitProvider = KitCtx.Provider;
export const useKit = () => useContext(KitCtx);

type V3 = [number, number, number];
interface MeshProps {
  color: string;
  position?: V3;
  rotation?: V3;
  scale?: V3 | number;
  glow?: boolean; // emisivo fuerte (ojos de robot, focos, estrellas)
  opacity?: number;
  children?: React.ReactNode;
}

export const Mat: React.FC<{ color: string; glow?: boolean; opacity?: number }> = ({ color, glow, opacity }) => {
  const kit = useKit();
  const transparent = opacity !== undefined && opacity < 1;
  if (kit.id === "flat2d") {
    return <meshBasicMaterial color={color} transparent={transparent} opacity={opacity ?? 1} />;
  }
  if (kit.id === "cartoon3d") {
    return (
      <meshPhysicalMaterial
        color={color}
        roughness={0.42}
        clearcoat={0.35}
        clearcoatRoughness={0.4}
        sheen={0.6}
        sheenColor={new THREE.Color(color).lerp(new THREE.Color("#ffffff"), 0.5)}
        emissive={glow ? color : "#000000"}
        emissiveIntensity={glow ? 1.2 : 0}
        transparent={transparent}
        opacity={opacity ?? 1}
      />
    );
  }
  const emissive = glow ? 1.4 : kit.emissive;
  return (
    <meshStandardMaterial
      color={color}
      flatShading={kit.lowpoly}
      roughness={kit.id === "clay" ? 1 : kit.lowpoly ? 0.9 : 0.55}
      metalness={kit.id === "neon" ? 0.2 : 0}
      emissive={emissive > 0 ? color : "#000000"}
      emissiveIntensity={emissive}
      transparent={transparent}
      opacity={opacity ?? 1}
    />
  );
};

const meshBase = (p: MeshProps) => ({
  position: p.position,
  rotation: p.rotation,
  scale: typeof p.scale === "number" ? ([p.scale, p.scale, p.scale] as V3) : p.scale,
});

export const Ball: React.FC<MeshProps & { r?: number }> = (p) => {
  const kit = useKit();
  const r = p.r ?? 0.5;
  return (
    <mesh {...meshBase(p)} castShadow={kit.shadows} receiveShadow={kit.shadows}>
      {kit.lowpoly ? <icosahedronGeometry args={[r, 1]} /> : <sphereGeometry args={[r, kit.seg, Math.max(6, kit.seg * 0.75)]} />}
      <Mat color={p.color} glow={p.glow} opacity={p.opacity} />
    </mesh>
  );
};

export const Box: React.FC<MeshProps & { size?: V3 }> = (p) => {
  const kit = useKit();
  return (
    <mesh {...meshBase(p)} castShadow={kit.shadows} receiveShadow={kit.shadows}>
      <boxGeometry args={p.size ?? [1, 1, 1]} />
      <Mat color={p.color} glow={p.glow} opacity={p.opacity} />
    </mesh>
  );
};

export const Cyl: React.FC<MeshProps & { rt?: number; rb?: number; h?: number }> = (p) => {
  const kit = useKit();
  return (
    <mesh {...meshBase(p)} castShadow={kit.shadows} receiveShadow={kit.shadows}>
      <cylinderGeometry args={[p.rt ?? 0.5, p.rb ?? p.rt ?? 0.5, p.h ?? 1, kit.lowpoly ? 6 : kit.seg]} />
      <Mat color={p.color} glow={p.glow} opacity={p.opacity} />
    </mesh>
  );
};

export const Cone: React.FC<MeshProps & { r?: number; h?: number; sides?: number }> = (p) => {
  const kit = useKit();
  return (
    <mesh {...meshBase(p)} castShadow={kit.shadows} receiveShadow={kit.shadows}>
      <coneGeometry args={[p.r ?? 0.5, p.h ?? 1, p.sides ?? (kit.lowpoly ? 5 : kit.seg)]} />
      <Mat color={p.color} glow={p.glow} opacity={p.opacity} />
    </mesh>
  );
};

export const Capsule: React.FC<MeshProps & { r?: number; len?: number }> = (p) => {
  const kit = useKit();
  return (
    <mesh {...meshBase(p)} castShadow={kit.shadows} receiveShadow={kit.shadows}>
      <capsuleGeometry args={[p.r ?? 0.3, p.len ?? 0.6, kit.lowpoly ? 2 : 8, kit.lowpoly ? 6 : kit.seg]} />
      <Mat color={p.color} glow={p.glow} opacity={p.opacity} />
    </mesh>
  );
};

export const Torus: React.FC<MeshProps & { r?: number; tube?: number; arc?: number }> = (p) => {
  const kit = useKit();
  return (
    <mesh {...meshBase(p)} castShadow={kit.shadows}>
      <torusGeometry args={[p.r ?? 0.5, p.tube ?? 0.1, kit.lowpoly ? 4 : 12, kit.lowpoly ? 8 : 32, p.arc ?? Math.PI * 2]} />
      <Mat color={p.color} glow={p.glow} opacity={p.opacity} />
    </mesh>
  );
};

/** Generador pseudoaleatorio determinista (mismo resultado en preview y render). */
export function rng(seedStr: string) {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) h = Math.imul(h ^ seedStr.charCodeAt(i), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const shade = (hex: string, amount: number) => {
  const c = new THREE.Color(hex);
  return "#" + (amount >= 0 ? c.lerp(new THREE.Color("#ffffff"), amount) : c.lerp(new THREE.Color("#000000"), -amount)).getHexString();
};
