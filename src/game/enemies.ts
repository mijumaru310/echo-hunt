import type { EnemyDefinition, EnemyKind } from "./types.ts";

/** 音・動き・難易度の調整はここに集約。座標は 0=正面、+90=右。 */
export const enemyDefinitions: Record<EnemyKind, EnemyDefinition> = {
    walker: {
        name: "のろりん", description: "ゆっくりと重い足取りで襲い掛かってくる",
        spawnDistance: 3, approachSpeed: 2 / 15, angularSpeed: 0,
        lockTimeMs: 700, windupMs: 1000, damage: 1, score: 100,
        soundUrl: "/sounds/footstep.wav", playbackRate: 1, volume: 0.85,
    },
    runner: {
        name: "はやべん", description: "走って襲い掛かってくる",
        spawnDistance: 3.4, approachSpeed: 0.4, angularSpeed: 0,
        lockTimeMs: 650, windupMs: 850, damage: 1, score: 150,
        soundUrl: "/sounds/footstep.wav", playbackRate: 1.55, volume: 0.8,
    },
    orbiter: {
        name: "まどらー", description: "移動して位置を変えながら近づいてくる",
        spawnDistance: 3.2, approachSpeed: 0.15, angularSpeed: 12,
        lockTimeMs: 700, windupMs: 1100, damage: 1, score: 180,
        soundUrl: "/sounds/breath.wav", playbackRate: 0.9, volume: 0.7,
    },
    lurker: {
        name: "はいどなー", description: "歩いた後に止まり、短く呼吸し息をひそめる ",
        spawnDistance: 3.2, approachSpeed: 0.19, angularSpeed: 0,
        lockTimeMs: 700, windupMs: 1300, damage: 1, score: 200,
        soundUrl: "/sounds/footstep.wav", playbackRate: 0.8, volume: 0.8,
        concealment: { moveMs: 2600, hideMs: 2200, breathMs: 900, breathUrl: "/sounds/breath.wav" },
    },
    warden: {
        name: "めれおろん", description: "鍵の音が止まり、息を吸う間だけ攻撃が通る。3回攻撃を当ててで倒せ！",
        spawnDistance: 3.4, approachSpeed: 0, angularSpeed: 8,
        lockTimeMs: 700, windupMs: 1100, damage: 1, score: 1000,
        soundUrl: "/sounds/footstep.wav", playbackRate: 0.6, volume: 0.95,
        boss: { health: 3, guardMs: 4200, exposedMs: 2400, recoveryMs: 1200 },
    },
};
