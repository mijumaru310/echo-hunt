import type { GameDifficulty } from "./types.ts";

export const difficultyRules: Record<GameDifficulty, {
    label: string; description: string; showGauge: boolean; requiresLock: boolean;
    missRecoveryMs: number; hitRecoveryMs: number;
}> = {
    easy: {
        label: "イージー", description: "ゲージが満ちて合図が鳴ったら攻撃できます。",
        showGauge: true, requiresLock: true, missRecoveryMs: 0, hitRecoveryMs: 0,
    },
    normal: {
        label: "ノーマル", description: "ゲージと合図はありません。空振り後は少しの間、攻撃できません。",
        showGauge: false, requiresLock: false, missRecoveryMs: 650, hitRecoveryMs: 250,
    },
};
