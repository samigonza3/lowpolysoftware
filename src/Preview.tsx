import React, { forwardRef, useEffect, useMemo, useState } from "react";
import { withAssets, type Asset } from "../shared/library";
import { loadLibrary } from "./api";
import { Player, type PlayerRef } from "@remotion/player";
import { ASPECTS, totalFrames, type VideoSpec } from "../shared/spec";
import { VideoComposition } from "../remotion/VideoComposition";

export const Preview = forwardRef<PlayerRef, { spec: VideoSpec; autoPlay?: boolean; loop?: boolean; maxHeight?: number; safeZone?: boolean }>(
  ({ spec, autoPlay, loop = true, maxHeight = 520, safeZone = false }, ref) => {
    const [lib, setLib] = useState<Asset[]>([]);
    useEffect(() => {
      loadLibrary().then(setLib).catch(() => {});
      const on = () => loadLibrary().then(setLib).catch(() => {});
      window.addEventListener("library-changed", on);
      return () => window.removeEventListener("library-changed", on);
    }, []);
    // la vista previa resuelve las texturas/cielos igual que el render del servidor
    const full = useMemo(() => withAssets(spec, lib), [spec, lib]);
    const [w, h] = ASPECTS[spec.aspect] ?? ASPECTS["16:9"];
    const frames = Math.max(1, totalFrames(spec));
    return (
      <div className="player-wrap" style={{ aspectRatio: `${w}/${h}`, maxHeight, maxWidth: (maxHeight * w) / h }}>
        <Player
          ref={ref}
          component={VideoComposition}
          inputProps={{ spec: full, assetBase: "", showSafeZone: safeZone }}
          durationInFrames={frames}
          compositionWidth={w}
          compositionHeight={h}
          fps={spec.fps}
          controls
          autoPlay={autoPlay}
          initialFrame={Math.min(20, frames - 1)}
          loop={loop}
          acknowledgeRemotionLicense
          style={{ width: "100%", height: "100%" }}
        />
      </div>
    );
  },
);
Preview.displayName = "Preview";
