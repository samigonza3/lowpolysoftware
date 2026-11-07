import React, { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useThree } from "@react-three/fiber";
import { continueRender, delayRender } from "remotion";
import * as THREE from "three";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";

/**
 * Carga de texturas y cielos 360° de la biblioteca.
 * Remotion espera (delayRender) a que la imagen esté lista antes de capturar el frame,
 * así el MP4 nunca sale con el suelo o el cielo "en blanco".
 */
const cache = new Map<string, Promise<THREE.Texture>>();

function load(url: string): Promise<THREE.Texture> {
  let p = cache.get(url);
  if (!p) {
    p = new Promise<THREE.Texture>((resolve, reject) => {
      if (/\.hdr(\?|$)/i.test(url)) new RGBELoader().load(url, resolve, undefined, reject);
      else new THREE.TextureLoader().load(url, (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        resolve(t);
      }, undefined, reject);
    });
    cache.set(url, p);
    p.catch(() => cache.delete(url));
  }
  return p;
}

export function useLoadedTexture(url?: string): THREE.Texture | null {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  const [handle] = useState(() => (url ? delayRender(`Cargando ${url}`, { timeoutInMilliseconds: 90_000 }) : null));
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!url) return;
    let alive = true;
    load(url)
      .then((t) => alive && setTex(t))
      .catch((e) => {
        console.warn("[assets] no se pudo cargar", url, e);
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [url]);
  // Se libera el frame solo después de que React pintó con la textura (o si falló, sin ella).
  useEffect(() => {
    if (handle !== null && (tex || failed)) continueRender(handle);
  }, [tex, failed, handle]);
  return tex;
}

/**
 * @remotion/three solo vuelve a dibujar el canvas cuando cambia el frame; si una textura llega después,
 * hay que pedirle que pinte otra vez (antes de liberar el delayRender).
 */
export function useRedrawWhen(dep: unknown) {
  const advance = useThree((st) => st.advance);
  useLayoutEffect(() => {
    if (dep) advance(performance.now());
  }, [dep, advance]);
}

/** Textura de suelo repetida en mosaico (cada ~4 unidades del mundo). Llamar desde el padre del suelo. */
export function useGroundTexture(url?: string): THREE.Texture | null {
  const base = useLoadedTexture(url);
  // useMemo (no un efecto) para que la textura esté lista en el mismo render en que termina la carga.
  return useMemo(() => {
    if (!base) return null;
    const t = base.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(30, 15);
    t.anisotropy = 8;
    t.needsUpdate = true;
    return t;
  }, [base]);
}

/** Cielo 360°: fondo de la escena + luz ambiental (reflejos) a partir de la panorámica. */
export const SkyEnvironment: React.FC<{ url: string; blur: number; intensity: number }> = ({ url, blur, intensity }) => {
  const tex = useLoadedTexture(url);
  const { scene, advance } = useThree();
  useLayoutEffect(() => {
    if (!tex) return;
    tex.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = tex;
    scene.environment = tex;
    scene.backgroundBlurriness = blur;
    scene.environmentIntensity = intensity;
    advance(performance.now());
    return () => {
      scene.background = null;
      scene.environment = null;
    };
  }, [tex, scene, blur, intensity, advance]);
  return null;
};
