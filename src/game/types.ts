import type { CaptureState } from "./capture.ts";

export type EnemyMode = "stationary" | "moving" | "approaching";
export type FinishReason = "time" | "cleared" | "defeated";
export type GameDifficulty = "easy" | "normal";

export interface Enemy {
    worldYaw: number;
    distance: number;
    id: string;
    // 角速度（度/秒）。0なら静止、正負で移動方向を変える。
    angularVelocity: number;
    capture: CaptureState;
}

export type EnemyKind = "walker" | "runner" | "orbiter" | "lurker" | "warden";
export type EnemyPhase = "approaching" | "hiding" | "winding-up" | "defeated" | "retreating" | "guarding" | "exposed" | "recovering";

export interface EnemyDefinition {
    name: string;
    description: string;
    spawnDistance: number;
    approachSpeed: number;
    angularSpeed: number;
    lockTimeMs: number;
    windupMs: number;
    damage: number;
    score: number;
    soundUrl: string;
    playbackRate: number;
    volume: number;
    concealment?: { moveMs: number; hideMs: number; breathMs: number; breathUrl: string };
    boss?: { health: number; guardMs: number; exposedMs: number; recoveryMs: number };
}

export interface CombatEnemy extends Enemy {
    kind: EnemyKind;
    phase: EnemyPhase;
    phaseRemainingMs: number;
    approachSpeed: number;
    lockTimeMs: number;
    behaviorRemainingMs: number;
    health: number;
    maxHealth: number;
}

export interface Phantom {
    id: string;
    worldYaw: number;
    distance: number;
    bornAtMs: number;
    remainingMs: number;
}

export type HauntingKind = "knock" | "whisper" | "door";

export interface SpawnDefinition {
    kind: EnemyKind;
    /** 練習用の上書き。省略すると敵の定義値を使う。 */
    approachSpeed?: number;
    angularSpeed?: number;
}

export interface WaveDefinition {
    name: string;
    enemies: readonly SpawnDefinition[];
}

export interface StageDefinition {
    id: string;
    name: string;
    subtitle: string;
    description: string;
    hint: string;
    difficulty: string;
    initialLife: number;
    /** waves: 全ウェーブを生き延びる / timed: 制限時間を生き延びる練習 */
    mode: "waves" | "timed";
    durationMs?: number;
    waves: readonly WaveDefinition[];
    maxConcurrent: number;
    spawnIntervalMs: number;
    waveBreakMs: number;
    defeatPauseMs: number;
    /** "mansion" は既存パノラマ。ほかは public 配下などの画像URL。 */
    background: string;
    ambientSoundUrl?: string;
    haunting?: { fakeIntervalMs: number; fakeLifetimeMs: number; atmosphereIntervalMs: number };
}

export type GameStatus = "ready" | "playing" | "paused" | "finished";

export interface GameResult {
    difficulty: GameDifficulty;
    stageId: string;
    stageName: string;
    reason: FinishReason;
    score: number;
    defeated: number;
    escaped: number;
    maxCombo: number;
    life: number;
    maxLife: number;
    elapsedMs: number;
    wavesCleared: number;
    waveCount: number;
    shots: number;
    misses: number;
}

export interface GameSnapshot {
    difficulty: GameDifficulty;
    ending: boolean;
    status: GameStatus;
    elapsedMs: number;
    remainingMs: number | null;
    life: number;
    maxLife: number;
    score: number;
    defeated: number;
    escaped: number;
    combo: number;
    maxCombo: number;
    waveIndex: number;
    waveCount: number;
    waveName: string;
    waveRemaining: number;
    invincibleMs: number;
    targetId: string | null;
    enemies: readonly CombatEnemy[];
    result: GameResult | null;
    attackRecoveryMs: number;
    shots: number;
    misses: number;
    phantoms: readonly Phantom[];
}

export type GameEvent =
    | { type: "spawned"; enemy: CombatEnemy }
    | { type: "lock-ready"; enemyId: string }
    | { type: "attack-missed" }
    | { type: "attack-blocked"; enemy: CombatEnemy }
    | { type: "boss-opening"; enemy: CombatEnemy }
    | { type: "enemy-hit"; enemy: CombatEnemy; points: number }
    | { type: "haunting"; kind: HauntingKind; worldYaw: number; distance: number }
    | { type: "attack-warning"; enemy: CombatEnemy }
    | { type: "enemy-defeated"; enemy: CombatEnemy; points: number; combo: number }
    | { type: "player-damaged"; enemy: CombatEnemy; life: number; damage: number }
    | { type: "wave-started"; index: number; name: string }
    | { type: "finished"; result: GameResult };
