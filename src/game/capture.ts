//捕捉範囲
const captureRange: number = 5;

//敵が捕捉範囲内にいるかを判定する関数
export function isInCaptureRange(relAngle: number): boolean {
    const diff: number = Math.abs(relAngle);
    return diff <= captureRange;
}

// 捕獲に必要な時間：1000ミリ秒＝1秒
export const captureTimeMs: number = 1000;

// ゲージの減少倍率
const decayRate: number = 1;

// 敵1体の捕捉状態
export interface CaptureState {
    progressMs: number;   // 捕捉ゲージ
    isCaptured: boolean;  // 捕獲済みか
}

// 捕捉ゲージと捕獲状態を更新する
export function updateCapture(
    state: CaptureState,
    relAngle: number,
    isHolding: boolean,
    dtMs: number
): CaptureState {
    // 捕獲済みなら、その状態を維持
    if (state.isCaptured) {
        return state;
    }

    // 経過時間が負にならないようにする
    const elapsedMs: number = Math.max(0, dtMs);

    let progressMs: number = state.progressMs;

    if (isHolding && isInCaptureRange(relAngle)) {
        // 長押し中で、敵が範囲内なら増加
        progressMs = progressMs + elapsedMs;
    } else {
        // 指を離したか、敵が範囲外なら減少
        progressMs = progressMs - elapsedMs * decayRate;
    }

    // ゲージを0〜1000ミリ秒の範囲に収める
    progressMs = Math.max(0, Math.min(captureTimeMs, progressMs));

    return {
        progressMs: progressMs,
        isCaptured: progressMs >= captureTimeMs
    };
}