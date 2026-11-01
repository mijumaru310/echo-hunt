import type { CaptureState } from "./capture.ts";
export interface Enemy {
    worldYaw: number;
    distance: number;
    id: string;
    capture: CaptureState;
}