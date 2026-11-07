import type { EnemyDefinition, EnemyKind } from "./types.ts";

/** 音・動き・難易度の調整はここに集約。座標は 0=正面、+90=右。 */
export const enemyDefinitions: Record<EnemyKind, EnemyDefinition> = {
    walker: {
        name: "足音の主", description: "重い足音。まっすぐ、ゆっくり近づく。",
        spawnDistance: 3, approachSpeed: 2 / 15, angularSpeed: 0,
        lockTimeMs: 700, windupMs: 1000, damage: 1, score: 100,
        soundUrl: "/sounds/footstep.wav", playbackRate: 1, volume: 0.85,
    },
    runner: {
        name: "駆ける影", description: "速く刻む足音。ためらう時間は短い。",
        spawnDistance: 3.4, approachSpeed: 0.3, angularSpeed: 0,
        lockTimeMs: 650, windupMs: 850, damage: 1, score: 150,
        soundUrl: "/sounds/footstep.wav", playbackRate: 1.55, volume: 0.8,
    },
    orbiter: {
        name: "さまよう息", description: "低い呼吸音。回り込みながら近づく。",
        spawnDistance: 3.2, approachSpeed: 0.15, angularSpeed: 12,
        lockTimeMs: 700, windupMs: 1100, damage: 1, score: 180,
        soundUrl: "/sounds/breath.wav", playbackRate: 0.9, volume: 0.7,
    },
};
