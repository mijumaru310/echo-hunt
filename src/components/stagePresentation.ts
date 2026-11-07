import type { CSSProperties } from "react";
import mansionPanorama from "../assets/mansion-panorama.jpg";

export function stageBackgroundStyle(background: string): CSSProperties {
    const url = background === "mansion" ? mansionPanorama : background;
    return { "--stage-background": `url(${JSON.stringify(url)})` } as CSSProperties;
}
