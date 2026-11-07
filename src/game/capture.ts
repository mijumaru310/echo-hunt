import { wrapAngle } from "../sensors/heading.ts";
// 捕捉範囲（単位：度）
const captureRange: number = 15;

// ロックオン完了までの時間
export const captureTimeMs: number = 700;

// 満タンのゲージが0になる時間
// 指示書の例に合わせ、仮に400ミリ秒とする
const decayTimeMs: number = 400;

// 敵1体の捕捉状態
export interface CaptureState {
    progressMs: number;
    isCaptured: boolean;
}

// 敵が捕捉範囲内にいるか
export function isInCaptureRange(relAngle: number): boolean {
    const diff: number = Math.abs(relAngle);

    return diff <= captureRange;
}

// 方向と経過時間から、ロックオンの進捗を更新する
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
        // ボタン操作に関係なく、方向が合えば増える
        progressMs = progressMs + elapsedMs;
    } else {
        // 満タンから400ミリ秒で0になる速度で減る
        const decayRate: number = captureTimeMs / decayTimeMs;
        progressMs = progressMs - elapsedMs * decayRate;
    }

    progressMs = Math.max(0, Math.min(captureTimeMs, progressMs));

    // 満タンでも、この段階では捕獲しない
    return {
        progressMs: progressMs,
        isCaptured: false
    };
}

// 捕獲ボタンを押した瞬間に呼ぶ
export function tryCapture(
    state: CaptureState,
    relAngle: number
): CaptureState {
    // 捕獲済み・範囲外・ロックオン未完了なら何もしない
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
