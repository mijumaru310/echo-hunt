import { enemyDefinitions } from "./enemies.ts";
import { isInCaptureRange, relativeAngle } from "./capture.ts";
import { validateStage } from "./stages.ts";
import { difficultyRules } from "./difficulty.ts";
import { isActiveEnemy, isEnemyVulnerable } from "./enemyBehavior.ts";
import { recoverBoss, updateBoss } from "./bossBehavior.ts";
import type { CombatEnemy, FinishReason, GameDifficulty, GameEvent, GameResult, GameSnapshot, GameStatus, HauntingKind, Phantom, StageDefinition } from "./types.ts";

export const attackDistance = 1;
export const invincibilityMs = 1600;
const decayTimeMs = 400;

/** DOM・音声・Reactに依存しない戦闘。時間は update() だけが進める。 */
export class GameEngine {
    readonly stage: StageDefinition;
    readonly difficulty: GameDifficulty;
    private random: () => number;
    private status: GameStatus = "ready";
    private elapsedMs = 0;
    private life: number;
    private score = 0;
    private defeated = 0;
    private escaped = 0;
    private combo = 0;
    private maxCombo = 0;
    private waveIndex = 0;
    private spawnIndex = 0;
    private sequence = 0;
    private spawnWaitMs = 600;
    private breakRemainingMs: number | null = null;
    private quietRemainingMs = 0;
    private invincibleRemainingMs = 0;
    private targetId: string | null = null;
    private enemies: CombatEnemy[] = [];
    private result: GameResult | null = null;
    private events: GameEvent[] = [];
    private attackRecoveryMs = 0;
    private shots = 0;
    private misses = 0;
    private phantoms: Phantom[] = [];
    private fakeWaitMs: number;
    private atmosphereWaitMs: number;

    constructor(stage: StageDefinition, random: () => number = Math.random, difficulty: GameDifficulty = "easy") {
        validateStage(stage);
        this.stage = stage;
        this.difficulty = difficulty;
        this.random = random;
        this.life = stage.initialLife;
        this.fakeWaitMs = stage.haunting?.fakeIntervalMs ? Math.min(1800, stage.haunting.fakeIntervalMs) : Infinity;
        this.atmosphereWaitMs = stage.haunting?.atmosphereIntervalMs ? Math.min(4200, stage.haunting.atmosphereIntervalMs) : Infinity;
    }

    start(): void {
        if (this.status !== "ready") return;
        this.status = "playing";
        this.events.push({ type: "wave-started", index: 0, name: this.stage.waves[0].name });
    }

    pause(): void { if (this.status === "playing") this.status = "paused"; }
    resume(): void { if (this.status === "paused") this.status = "playing"; }

    update(dtMs: number, playerYaw: number): void {
        if (this.status !== "playing" || !Number.isFinite(dtMs) || dtMs <= 0 || !Number.isFinite(playerYaw)) return;
        // 小刻みに進め、低fps時も予告・攻撃・無敵時間の順序を保つ。
        let remainingMs = dtMs;
        while (remainingMs > 0 && this.status === "playing") {
            const timeLeftMs = this.stage.mode === "timed" ? (this.stage.durationMs ?? 0) - this.elapsedMs : Infinity;
            if (timeLeftMs <= 0) { this.finish("time"); break; }
            const stepMs = Math.min(remainingMs, 25, timeLeftMs);
            this.step(stepMs, playerYaw);
            remainingMs -= stepMs;
            if (this.status === "playing" && this.stage.mode === "timed" && this.elapsedMs >= (this.stage.durationMs ?? 0)) this.finish("time");
        }
    }

    private step(dtMs: number, playerYaw: number): void {
        this.elapsedMs += dtMs;
        this.invincibleRemainingMs = Math.max(0, this.invincibleRemainingMs - dtMs);
        this.quietRemainingMs = Math.max(0, this.quietRemainingMs - dtMs);
        this.attackRecoveryMs = Math.max(0, this.attackRecoveryMs - dtMs);

        for (const enemy of this.enemies) {
            if (enemy.phase === "defeated" || enemy.phase === "retreating") {
                enemy.phaseRemainingMs -= dtMs;
                continue;
            }
            if (enemyDefinitions[enemy.kind].boss) {
                const action = updateBoss(enemy, dtMs, this.difficulty, this.random);
                if (action === "opening") {
                    this.phantoms = [];
                    this.events.push({ type: "boss-opening", enemy: this.copyEnemy(enemy) });
                } else if (action === "warning") {
                    this.events.push({ type: "attack-warning", enemy: this.copyEnemy(enemy) });
                } else if (action === "attack") {
                    this.combo = 0;
                    this.damagePlayer(enemy);
                    if (this.status === "finished") return;
                    this.quietRemainingMs = Math.max(this.quietRemainingMs, 650);
                }
                continue;
            }
            if (enemy.phase === "hiding") {
                enemy.phaseRemainingMs -= dtMs;
                if (enemy.phaseRemainingMs <= 0) {
                    enemy.phase = "approaching";
                    enemy.phaseRemainingMs = 0;
                    enemy.behaviorRemainingMs = enemyDefinitions[enemy.kind].concealment?.moveMs ?? 0;
                }
                continue;
            }
            if (enemy.phase === "winding-up") {
                enemy.phaseRemainingMs -= dtMs;
                if (enemy.phaseRemainingMs <= 0) {
                    // 敵は攻撃後に離脱する。同じ敵が毎フレームダメージを与えない。
                    enemy.phase = "retreating";
                    enemy.phaseRemainingMs = 450;
                    this.escaped++;
                    this.combo = 0;
                    this.damagePlayer(enemy);
                    if (this.status === "finished") return;
                    this.quietRemainingMs = Math.max(this.quietRemainingMs, 650);
                }
                continue;
            }
            enemy.worldYaw = relativeAngle(enemy.worldYaw + enemy.angularVelocity * dtMs / 1000, 0);
            enemy.distance = Math.max(attackDistance, enemy.distance - enemy.approachSpeed * dtMs / 1000);
            if (enemy.approachSpeed > 0 && enemy.distance <= attackDistance) {
                enemy.phase = "winding-up";
                enemy.phaseRemainingMs = enemyDefinitions[enemy.kind].windupMs;
                this.events.push({ type: "attack-warning", enemy: this.copyEnemy(enemy) });
            } else {
                const concealment = enemyDefinitions[enemy.kind].concealment;
                if (concealment) {
                    enemy.behaviorRemainingMs -= dtMs;
                    if (enemy.behaviorRemainingMs <= 0) {
                        enemy.phase = "hiding";
                        enemy.phaseRemainingMs = concealment.hideMs;
                    }
                }
            }
        }
        this.enemies = this.enemies.filter((enemy) => !((enemy.phase === "defeated" || enemy.phase === "retreating") && enemy.phaseRemainingMs <= 0));
        this.updateTarget(playerYaw, dtMs);
        this.updateHaunting(dtMs, playerYaw);

        if (this.breakRemainingMs !== null) {
            this.breakRemainingMs -= dtMs;
            if (this.breakRemainingMs <= 0) {
                this.breakRemainingMs = null;
                this.waveIndex++;
                this.spawnIndex = 0;
                this.spawnWaitMs = 600;
                this.events.push({ type: "wave-started", index: this.waveIndex, name: this.stage.waves[this.waveIndex].name });
            }
            return;
        }

        const wave = this.stage.waves[this.waveIndex];
        const allSpawned = this.stage.mode === "waves" && this.spawnIndex >= wave.enemies.length;
        if (allSpawned && this.enemies.length === 0 && this.quietRemainingMs === 0) {
            if (this.waveIndex === this.stage.waves.length - 1) this.finish("cleared");
            else this.breakRemainingMs = this.stage.waveBreakMs;
            return;
        }

        this.spawnWaitMs = Math.max(0, this.spawnWaitMs - dtMs);
        if (!allSpawned && this.enemies.length < this.stage.maxConcurrent && this.spawnWaitMs === 0 && this.quietRemainingMs === 0) {
            const spawn = wave.enemies[this.spawnIndex % wave.enemies.length];
            const definition = enemyDefinitions[spawn.kind];
            const enemy: CombatEnemy = {
                id: `enemy-${++this.sequence}`, kind: spawn.kind,
                phase: definition.boss ? "guarding" : "approaching", phaseRemainingMs: definition.boss?.guardMs ?? 0,
                worldYaw: this.random() * 360 - 180, distance: definition.spawnDistance,
                angularVelocity: (spawn.angularSpeed ?? definition.angularSpeed) * (this.random() < 0.5 ? -1 : 1),
                approachSpeed: spawn.approachSpeed ?? definition.approachSpeed, lockTimeMs: definition.lockTimeMs,
                capture: { progressMs: 0, isCaptured: false },
                behaviorRemainingMs: definition.concealment?.moveMs ?? 0,
                health: definition.boss?.health ?? 1, maxHealth: definition.boss?.health ?? 1,
            };
            this.enemies.push(enemy);
            this.spawnIndex++;
            this.spawnWaitMs = this.stage.spawnIntervalMs;
            this.events.push({ type: "spawned", enemy: this.copyEnemy(enemy) });
        }
    }

    private isActive(enemy: CombatEnemy): boolean {
        return isActiveEnemy(enemy);
    }

    private damagePlayer(enemy: CombatEnemy): void {
        if (this.invincibleRemainingMs > 0) return;
        const damage = Math.min(this.life, enemyDefinitions[enemy.kind].damage);
        this.life -= damage;
        this.invincibleRemainingMs = invincibilityMs;
        this.events.push({ type: "player-damaged", enemy: this.copyEnemy(enemy), life: this.life, damage });
        if (this.life === 0) this.finish("defeated");
    }

    /** 範囲内にいる間は同じ敵を保持。外れたらゲージを減らし、次の1体を選ぶ。 */
    private updateTarget(playerYaw: number, dtMs: number): void {
        // ノーマルではロック自体を作らず、攻撃した瞬間の方向だけで判定する。
        if (!difficultyRules[this.difficulty].requiresLock) {
            this.targetId = null;
            return;
        }
        const vulnerableEnemies = this.enemies.filter(isEnemyVulnerable);
        const currentTarget = vulnerableEnemies.find((enemy) => enemy.id === this.targetId);
        let lockTarget = currentTarget && isInCaptureRange(relativeAngle(currentTarget.worldYaw, playerYaw)) ? currentTarget : undefined;
        if (!lockTarget) {
            lockTarget = vulnerableEnemies.filter((enemy) => isInCaptureRange(relativeAngle(enemy.worldYaw, playerYaw)))
                .sort((a, b) => Math.abs(relativeAngle(a.worldYaw, playerYaw)) - Math.abs(relativeAngle(b.worldYaw, playerYaw)) || a.distance - b.distance)[0];
        }
        this.targetId = lockTarget?.id ?? null;
        for (const enemy of vulnerableEnemies) {
            const wasReady = enemy.capture.progressMs >= enemy.lockTimeMs;
            enemy.capture.progressMs = Math.max(0, Math.min(enemy.lockTimeMs,
                enemy.capture.progressMs + (enemy === lockTarget ? dtMs : -dtMs * enemy.lockTimeMs / decayTimeMs)));
            if (enemy === lockTarget && !wasReady && enemy.capture.progressMs >= enemy.lockTimeMs) {
                this.events.push({ type: "lock-ready", enemyId: enemy.id });
            }
        }
    }

    attack(playerYaw: number): boolean {
        if (this.status !== "playing" || this.isEnding() || !Number.isFinite(playerYaw) || this.attackRecoveryMs > 0) return false;
        const attackRules = difficultyRules[this.difficulty];
        const enemy = attackRules.requiresLock
            ? this.enemies.find((candidateEnemy) => candidateEnemy.id === this.targetId && this.isActive(candidateEnemy))
            : this.enemies.filter((candidateEnemy) => this.isActive(candidateEnemy) && isInCaptureRange(relativeAngle(candidateEnemy.worldYaw, playerYaw)))
                .sort((a, b) => Math.abs(relativeAngle(a.worldYaw, playerYaw)) - Math.abs(relativeAngle(b.worldYaw, playerYaw)) || a.distance - b.distance)[0];
        const hit = enemy && isInCaptureRange(relativeAngle(enemy.worldYaw, playerYaw))
            && (!attackRules.requiresLock || enemy.capture.progressMs >= enemy.lockTimeMs);
        if (!hit) {
            if (attackRules.requiresLock) return false;
            this.shots++;
            this.misses++;
            this.combo = 0;
            this.attackRecoveryMs = attackRules.missRecoveryMs;
            this.events.push({ type: "attack-missed" });
            return false;
        }
        if (!isEnemyVulnerable(enemy)) {
            this.shots++;
            this.misses++;
            this.combo = 0;
            this.attackRecoveryMs = attackRules.missRecoveryMs;
            this.events.push({ type: "attack-blocked", enemy: this.copyEnemy(enemy) });
            return false;
        }
        this.shots++;
        this.attackRecoveryMs = attackRules.hitRecoveryMs;
        enemy.health--;
        if (enemy.health > 0) {
            recoverBoss(enemy);
            this.targetId = null;
            this.phantoms = [];
            this.quietRemainingMs = 650;
            this.score += 50;
            this.events.push({ type: "enemy-hit", enemy: this.copyEnemy(enemy), points: 50 });
            return true;
        }
        enemy.phase = "defeated";
        enemy.phaseRemainingMs = this.stage.defeatPauseMs;
        enemy.capture.isCaptured = true;
        this.targetId = null;
        this.defeated++;
        this.combo++;
        this.maxCombo = Math.max(this.maxCombo, this.combo);
        const points = enemyDefinitions[enemy.kind].score + Math.min(4, this.combo - 1) * 25;
        this.score += points;
        // 余韻中は次の出現を止める。既存の敵は動き続ける。
        this.quietRemainingMs = this.stage.defeatPauseMs;
        this.phantoms = [];
        this.events.push({ type: "enemy-defeated", enemy: this.copyEnemy(enemy), points, combo: this.combo });
        return true;
    }

    private updateHaunting(dtMs: number, playerYaw: number): void {
        const config = this.stage.haunting;
        if (!config) return;
        const threats = this.enemies.filter(isActiveEnemy);
        // 撃破の確定音とウェーブ間の静けさに、偽物を割り込ませない。
        if (!threats.length || this.quietRemainingMs > 0 || this.breakRemainingMs !== null
            || threats.some((enemy) => enemyDefinitions[enemy.kind].boss && enemy.phase !== "guarding")) {
            this.phantoms = [];
            return;
        }
        for (const phantom of this.phantoms) phantom.remainingMs -= dtMs;
        this.phantoms = this.phantoms.filter((phantom) => phantom.remainingMs > 0);
        this.fakeWaitMs -= dtMs;
        if (config.fakeIntervalMs > 0 && this.fakeWaitMs <= 0 && !this.phantoms.length) {
            // 本物と同じ方向に重ねず、音を聞き分けて判断できる配置にする。
            const baseYaw = this.random() * 360 - 180;
            const yaw = Array.from({ length: 8 }, (_, index) => relativeAngle(baseYaw + index * 45, 0))
                .find((candidate) => threats.every((enemy) => Math.abs(relativeAngle(candidate, enemy.worldYaw)) >= 55));
            if (yaw !== undefined) this.phantoms.push({
                id: `phantom-${++this.sequence}`, worldYaw: yaw, distance: 3.8,
                bornAtMs: this.elapsedMs, remainingMs: config.fakeLifetimeMs,
            });
            this.fakeWaitMs = config.fakeIntervalMs;
        }
        this.atmosphereWaitMs -= dtMs;
        if (config.atmosphereIntervalMs > 0 && this.atmosphereWaitMs <= 0) {
            const kinds: HauntingKind[] = ["knock", "whisper", "door"];
            this.events.push({ type: "haunting", kind: kinds[Math.floor(this.random() * kinds.length)],
                worldYaw: relativeAngle(playerYaw + 100 + this.random() * 160, 0), distance: 2.5 });
            this.atmosphereWaitMs = config.atmosphereIntervalMs * (0.85 + this.random() * 0.3);
        }
    }

    recenter(oldPlayerYaw: number): void {
        if (!Number.isFinite(oldPlayerYaw) || this.status === "playing") return;
        for (const enemy of this.enemies) enemy.worldYaw = relativeAngle(enemy.worldYaw, oldPlayerYaw);
        for (const phantom of this.phantoms) phantom.worldYaw = relativeAngle(phantom.worldYaw, oldPlayerYaw);
    }

    private finish(reason: FinishReason): void {
        if (this.status === "finished") return;
        this.status = "finished";
        this.phantoms = [];
        this.result = {
            stageId: this.stage.id, stageName: this.stage.name, reason, score: this.score,
            defeated: this.defeated, escaped: this.escaped, maxCombo: this.maxCombo,
            life: this.life, maxLife: this.stage.initialLife, elapsedMs: this.elapsedMs,
            wavesCleared: reason === "cleared" ? this.stage.waves.length : this.waveIndex,
            waveCount: this.stage.mode === "waves" ? this.stage.waves.length : 0,
            difficulty: this.difficulty, shots: this.shots, misses: this.misses,
        };
        this.events.push({ type: "finished", result: { ...this.result } });
    }

    drainEvents(): GameEvent[] { return this.events.splice(0); }

    private isEnding(): boolean {
        return this.status === "playing" && this.stage.mode === "waves"
            && this.waveIndex === this.stage.waves.length - 1
            && this.spawnIndex >= this.stage.waves[this.waveIndex].enemies.length
            && !this.enemies.some(isActiveEnemy);
    }

    private copyEnemy(enemy: CombatEnemy): CombatEnemy { return { ...enemy, capture: { ...enemy.capture } }; }

    snapshot(): GameSnapshot {
        const wave = this.stage.waves[this.waveIndex];
        return {
            difficulty: this.difficulty, ending: this.isEnding(), attackRecoveryMs: this.attackRecoveryMs, shots: this.shots, misses: this.misses,
            phantoms: this.phantoms.map((phantom) => ({ ...phantom })),
            status: this.status, elapsedMs: this.elapsedMs,
            remainingMs: this.stage.mode === "timed" ? Math.max(0, (this.stage.durationMs ?? 0) - this.elapsedMs) : null,
            life: this.life, maxLife: this.stage.initialLife, score: this.score, defeated: this.defeated,
            escaped: this.escaped, combo: this.combo, maxCombo: this.maxCombo,
            waveIndex: this.waveIndex, waveCount: this.stage.waves.length, waveName: wave.name,
            waveRemaining: Math.max(0, wave.enemies.length - this.spawnIndex) + this.enemies.filter((enemy) => this.isActive(enemy)).length,
            invincibleMs: this.invincibleRemainingMs, targetId: this.targetId,
            enemies: this.enemies.map((enemy) => this.copyEnemy(enemy)), result: this.result ? { ...this.result } : null,
        };
    }
}
