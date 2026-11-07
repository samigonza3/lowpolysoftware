import type { VideoSpec } from "./spec";

/**
 * Biblioteca de recursos visuales: texturas de suelo y cielos 360° (HDRI / panorámicas).
 * Los del catálogo vienen de Poly Haven (CC0, uso libre); el usuario también puede subir los suyos.
 */
export type AssetType = "texture" | "sky";

export interface Asset {
  id: string;
  type: AssetType;
  name: string;
  description: string; // para que el agente sepa cuándo usarlo
  url?: string; // /library/<id>/<archivo> cuando está instalado
  installed?: boolean;
  source: "polyhaven" | "upload";
  thumb?: string;
}

export interface CatalogItem {
  id: string;
  type: AssetType;
  name: string;
  description: string;
  slug: string; // id en Poly Haven
}

export const CATALOG: CatalogItem[] = [
  { id: "pasto", type: "texture", name: "Pasto con piedras", description: "pasto verde natural (bosque, granja, parque)", slug: "aerial_grass_rock" },
  { id: "sendero", type: "texture", name: "Sendero de pasto", description: "camino de tierra con pasto", slug: "grass_path_2" },
  { id: "tierra_bosque", type: "texture", name: "Suelo de bosque", description: "tierra con hojas secas (bosque, otoño)", slug: "forrest_ground_01" },
  { id: "arena", type: "texture", name: "Arena de playa", description: "arena clara (playa, desierto)", slug: "aerial_beach_01" },
  { id: "arena_costa", type: "texture", name: "Arena de costa", description: "arena húmeda de orilla", slug: "coast_sand_01" },
  { id: "nieve", type: "texture", name: "Nieve", description: "nieve blanca (invierno, montaña)", slug: "snow_02" },
  { id: "roca", type: "texture", name: "Terreno rocoso", description: "roca y piedras (montaña, cañón, luna)", slug: "rocky_terrain_02" },
  { id: "asfalto", type: "texture", name: "Asfalto", description: "calle de ciudad", slug: "asphalt_02" },
  { id: "concreto", type: "texture", name: "Piso de concreto", description: "piso industrial, laboratorio, garaje", slug: "concrete_floor_02" },
  { id: "madera_piso", type: "texture", name: "Piso laminado", description: "piso de madera interior (casa, oficina)", slug: "laminate_floor_02" },
  { id: "deck", type: "texture", name: "Deck de madera", description: "terraza o muelle de madera", slug: "wood_floor_deck" },
  { id: "ladrillo", type: "texture", name: "Ladrillo rojo", description: "ladrillo (plaza, patio, calle antigua)", slug: "red_brick_03" },
  { id: "cielo_nubes", type: "sky", name: "Cielo con nubes", description: "cielo azul de día con nubes", slug: "kloofendal_48d_partly_cloudy_puresky" },
  { id: "cielo_despejado", type: "sky", name: "Cielo despejado", description: "cielo de día limpio y luminoso", slug: "qwantani_puresky" },
  { id: "atardecer", type: "sky", name: "Atardecer", description: "cielo naranja de atardecer", slug: "belfast_sunset_puresky" },
  { id: "cielo_fuego", type: "sky", name: "Cielo en llamas", description: "atardecer dramático rojo y morado", slug: "the_sky_is_on_fire" },
  { id: "amanecer", type: "sky", name: "Amanecer", description: "amanecer suave", slug: "kiara_1_dawn" },
  { id: "noche_estrellas", type: "sky", name: "Noche estrellada", description: "noche con estrellas", slug: "satara_night" },
  { id: "noche_campo", type: "sky", name: "Noche sin luna", description: "noche oscura en el campo", slug: "moonless_golf" },
  { id: "ciudad", type: "sky", name: "Plaza de ciudad", description: "edificios reales alrededor (ciudad)", slug: "potsdamer_platz" },
  { id: "venecia", type: "sky", name: "Venecia al atardecer", description: "ciudad junto al agua al atardecer", slug: "venice_sunset" },
  { id: "bosque", type: "sky", name: "Ladera de bosque", description: "bosque real alrededor", slug: "forest_slope" },
  { id: "campo_nevado", type: "sky", name: "Campo nevado", description: "paisaje con nieve", slug: "snowy_field" },
  { id: "estudio", type: "sky", name: "Estudio de fotografía", description: "estudio limpio (productos, presentaciones)", slug: "studio_small_08" },
];

/** Estilos donde las texturas realistas tienen sentido (en flat2d y neón rompen la estética). */
export const TEXTURE_STYLES = new Set(["lowpoly", "cartoon3d", "clay"]);

/** Copia en el spec las URLs de los recursos que usan las escenas (el motor de render no lee la biblioteca). */
export function withAssets(spec: VideoSpec, library: Asset[]): VideoSpec {
  const used = new Set(spec.scenes.flatMap((s) => [s.ground, s.sky]).filter(Boolean) as string[]);
  const assets: VideoSpec["assets"] = {};
  for (const a of library) if (used.has(a.id) && a.installed && a.url) assets[a.id] = { type: a.type, url: a.url };
  return { ...spec, assets };
}
