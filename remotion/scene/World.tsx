import React, { useLayoutEffect } from "react";
import { useThree } from "@react-three/fiber";
import { Easing, interpolate } from "remotion";
import * as THREE from "three";
import type { Character, Palette, Scene } from "../../shared/spec";
import { useKit } from "../kit";
import { SkyEnvironment, useGroundTexture, useRedrawWhen } from "../assets";
import { TEXTURE_STYLES } from "../../shared/library";
import { CharacterModel } from "./Character";
import { Environment, Lights, skyColor } from "./Environment";
import { PropGroup } from "./Props";

const POS_X: Record<string, number> = { far_left: -5.2, left: -2.6, center: 0, right: 2.6, far_right: 5.2, back: 0 };

export function charPosition(position: string, vertical: boolean): [number, number, number] {
  const x = POS_X[position] ?? 0;
  // en vertical se juntan, pero sin atravesarse (left/right a ±1.6; extremos a ±3.2)
  return [vertical ? x * 0.62 : x, 0, position === "back" ? -3.5 : 0];
}

/** Cámara determinista por frame según el movimiento pedido. */
const CameraRig: React.FC<{ move: string; frame: number; dur: number; vertical: boolean; focusX: number }> = ({
  move, frame, dur, vertical, focusX,
}) => {
  const { camera, size } = useThree();
  const kit = useKit();
  useLayoutEffect(() => {
    const p = interpolate(frame, [0, Math.max(1, dur)], [0, 1], {
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.cubic),
    });
    const dist = vertical ? 14.5 : 12.5;
    let pos = new THREE.Vector3(0, 3.2, dist);
    const look = new THREE.Vector3(0, 1.4, 0);
    switch (move) {
      case "orbit": {
        const a = interpolate(p, [0, 1], [-0.35, 0.35]);
        pos.set(Math.sin(a) * dist, 3.2, Math.cos(a) * dist);
        break;
      }
      case "dolly_in":
        pos.set(0, interpolate(p, [0, 1], [3.6, 2.4]), interpolate(p, [0, 1], [dist + 3, dist - 4]));
        break;
      case "dolly_out":
        pos.set(0, interpolate(p, [0, 1], [2.4, 3.8]), interpolate(p, [0, 1], [dist - 4, dist + 3]));
        break;
      case "pan_left":
        pos.set(interpolate(p, [0, 1], [3, -3]), 3, dist);
        look.x = pos.x * 0.6;
        break;
      case "pan_right":
        pos.set(interpolate(p, [0, 1], [-3, 3]), 3, dist);
        look.x = pos.x * 0.6;
        break;
      case "crane_up":
        pos.set(0, interpolate(p, [0, 1], [1.2, 7]), dist);
        look.y = interpolate(p, [0, 1], [1.8, 1]);
        break;
      case "closeup":
        pos.set(focusX * 0.9, 2.3, interpolate(p, [0, 1], [6.5, 5.2]));
        look.set(focusX, 1.7, 0);
        break;
      default:
        pos = new THREE.Vector3(0, 3.2, dist);
    }
    // 9:16: subimos el encuadre para que los personajes queden por encima de los subtítulos
    // (que viven sobre la franja inferior que tapa la app).
    if (vertical) look.y -= move === "closeup" ? 0.7 : 1.6;
    if (kit.ortho && camera instanceof THREE.OrthographicCamera) {
      // 2D: vista frontal, el "movimiento" se traduce en zoom y desplazamiento
      const zoomBase = (vertical ? size.width / 11 : size.height / 9.5);
      const z = move === "dolly_in" || move === "closeup" ? interpolate(p, [0, 1], [1, 1.35]) : move === "dolly_out" ? interpolate(p, [0, 1], [1.35, 1]) : 1;
      camera.zoom = zoomBase * z;
      // ligera inclinación para que el suelo se vea como una franja
      camera.position.set(move === "closeup" ? focusX : pos.x * 0.4, 10, 30);
      camera.lookAt(camera.position.x, vertical ? 0.4 : 3.4, 0);
      camera.updateProjectionMatrix();
      return;
    }
    camera.position.copy(pos);
    camera.lookAt(look);
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = vertical ? 52 : 40;
      camera.near = 0.1;
      camera.far = 200;
      camera.updateProjectionMatrix();
    }
  }, [camera, frame, dur, move, vertical, kit.ortho, focusX, size.width, size.height]);
  return null;
};

export const World: React.FC<{
  scene: Scene;
  characters: Character[];
  pal: Palette;
  style: string;
  frame: number;
  fps: number;
  dur: number;
  vertical: boolean;
  hook?: boolean;
  assets?: Record<string, { type: string; url: string }>;
  assetBase?: string;
}> = ({ scene, characters, pal, style, frame, fps, dur, vertical, hook, assets, assetBase = "" }) => {
  const textured = TEXTURE_STYLES.has(style);
  const groundUrl = textured && scene.ground && scene.setting !== "ocean" && scene.setting !== "space" && assets?.[scene.ground] ? assetBase + assets[scene.ground].url : undefined;
  const skyUrl = textured && scene.sky && assets?.[scene.sky] ? assetBase + assets[scene.sky].url : undefined;
  const groundTex = useGroundTexture(groundUrl);
  useRedrawWhen(groundTex);
  // En el gancho todo ya está en cuadro desde el frame 0 (sin animación de entrada).
  const animFrame = hook ? frame + fps : frame;
  const kit = useKit();
  const sky = skyColor(pal, scene.timeOfDay, style, scene.setting);
  const speaker = scene.characters.find((c) => c.speaking) ?? scene.characters[0];
  const focusX = speaker ? charPosition(speaker.position, vertical)[0] : 0;
  const wide = vertical ? 4.5 : 9;
  const night = scene.timeOfDay === "night" || style === "neon";
  return (
    <>
      {skyUrl ? (
        <SkyEnvironment url={skyUrl} blur={style === "cartoon3d" ? 0.02 : 0.12} intensity={style === "cartoon3d" ? 0.3 : 0.22} />
      ) : (
        <>
          <color attach="background" args={[sky]} />
          {kit.id !== "flat2d" && <fog attach="fog" args={[sky, 22, 60]} />}
        </>
      )}
      <Lights time={scene.timeOfDay} setting={scene.setting} />
      <CameraRig move={scene.camera} frame={frame} dur={dur} vertical={vertical} focusX={focusX} />
      <Environment setting={scene.setting} time={scene.timeOfDay} pal={pal} frame={frame} fps={fps} sceneId={scene.id} wide={wide} groundTex={groundTex} />
      {scene.props.map((p, i) => (
        <PropGroup key={i} item={p} index={i} sceneId={scene.id} pal={pal} frame={animFrame} fps={fps} night={night} wide={wide} />
      ))}
      {scene.characters.map((sc, i) => {
        const def = characters.find((c) => c.id === sc.id);
        if (!def) return null;
        const pos = charPosition(sc.position, vertical);
        return (
          <group key={sc.id} position={pos} rotation={[0, kit.ortho ? 0 : -pos[0] * 0.05, 0]} scale={vertical ? 0.9 : 1}>
            <CharacterModel def={def} action={sc.action} speaking={sc.speaking} frame={animFrame} fps={fps} delay={3 + i * 5} emotion={scene.emotion} />
          </group>
        );
      })}
    </>
  );
};
