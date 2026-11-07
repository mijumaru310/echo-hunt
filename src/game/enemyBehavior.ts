import { enemyDefinitions } from "./enemies.ts";
import type { CombatEnemy } from "./types.ts";

export function isActiveEnemy(enemy: CombatEnemy): boolean {
    return enemy.phase !== "defeated" && enemy.phase !== "retreating";
}

export function isEnemyVulnerable(enemy: CombatEnemy): boolean {
    if (!isActiveEnemy(enemy)) return false;
    return !enemyDefinitions[enemy.kind].boss || enemy.phase === "exposed" || enemy.phase === "winding-up";
}

/** 音の停止は向きではなく敵自身の行動で決まる。隠れても同じ位置にいる。 */
export function getEnemyVoice(enemy: CombatEnemy): { key: string; url: string; volume: number; playbackRate: number } | null {
    const definition = enemyDefinitions[enemy.kind];
    if (enemy.phase === "hiding" && definition.concealment) {
        const silenceMs = definition.concealment.hideMs - definition.concealment.breathMs;
        const audibleMs = enemy.phaseRemainingMs - silenceMs;
        if (audibleMs <= 0) return null;
        return { key: "breath", url: definition.concealment.breathUrl,
            volume: 0.6 * Math.min(1, audibleMs / 150), playbackRate: 0.85 };
    }
    if (enemy.phase !== "approaching" && enemy.phase !== "guarding") return null;
    return { key: "movement", url: definition.soundUrl, volume: definition.volume, playbackRate: definition.playbackRate };
}

/** 同じ強さの3歩→長い間。近づかず、呼吸もしないのがフェイクの手がかり。 */
export function phantomPulse(ageMs: number): { index: number; justStarted: boolean } {
    const cycle = Math.floor(ageMs / 2400);
    const local = ageMs % 2400;
    const step = local >= 840 ? 2 : local >= 420 ? 1 : 0;
    return { index: cycle * 3 + step, justStarted: local - step * 420 < 100 };
}
