import { wrapAngle } from "../sensors/heading.ts";
// 捕捉範囲（単位：度）
const captureRange: number = 15;

export const captureTimeMs: number = 700;

// 範囲外で、満タンのゲージが0になるまでの時間。
const decayTimeMs: number = 400;

export interface CaptureState {
    progressMs: number;
    isCaptured: boolean;
}

export function isInCaptureRange(relAngle: number): boolean {
    const diff: number = Math.abs(relAngle);

    return diff <= captureRange;
}

// ロックの蓄積と撃破は別処理。満タンになってもタップまでは撃破しない。
export function updateCapture(
    state: CaptureState,
    relAngle: number,
    dtMs: number
): CaptureState {
    if (state.isCaptured) {
        return state;
    }

    const elapsedMs: number = Number.isFinite(dtMs) ? Math.max(0, dtMs) : 0;
    let progressMs: number = state.progressMs;

    if (isInCaptureRange(relAngle)) {
        progressMs = progressMs + elapsedMs;
    } else {
        const decayRate: number = captureTimeMs / decayTimeMs;
        progressMs = progressMs - elapsedMs * decayRate;
    }

    progressMs = Math.max(0, Math.min(captureTimeMs, progressMs));

    return {
        progressMs: progressMs,
        isCaptured: false
    };
}

export function tryCapture(
    state: CaptureState,
    relAngle: number
): CaptureState {
    if (
        state.isCaptured ||
        !isInCaptureRange(relAngle) ||
        state.progressMs < captureTimeMs
    ) {
        return state;
    }

    return {
        progressMs: state.progressMs,
        isCaptured: true
    };
}

export function relativeAngle(
    enemyYaw: number,
    playerYaw: number
): number {
    const relAngle: number = wrapAngle((enemyYaw - playerYaw) % 360);
    return relAngle;
}
