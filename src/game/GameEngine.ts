import { enemyDefinitions } from "./enemies.ts";
import { isInCaptureRange, relativeAngle } from "./capture.ts";
import { validateStage } from "./stages.ts";
import type { CombatEnemy, FinishReason, GameEvent, GameResult, GameSnapshot, GameStatus, StageDefinition } from "./types.ts";

export const attackDistance = 1;
export const invincibilityMs = 1600;
const decayTimeMs = 400;

/** DOM・音声・Reactに依存しない戦闘。時間は update() だけが進める。 */
export class GameEngine {
    readonly stage: StageDefinition;
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

    constructor(stage: StageDefinition, random: () => number = Math.random) {
        validateStage(stage);
        this.stage = stage;
        this.random = random;
        this.life = stage.initialLife;
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
        let remaining = dtMs;
        while (remaining > 0 && this.status === "playing") {
            const timeLeft = this.stage.mode === "timed" ? (this.stage.durationMs ?? 0) - this.elapsedMs : Infinity;
            if (timeLeft <= 0) { this.finish("time"); break; }
            const stepMs = Math.min(remaining, 25, timeLeft);
            this.step(stepMs, playerYaw);
            remaining -= stepMs;
            if (this.status === "playing" && this.stage.mode === "timed" && this.elapsedMs >= (this.stage.durationMs ?? 0)) this.finish("time");
        }
    }

    private step(dtMs: number, playerYaw: number): void {
        this.elapsedMs += dtMs;
        this.invincibleRemainingMs = Math.max(0, this.invincibleRemainingMs - dtMs);
        this.quietRemainingMs = Math.max(0, this.quietRemainingMs - dtMs);

        for (const enemy of this.enemies) {
            if (enemy.phase === "defeated" || enemy.phase === "retreating") {
                enemy.phaseRemainingMs -= dtMs;
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
                    if (this.invincibleRemainingMs === 0) {
                        const damage = Math.min(this.life, enemyDefinitions[enemy.kind].damage);
                        this.life -= damage;
                        this.invincibleRemainingMs = invincibilityMs;
                        this.events.push({ type: "player-damaged", enemy: this.copyEnemy(enemy), life: this.life, damage });
                        if (this.life === 0) { this.finish("defeated"); return; }
                    }
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
            }
        }
        this.enemies = this.enemies.filter((enemy) => !((enemy.phase === "defeated" || enemy.phase === "retreating") && enemy.phaseRemainingMs <= 0));
        this.updateTarget(playerYaw, dtMs);

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
                id: `enemy-${++this.sequence}`, kind: spawn.kind, phase: "approaching", phaseRemainingMs: 0,
                worldYaw: this.random() * 360 - 180, distance: definition.spawnDistance,
                angularVelocity: (spawn.angularSpeed ?? definition.angularSpeed) * (this.random() < 0.5 ? -1 : 1),
                approachSpeed: spawn.approachSpeed ?? definition.approachSpeed, lockTimeMs: definition.lockTimeMs,
                capture: { progressMs: 0, isCaptured: false },
            };
            this.enemies.push(enemy);
            this.spawnIndex++;
            this.spawnWaitMs = this.stage.spawnIntervalMs;
            this.events.push({ type: "spawned", enemy: this.copyEnemy(enemy) });
        }
    }

    private isActive(enemy: CombatEnemy): boolean {
        return enemy.phase === "approaching" || enemy.phase === "winding-up";
    }

    /** 範囲内にいる間は同じ敵を保持。外れたらゲージを減らし、次の1体を選ぶ。 */
    private updateTarget(playerYaw: number, dtMs: number): void {
        const active = this.enemies.filter((enemy) => this.isActive(enemy));
        const current = active.find((enemy) => enemy.id === this.targetId);
        let target = current && isInCaptureRange(relativeAngle(current.worldYaw, playerYaw)) ? current : undefined;
        if (!target) {
            target = active.filter((enemy) => isInCaptureRange(relativeAngle(enemy.worldYaw, playerYaw)))
                .sort((a, b) => Math.abs(relativeAngle(a.worldYaw, playerYaw)) - Math.abs(relativeAngle(b.worldYaw, playerYaw)) || a.distance - b.distance)[0];
        }
        this.targetId = target?.id ?? null;
        for (const enemy of active) {
            const wasReady = enemy.capture.progressMs >= enemy.lockTimeMs;
            enemy.capture.progressMs = Math.max(0, Math.min(enemy.lockTimeMs,
                enemy.capture.progressMs + (enemy === target ? dtMs : -dtMs * enemy.lockTimeMs / decayTimeMs)));
            if (enemy === target && !wasReady && enemy.capture.progressMs >= enemy.lockTimeMs) {
                this.events.push({ type: "lock-ready", enemyId: enemy.id });
            }
        }
    }

    attack(playerYaw: number): boolean {
        if (this.status !== "playing" || !Number.isFinite(playerYaw)) return false;
        const enemy = this.enemies.find((item) => item.id === this.targetId && this.isActive(item));
        if (!enemy || !isInCaptureRange(relativeAngle(enemy.worldYaw, playerYaw)) || enemy.capture.progressMs < enemy.lockTimeMs) return false;
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
        this.events.push({ type: "enemy-defeated", enemy: this.copyEnemy(enemy), points, combo: this.combo });
        return true;
    }

    recenter(oldPlayerYaw: number): void {
        if (!Number.isFinite(oldPlayerYaw) || this.status === "playing") return;
        for (const enemy of this.enemies) enemy.worldYaw = relativeAngle(enemy.worldYaw, oldPlayerYaw);
    }

    private finish(reason: FinishReason): void {
        if (this.status === "finished") return;
        this.status = "finished";
        this.result = {
            stageId: this.stage.id, stageName: this.stage.name, reason, score: this.score,
            defeated: this.defeated, escaped: this.escaped, maxCombo: this.maxCombo,
            life: this.life, maxLife: this.stage.initialLife, elapsedMs: this.elapsedMs,
            wavesCleared: reason === "cleared" ? this.stage.waves.length : this.waveIndex,
            waveCount: this.stage.mode === "waves" ? this.stage.waves.length : 0,
        };
        this.events.push({ type: "finished", result: { ...this.result } });
    }

    drainEvents(): GameEvent[] { return this.events.splice(0); }

    private copyEnemy(enemy: CombatEnemy): CombatEnemy { return { ...enemy, capture: { ...enemy.capture } }; }

    snapshot(): GameSnapshot {
        const wave = this.stage.waves[this.waveIndex];
        return {
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
