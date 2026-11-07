import React from "react";
import { Composition, registerRoot } from "remotion";
import { ASPECTS, totalFrames } from "../shared/spec";
import { demoSpec } from "../shared/templates";
import { VideoComposition, type VideoProps } from "./VideoComposition";

const Root: React.FC = () => (
  <Composition
    id="Video"
    component={VideoComposition as unknown as React.FC<Record<string, unknown>>}
    width={1920}
    height={1080}
    fps={30}
    durationInFrames={150}
    defaultProps={{ spec: demoSpec("lowpoly"), assetBase: "" } satisfies VideoProps}
    calculateMetadata={({ props }) => {
      const { spec } = props as unknown as VideoProps;
      const [width, height] = ASPECTS[spec.aspect] ?? ASPECTS["16:9"];
      return { width, height, fps: spec.fps, durationInFrames: Math.max(1, totalFrames(spec)) };
    }}
  />
);

registerRoot(Root);
