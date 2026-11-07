import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { CATALOG, type Asset, type AssetType } from "../shared/library";
import { DATA_DIR } from "./paths";

/** Biblioteca local en data/library/<id>/… ; los subidos por el usuario se listan en library.json. */
export const LIBRARY_DIR = path.join(DATA_DIR, "library");
const META = path.join(LIBRARY_DIR, "library.json");

const readUploads = (): Asset[] => {
  try {
    return JSON.parse(fs.readFileSync(META, "utf8")).uploads ?? [];
  } catch {
    return [];
  }
};
const writeUploads = (uploads: Asset[]) => {
  fs.mkdirSync(LIBRARY_DIR, { recursive: true });
  fs.writeFileSync(META, JSON.stringify({ uploads }, null, 2));
};

function installedFile(id: string): string | null {
  const dir = path.join(LIBRARY_DIR, id);
  if (!fs.existsSync(dir)) return null;
  return fs.readdirSync(dir).find((f) => /^(diffuse|sky)\./.test(f)) ?? null;
}

export function listLibrary(): Asset[] {
  const catalog: Asset[] = CATALOG.map((c) => {
    const file = installedFile(c.id);
    return {
      id: c.id, type: c.type, name: c.name, description: c.description, source: "polyhaven",
      installed: Boolean(file), url: file ? `/library/${c.id}/${file}` : undefined,
      thumb: `https://cdn.polyhaven.com/asset_img/thumbs/${c.slug}.png?width=240&height=140`,
    };
  });
  const uploads = readUploads().map((u) => {
    const file = installedFile(u.id);
    return { ...u, installed: Boolean(file), url: file ? `/library/${u.id}/${file}` : undefined };
  });
  return [...catalog, ...uploads];
}

export const installedLibrary = () => listLibrary().filter((a) => a.installed);

/** Descarga un recurso del catálogo (texturas 1K jpg, cielos HDRI 1K). */
export async function installAsset(id: string) {
  const item = CATALOG.find((c) => c.id === id);
  if (!item) throw Object.assign(new Error("Recurso no encontrado"), { status: 404 });
  if (installedFile(id)) return;
  const res = await fetch(`https://api.polyhaven.com/files/${item.slug}`);
  if (!res.ok) throw new Error(`Poly Haven respondió ${res.status}`);
  const files = (await res.json()) as Record<string, Record<string, Record<string, { url: string }>>>;
  const url = item.type === "texture" ? files.Diffuse?.["1k"]?.jpg?.url : files.hdri?.["1k"]?.hdr?.url;
  if (!url) throw new Error("No se encontró el archivo en Poly Haven");
  const bin = await fetch(url);
  if (!bin.ok) throw new Error(`Descarga falló (${bin.status})`);
  const dir = path.join(LIBRARY_DIR, id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, item.type === "texture" ? "diffuse.jpg" : "sky.hdr"), Buffer.from(await bin.arrayBuffer()));
}

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/vnd.radiance": "hdr" };

/** Sube una textura o panorámica propia (base64). */
export function uploadAsset(body: { type: AssetType; name: string; description?: string; data: string; mime: string; filename?: string }) {
  const isHdr = /\.hdr$/i.test(body.filename ?? "") || body.mime === "image/vnd.radiance";
  const ext = isHdr ? "hdr" : EXT[body.mime];
  if (!ext) throw Object.assign(new Error("Formato no soportado: usa JPG, PNG o HDR"), { status: 400 });
  if (ext === "hdr" && body.type !== "sky") throw Object.assign(new Error("Los .hdr solo sirven como cielo 360°"), { status: 400 });
  const buf = Buffer.from(body.data, "base64");
  if (buf.length > 25 * 1024 * 1024) throw Object.assign(new Error("Archivo muy grande (máx. 25 MB)"), { status: 400 });
  const base = (body.name || "recurso").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 24);
  const id = `mi_${base || "recurso"}_${crypto.randomBytes(2).toString("hex")}`;
  const dir = path.join(LIBRARY_DIR, id);
  fs.mkdirSync(dir, { recursive: true });
  const file = `${body.type === "texture" ? "diffuse" : "sky"}.${ext}`;
  fs.writeFileSync(path.join(dir, file), buf);
  const asset: Asset = {
    id, type: body.type, name: body.name || "Mi recurso", description: body.description?.trim() || body.name || "recurso del usuario",
    source: "upload", thumb: ext === "hdr" ? undefined : `/library/${id}/${file}`,
  };
  writeUploads([...readUploads(), asset]);
  return asset;
}

export function removeAsset(id: string) {
  if (!/^[a-z0-9_]+$/.test(id)) throw Object.assign(new Error("id inválido"), { status: 400 });
  fs.rmSync(path.join(LIBRARY_DIR, id), { recursive: true, force: true });
  writeUploads(readUploads().filter((u) => u.id !== id));
}
