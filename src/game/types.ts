import type { CaptureState } from "./capture.ts";

export type EnemyMode = "stationary" | "moving" | "approaching";
export type FinishReason = "time" | "caught";

export interface Enemy {
    worldYaw: number;
    distance: number;
    id: string;
    // 角速度（度/秒）。0なら静止、正負で移動方向を変える。
    angularVelocity: number;
    capture: CaptureState;
}
