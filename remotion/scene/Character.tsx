import React from "react";
import { spring } from "remotion";
import type { Character as CharacterT } from "../../shared/spec";
import { Ball, Box, Capsule, Cone, Cyl, Torus, shade, useKit } from "../kit";

type Action = string;
interface Props {
  def: CharacterT;
  action: Action;
  speaking: boolean;
  frame: number; // frame local de la escena
  fps: number;
  delay: number; // frames de retraso en la aparición
  emotion: string;
}

const SKIN = ["#f6d2b5", "#e8b48f", "#c98e64", "#8d5a3b"];

/** Pose común calculada a partir de la acción y el tiempo. */
function pose(action: Action, t: number) {
  const p = {
    y: 0, rotY: 0, lean: 0, x: 0, squash: 1,
    armL: 0.15, armR: -0.15, armLx: 0, armRx: 0,
    legL: 0, legR: 0, headTilt: 0, headNod: 0, tail: Math.sin(t * 6) * 0.5, wing: Math.sin(t * 14) * 0.6,
  };
  const breathe = Math.sin(t * 2.2) * 0.02;
  p.squash = 1 + breathe;
  switch (action) {
    case "talk":
      p.armR = -0.4 - Math.abs(Math.sin(t * 3)) * 0.5;
      p.armRx = -0.5;
      p.headNod = Math.sin(t * 4) * 0.06;
      break;
    case "walk":
    case "run": {
      const sp = action === "run" ? 11 : 6;
      const amp = action === "run" ? 0.9 : 0.5;
      p.legL = Math.sin(t * sp) * amp;
      p.legR = -Math.sin(t * sp) * amp;
      p.armLx = -Math.sin(t * sp) * amp * 0.8;
      p.armRx = Math.sin(t * sp) * amp * 0.8;
      p.y = Math.abs(Math.sin(t * sp)) * (action === "run" ? 0.18 : 0.08);
      p.lean = action === "run" ? 0.2 : 0.05;
      p.x = Math.sin(t * 0.5) * 1.2;
      p.rotY = Math.cos(t * 0.5) > 0 ? Math.PI / 2.6 : -Math.PI / 2.6;
      p.tail = Math.sin(t * 14) * 0.6;
      break;
    }
    case "wave":
      p.armR = -2.6 + Math.sin(t * 9) * 0.35;
      p.headTilt = 0.12;
      break;
    case "jump": {
      const ph = (t * 1.6) % 1;
      p.y = Math.max(0, Math.sin(ph * Math.PI)) * 1.1;
      p.squash = ph < 0.08 || ph > 0.92 ? 0.85 : 1.08;
      p.armL = 2.2;
      p.armR = -2.2;
      p.legL = -0.3;
      p.legR = -0.3;
      break;
    }
    case "dance":
      p.rotY = Math.sin(t * 3) * 0.6;
      p.y = Math.abs(Math.sin(t * 6)) * 0.15;
      p.armL = 1.4 + Math.sin(t * 6) * 0.8;
      p.armR = -1.4 + Math.sin(t * 6) * 0.8;
      p.legL = Math.sin(t * 6) * 0.3;
      p.legR = -Math.sin(t * 6) * 0.3;
      p.headTilt = Math.sin(t * 6) * 0.15;
      break;
    case "think":
      p.armR = -0.6;
      p.armRx = -1.9;
      p.headTilt = 0.22 + Math.sin(t * 1.2) * 0.05;
      p.headNod = -0.1;
      break;
    case "celebrate": {
      const ph = (t * 2) % 1;
      p.y = Math.max(0, Math.sin(ph * Math.PI)) * 0.55;
      p.armL = 2.6 + Math.sin(t * 12) * 0.2;
      p.armR = -2.6 - Math.sin(t * 12) * 0.2;
      p.rotY = Math.sin(t * 2) * 0.3;
      break;
    }
    case "sad":
      p.headNod = 0.35;
      p.lean = 0.12;
      p.squash = 0.96;
      p.armL = 0.05;
      p.armR = -0.05;
      p.tail = -0.6;
      break;
    case "point":
      p.armR = -1.5;
      p.armRx = -0.3 + Math.sin(t * 2) * 0.05;
      p.rotY = -0.25;
      break;
    default:
      p.armL = 0.15 + Math.sin(t * 2.2) * 0.04;
      p.armR = -0.15 - Math.sin(t * 2.2) * 0.04;
  }
  return p;
}

const Eyes: React.FC<{ y: number; z: number; spread: number; r: number; frame: number; fps: number; big?: boolean; glow?: string }> = ({
  y, z, spread, r, frame, fps, big, glow,
}) => {
  const kit = useKit();
  const blink = (frame % Math.round(fps * 3.3)) < 4 ? 0.12 : 1;
  const pupil = r * (big ? 0.62 : 0.55);
  return (
    <group position={[0, y, z]} scale={[1, blink, 1]}>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * spread, 0, 0]}>
          {glow ? (
            <Ball r={r} color={glow} glow />
          ) : (
            <>
              <Ball r={r} color="#ffffff" />
              <Ball r={pupil} color="#1b1b1f" position={[0, -r * 0.05, r * 0.62]} />
              {kit.id !== "flat2d" && kit.id !== "lowpoly" && (
                <Ball r={pupil * 0.3} color="#ffffff" glow position={[pupil * 0.35, pupil * 0.35, r * 0.62 + pupil * 0.8]} />
              )}
            </>
          )}
        </group>
      ))}
    </group>
  );
};

const Mouth: React.FC<{ y: number; z: number; open: number; emotion: string; w?: number }> = ({ y, z, open, emotion, w = 0.12 }) => {
  const smile = emotion === "sad" ? Math.PI : 0;
  if (open > 0.05) {
    return <Ball r={w} color="#5a1a1a" position={[0, y, z]} scale={[1, 0.25 + open * 0.75, 0.5]} />;
  }
  return <Torus r={w} tube={0.025} arc={Math.PI} color="#5a1a1a" position={[0, y + (smile ? -0.05 : 0.04), z]} rotation={[0, 0, Math.PI + smile]} />;
};

const Accessory: React.FC<{ kind: string; headY: number; headR: number; accent: string }> = ({ kind, headY, headR, accent }) => {
  const top = headY + headR * 0.85;
  switch (kind) {
    case "hat":
      return (
        <group position={[0, top, 0]}>
          <Cyl rt={headR * 1.4} h={0.05} color={shade(accent, -0.2)} />
          <Cyl rt={headR * 0.75} rb={headR * 0.8} h={headR * 0.9} position={[0, headR * 0.45, 0]} color={accent} />
        </group>
      );
    case "cap":
      return (
        <group position={[0, top - 0.08, 0]}>
          <Ball r={headR * 0.92} color={accent} scale={[1, 0.55, 1]} />
          <Box size={[headR * 1.1, 0.04, headR * 0.9]} position={[0, -0.02, headR * 0.9]} color={shade(accent, -0.2)} />
        </group>
      );
    case "glasses":
      return (
        <group position={[0, headY + headR * 0.12, headR * 0.92]}>
          <Torus r={headR * 0.25} tube={0.025} color="#222" position={[-headR * 0.36, 0, 0]} />
          <Torus r={headR * 0.25} tube={0.025} color="#222" position={[headR * 0.36, 0, 0]} />
          <Box size={[headR * 0.25, 0.03, 0.03]} color="#222" />
        </group>
      );
    case "bow":
      return (
        <group position={[headR * 0.5, top, 0]} rotation={[0, 0, -0.3]}>
          <Cone r={0.13} h={0.26} color={accent} rotation={[0, 0, Math.PI / 2]} position={[-0.13, 0, 0]} />
          <Cone r={0.13} h={0.26} color={accent} rotation={[0, 0, -Math.PI / 2]} position={[0.13, 0, 0]} />
          <Ball r={0.07} color={shade(accent, -0.2)} />
        </group>
      );
    case "crown":
      return (
        <group position={[0, top, 0]}>
          <Cyl rt={headR * 0.6} h={0.16} color="#ffc93c" glow={false} />
          {[0, 1, 2, 3, 4].map((i) => (
            <Cone key={i} r={0.06} h={0.18} color="#ffc93c"
              position={[Math.cos((i / 5) * Math.PI * 2) * headR * 0.55, 0.16, Math.sin((i / 5) * Math.PI * 2) * headR * 0.55]} />
          ))}
        </group>
      );
    case "scarf":
      return <Torus r={headR * 0.62} tube={0.09} color={accent} position={[0, headY - headR * 0.95, 0]} rotation={[Math.PI / 2, 0, 0]} />;
    case "headphones":
      return (
        <group position={[0, headY, 0]}>
          <Torus r={headR * 1.05} tube={0.04} arc={Math.PI} color="#333" />
          <Cyl rt={0.14} h={0.12} color={accent} rotation={[0, 0, Math.PI / 2]} position={[-headR * 1.02, 0, 0]} />
          <Cyl rt={0.14} h={0.12} color={accent} rotation={[0, 0, Math.PI / 2]} position={[headR * 1.02, 0, 0]} />
        </group>
      );
    default:
      return null;
  }
};

/** Humanoide (persona, niño, robot, mascota y monstruo comparten esqueleto). */
const Biped: React.FC<Props & { p: ReturnType<typeof pose>; mouthOpen: number }> = ({ def, p, frame, fps, mouthOpen, emotion }) => {
  const kind = def.kind;
  const robot = kind === "robot";
  const blob = kind === "mascot" || kind === "monster";
  const skin = robot ? shade(def.color, 0.25) : blob ? def.color : SKIN[(def.id.length + def.name.length) % SKIN.length];
  const headR = blob ? 0 : kind === "child" ? 0.48 : 0.42;
  const bodyY = 1.0;
  const headY = kind === "child" ? 1.85 : 1.95;
  const limb = robot ? shade(def.accent, -0.1) : def.color;

  return (
    <group>
      {/* piernas */}
      {[[-1, p.legL], [1, p.legR]].map(([s, a]) => (
        <group key={s} position={[s * 0.2, 0.62, 0]} rotation={[a, 0, 0]}>
          {robot ? <Box size={[0.2, 0.6, 0.22]} position={[0, -0.3, 0]} color={limb} /> : <Capsule r={0.12} len={0.38} position={[0, -0.3, 0]} color={blob ? def.color : def.accent} />}
          <Ball r={0.15} color={shade(def.accent, -0.35)} position={[0, -0.6, 0.06]} scale={[1, 0.6, 1.4]} />
        </group>
      ))}
      {/* cuerpo */}
      {robot ? (
        <Box size={[0.85, 0.85, 0.6]} position={[0, bodyY + 0.05, 0]} color={def.color} />
      ) : blob ? (
        <Ball r={0.85} color={def.color} position={[0, 1.35, 0]} scale={[1, 1.05, 0.95]} />
      ) : (
        <Capsule r={0.34} len={0.45} position={[0, bodyY + 0.1, 0]} color={def.color} />
      )}
      {robot && <Ball r={0.09} color={def.accent} glow position={[0, bodyY + 0.15, 0.31]} />}
      {/* brazos */}
      {[[-1, p.armL, p.armLx], [1, p.armR, p.armRx]].map(([s, az, ax]) => (
        <group key={s} position={[s * (blob ? 0.8 : 0.42), blob ? 1.45 : 1.38, 0]} rotation={[ax, 0, az]}>
          {robot ? (
            <Cyl rt={0.08} h={0.55} position={[0, -0.28, 0]} color={limb} />
          ) : (
            <Capsule r={0.09} len={0.38} position={[0, -0.27, 0]} color={blob ? def.color : def.color} />
          )}
          <Ball r={0.11} color={robot ? def.accent : skin} position={[0, -0.55, 0]} />
        </group>
      ))}
      {/* cabeza */}
      <group position={[0, blob ? 1.4 : headY, 0]} rotation={[p.headNod, 0, p.headTilt]}>
        {robot ? (
          <>
            <Box size={[0.8, 0.62, 0.62]} color={shade(def.color, 0.1)} />
            <Box size={[0.66, 0.36, 0.05]} color="#1c2733" position={[0, 0.02, 0.31]} />
            <Eyes y={0.03} z={0.33} spread={0.16} r={0.07} frame={frame} fps={fps} glow="#5ef2ff" />
            <Cyl rt={0.02} h={0.3} color="#888" position={[0, 0.45, 0]} />
            <Ball r={0.07} color={def.accent} glow position={[0, 0.62, 0]} />
          </>
        ) : blob ? (
          <>
            <Eyes y={0.15} z={0.72} spread={kind === "monster" ? 0 : 0.26} r={kind === "monster" ? 0.26 : 0.17} frame={frame} fps={fps} big />
            <Mouth y={-0.22} z={0.8} open={mouthOpen} emotion={emotion} w={0.18} />
            {kind === "monster" && (
              <>
                <Cone r={0.12} h={0.4} color={def.accent} position={[-0.45, 0.75, 0]} rotation={[0, 0, 0.4]} />
                <Cone r={0.12} h={0.4} color={def.accent} position={[0.45, 0.75, 0]} rotation={[0, 0, -0.4]} />
              </>
            )}
            {kind === "mascot" && <Ball r={0.12} color={def.accent} position={[0, 0.88, 0]} />}
          </>
        ) : (
          <>
            <Ball r={headR} color={skin} />
            {/* pelo */}
            <Ball r={headR * 1.04} color={shade(def.accent, -0.15)} position={[0, headR * 0.22, -headR * 0.12]} scale={[1, 0.82, 0.95]} />
            <Eyes y={headR * 0.1} z={headR * 0.8} spread={headR * 0.36} r={headR * (kind === "child" ? 0.24 : 0.2)} frame={frame} fps={fps} big={kind === "child"} />
            <Ball r={headR * 0.1} color={shade(skin, -0.12)} position={[0, -headR * 0.12, headR * 0.98]} />
            <Mouth y={-headR * 0.42} z={headR * 0.88} open={mouthOpen} emotion={emotion} w={headR * 0.22} />
            {[-1, 1].map((s) => (
              <Ball key={s} r={headR * 0.13} color="#ff9aa2" opacity={0.6} position={[s * headR * 0.55, -headR * 0.25, headR * 0.78]} />
            ))}
          </>
        )}
        {!blob && <Accessory kind={def.accessory} headY={0} headR={robot ? 0.38 : headR} accent={def.accent} />}
      </group>
      {blob && <Accessory kind={def.accessory} headY={1.4} headR={0.8} accent={def.accent} />}
    </group>
  );
};

/** Cuadrúpedos (perro, gato). */
const Quadruped: React.FC<Props & { p: ReturnType<typeof pose>; mouthOpen: number }> = ({ def, p, frame, fps, mouthOpen, emotion }) => {
  const cat = def.kind === "cat";
  return (
    <group scale={cat ? 0.85 : 1}>
      <Capsule r={0.36} len={0.7} rotation={[0, 0, Math.PI / 2]} position={[0, 0.75, 0]} color={def.color} />
      {[[-0.4, 0.2, p.legL], [-0.4, -0.2, p.legR], [0.4, 0.2, p.legR], [0.4, -0.2, p.legL]].map(([x, z, a], i) => (
        <group key={i} position={[x, 0.55, z]} rotation={[0, 0, a * 0.6]}>
          <Capsule r={0.09} len={0.3} position={[0, -0.25, 0]} color={def.color} />
        </group>
      ))}
      <group position={[-0.62, 0.95, 0]} rotation={[0, 0, 0.6 + p.tail * 0.5]}>
        <Capsule r={0.06} len={cat ? 0.7 : 0.4} position={[0, 0.25, 0]} color={def.accent} />
      </group>
      <group position={[0.6, 1.25, 0]} rotation={[p.headNod, Math.PI / 2 - 0.9, p.headTilt]}>
        <Ball r={0.4} color={def.color} />
        <Ball r={0.18} color={shade(def.color, 0.25)} position={[0, -0.12, 0.33]} scale={[1.2, 0.8, 1]} />
        <Ball r={0.06} color="#222" position={[0, -0.05, 0.5]} />
        <Eyes y={0.08} z={0.3} spread={0.16} r={0.1} frame={frame} fps={fps} big />
        <Mouth y={-0.22} z={0.42} open={mouthOpen} emotion={emotion} w={0.08} />
        {cat ? (
          <>
            <Cone r={0.13} h={0.28} color={def.accent} position={[-0.22, 0.38, 0]} />
            <Cone r={0.13} h={0.28} color={def.accent} position={[0.22, 0.38, 0]} />
          </>
        ) : (
          <>
            <Ball r={0.16} color={def.accent} position={[-0.36, 0.05, -0.05]} scale={[0.5, 1.4, 1]} />
            <Ball r={0.16} color={def.accent} position={[0.36, 0.05, -0.05]} scale={[0.5, 1.4, 1]} />
          </>
        )}
        <Accessory kind={def.accessory} headY={0} headR={0.4} accent={def.accent} />
      </group>
    </group>
  );
};

const Bird: React.FC<Props & { p: ReturnType<typeof pose>; mouthOpen: number }> = ({ def, p, frame, fps }) => (
  <group position={[0, 0.4, 0]}>
    <Ball r={0.5} color={def.color} position={[0, 0.6, 0]} />
    <Ball r={0.3} color={shade(def.color, 0.35)} position={[0, 0.5, 0.28]} />
    {[-1, 1].map((s) => (
      <group key={s} position={[s * 0.45, 0.7, 0]} rotation={[0, 0, s * (0.3 + p.wing)]}>
        <Ball r={0.25} color={def.accent} position={[s * 0.15, 0, 0]} scale={[1.2, 0.35, 0.8]} />
      </group>
    ))}
    <Cone r={0.09} h={0.25} color="#ffb703" rotation={[Math.PI / 2, 0, 0]} position={[0, 0.65, 0.55]} />
    <Eyes y={0.85} z={0.4} spread={0.17} r={0.1} frame={frame} fps={fps} big />
    {[-1, 1].map((s) => (
      <Cyl key={s} rt={0.03} h={0.35} color="#ff9f1c" position={[s * 0.15, 0.05, 0]} />
    ))}
    <Accessory kind={def.accessory} headY={0.6} headR={0.5} accent={def.accent} />
  </group>
);

export const CharacterModel: React.FC<Props> = (props) => {
  const { action, speaking, frame, fps, delay } = props;
  const t = frame / fps;
  const p = pose(action, t + props.def.id.length);
  const appear = spring({ frame: frame - delay, fps, config: { damping: 11, mass: 0.6 } });
  const talking = speaking || action === "talk";
  const mouthOpen = talking ? Math.max(0, Math.sin(t * 17) * 0.5 + Math.sin(t * 7.3) * 0.5) : 0;
  const Body = props.def.kind === "dog" || props.def.kind === "cat" ? Quadruped : props.def.kind === "bird" ? Bird : Biped;
  return (
    <group position={[p.x, p.y, 0]} rotation={[0, p.rotY, 0]} scale={[appear, appear * p.squash, appear]}>
      <group rotation={[p.lean, 0, 0]}>
        <Body {...props} p={p} mouthOpen={mouthOpen} />
      </group>
    </group>
  );
};
