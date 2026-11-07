import type { Palette, StyleId, VideoSpec } from "./spec";

export interface Template {
  id: StyleId;
  name: string;
  tagline: string;
  description: string;
  /** Guía de dirección de arte que se le pasa al agente. */
  artDirection: string;
  palette: Palette;
  gradient: string; // para la tarjeta en la UI
}

export const TEMPLATES: Template[] = [
  {
    id: "lowpoly",
    name: "Low Poly",
    tagline: "Geometría facetada y colores planos",
    description: "Mundos 3D de pocos polígonos con sombreado plano, ideal para explicativos y divulgación.",
    artDirection:
      "Estilo low poly: formas geométricas facetadas, paletas cálidas y armónicas, escenarios simples y legibles. Preferir exteriores (bosque, montañas, ciudad) y props icónicos.",
    palette: { sky: "#9ad1d4", ground: "#8ab17d", primary: "#e9c46a", secondary: "#2a9d8f", accent: "#e76f51" },
    gradient: "linear-gradient(135deg,#2a9d8f,#e9c46a 60%,#e76f51)",
  },
  {
    id: "cartoon3d",
    name: "Animación 3D cinematográfica",
    tagline: "Personajes suaves y expresivos, estilo película animada (tipo Pixar)",
    description: "Superficies suaves, ojos grandes, luz cálida con contraluz. Para historias con personajes y emoción.",
    artDirection:
      "Estilo película animada 3D familiar: personajes redondeados con ojos grandes y expresivos, colores saturados pero suaves, iluminación cálida tipo atardecer, cámaras cinematográficas (dolly_in, closeup) en momentos emotivos. Priorizar narrativa con personajes protagonistas.",
    palette: { sky: "#ffd6a5", ground: "#a7c957", primary: "#ff8fab", secondary: "#4ea8de", accent: "#ffb703" },
    gradient: "linear-gradient(135deg,#ff8fab,#ffd6a5 55%,#4ea8de)",
  },
  {
    id: "flat2d",
    name: "Flat 2D Motion",
    tagline: "Motion graphics planos, sin sombras",
    description: "Look de ilustración vectorial plana con cámara ortográfica. Perfecto para marcas, datos y anuncios.",
    artDirection:
      "Estilo motion graphics plano tipo ilustración vectorial: fondos limpios (abstract, office), muchos props simbólicos (chart, lightbulb, coin, phone), textos en pantalla potentes y cortos, ritmo rápido.",
    palette: { sky: "#f1faee", ground: "#a8dadc", primary: "#e63946", secondary: "#1d3557", accent: "#ffb703" },
    gradient: "linear-gradient(135deg,#1d3557,#a8dadc 55%,#e63946)",
  },
  {
    id: "neon",
    name: "Neón / Synthwave",
    tagline: "Noche, brillo y rejillas retro",
    description: "Ambientes oscuros con luces emisivas y rejilla retro. Para tecnología, gaming y futuro.",
    artDirection:
      "Estilo neón synthwave: casi siempre de noche, escenarios city, space o abstract, props tecnológicos (computer, rocket, planet, phone), colores magenta, cian y violeta, energía alta.",
    palette: { sky: "#120634", ground: "#1a0b3d", primary: "#ff2a6d", secondary: "#05d9e8", accent: "#d1f7ff" },
    gradient: "linear-gradient(135deg,#120634,#ff2a6d 60%,#05d9e8)",
  },
  {
    id: "clay",
    name: "Plastilina",
    tagline: "Claymation mate y artesanal",
    description: "Materiales mate y formas blanditas como stop-motion de plastilina. Para cuentos y contenido infantil.",
    artDirection:
      "Estilo plastilina/claymation: colores pastel mate, formas blandas, escenarios acogedores (room, farm, forest), personajes tiernos (mascot, dog, cat, child), humor suave.",
    palette: { sky: "#cde7f0", ground: "#e9d8a6", primary: "#ee9b00", secondary: "#94d2bd", accent: "#ae2012" },
    gradient: "linear-gradient(135deg,#94d2bd,#e9d8a6 55%,#ee9b00)",
  },
];

export const templateById = (id: string) => TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];

/** Video corto de muestra para previsualizar cada plantilla. */
export function demoSpec(style: StyleId): VideoSpec {
  const t = templateById(style);
  return {
    version: 1,
    title: t.name,
    summary: "Vista previa de la plantilla",
    style,
    aspect: "16:9",
    fps: 30,
    captions: true,
    language: "es",
    voice: { engine: "kokoro", voiceId: "ef_dora", speed: 1 },
    palette: t.palette,
    characters: [
      { id: "luna", name: "Luna", kind: "child", color: t.palette.primary, accent: t.palette.secondary, accessory: "bow", description: "curiosa" },
      { id: "toby", name: "Toby", kind: "dog", color: "#c68b59", accent: "#5c3d2e", accessory: "scarf", description: "leal" },
      { id: "bit", name: "Bit", kind: "robot", color: "#cfd8dc", accent: t.palette.accent, accessory: "none", description: "servicial" },
    ],
    scenes: [
      {
        id: "s1", narration: `Esto es ${t.name}. ${t.tagline}.`, onScreenText: t.name,
        setting: style === "neon" ? "city" : style === "flat2d" ? "abstract" : "forest",
        timeOfDay: style === "neon" ? "night" : style === "cartoon3d" ? "sunset" : "day",
        camera: "orbit", emotion: "happy", transition: "fade",
        characters: [
          { id: "luna", action: "wave", position: "left", speaking: true },
          { id: "toby", action: "jump", position: "center", speaking: false },
          { id: "bit", action: "dance", position: "right", speaking: false },
        ],
        props: [
          { kind: style === "neon" ? "building" : "tree", count: 8, placement: "background" },
          { kind: "star", count: 3, placement: "floating" },
        ],
      },
    ],
  };
}
