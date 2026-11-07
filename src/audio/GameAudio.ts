import { SpatialAudio } from "./SpatialAudioEngine.ts";
import { enemyDefinitions } from "../game/enemies.ts";
import { relativeAngle } from "../game/capture.ts";
import { attackDistance } from "../game/GameEngine.ts";
import type { GameEvent, GameSnapshot, StageDefinition } from "../game/types.ts";
import lockReadySound from "../assets/lock-ready.wav";
import heartbeatSound from "../assets/heartbeat.wav";

/** ゲームのイベントを音に翻訳する。敵の判定・得点・時間には触れない。 */
export class GameAudio {
    private engine = new SpatialAudio();
    private active = new Set<string>();
    private tails = new Map<string, { worldYaw: number; distance: number; until: number }>();
    private sequence = 0;
    private lastBeatMs = -Infinity;
    private currentYaw = 0;
    private snapshot: GameSnapshot | null = null;
    private errorHandler: (error: unknown) => void;
    private generation = 0;
    private ambientUrl: string | undefined;

    constructor(onError: (error: unknown) => void) { this.errorHandler = onError; }

    async prepare(stage: StageDefinition, volume: number): Promise<void> {
        this.ambientUrl = stage.ambientSoundUrl;
        this.engine.setMasterVolume(volume);
        await this.engine.preload([
            ...stage.waves.flatMap((wave) => wave.enemies.map((spawn) => enemyDefinitions[spawn.kind].soundUrl)),
            lockReadySound, heartbeatSound, ...(stage.ambientSoundUrl ? [stage.ambientSoundUrl] : []),
        ]);
    }

    isRunning(): boolean { return this.engine.isRunning(); }
    setVolume(volume: number): void { this.engine.setMasterVolume(volume); }

    async preview(): Promise<void> {
        await this.engine.playEnemy("preview", "/sounds/footstep.wav", { azimuthDeg: 45, distance: 2, volume: 0.8 });
    }

    countdown(): void {
        this.engine.playCue(`count-${++this.sequence}`, "countdown", { spatial: false, volume: 0.55 });
    }

    async resume(): Promise<void> { await this.engine.initialize(); }

    stop(): void {
        this.generation++;
        this.engine.stopAll();
        this.active.clear();
        this.tails.clear();
        this.lastBeatMs = -Infinity;
    }

    async pause(): Promise<void> { this.stop(); await this.engine.suspend(); }

    /** センサーイベントから直接呼ぶ。Reactの再描画を経由しない。 */
    setPlayerYaw(yaw: number): void {
        this.currentYaw = yaw;
        if (this.snapshot) {
            for (const enemy of this.snapshot.enemies) {
                this.engine.setEnemyPosition(enemy.id, relativeAngle(enemy.worldYaw, yaw), 0, enemy.distance);
            }
        }
        for (const [id, tail] of this.tails) {
            if (performance.now() >= tail.until) { this.tails.delete(id); continue; }
            this.engine.setEnemyPosition(id, relativeAngle(tail.worldYaw, yaw), 0, tail.distance);
        }
    }

    sync(snapshot: GameSnapshot, yaw: number): void {
        this.snapshot = snapshot;
        this.currentYaw = yaw;
        const alive = snapshot.enemies.filter((enemy) => enemy.phase === "approaching" || enemy.phase === "winding-up");
        const ids = new Set(alive.map((enemy) => enemy.id));
        for (const id of this.active) {
            if (id === "ambient" && this.ambientUrl) continue;
            if (!ids.has(id)) { this.engine.stopEnemy(id); this.active.delete(id); }
        }
        if (snapshot.status !== "playing") { this.setPlayerYaw(yaw); return; }
        if (this.ambientUrl && !this.active.has("ambient")) {
            this.active.add("ambient");
            const generation = this.generation;
            void this.engine.playEnemy("ambient", this.ambientUrl, { spatial: false, volume: 0.15 })
                .catch((error: unknown) => { if (generation === this.generation) this.errorHandler(error); });
        }
        for (const enemy of alive) {
            if (!this.active.has(enemy.id)) {
                this.active.add(enemy.id);
                const definition = enemyDefinitions[enemy.kind];
                const generation = this.generation;
                void this.engine.playEnemy(enemy.id, definition.soundUrl, {
                    azimuthDeg: relativeAngle(enemy.worldYaw, yaw), distance: enemy.distance,
                    volume: definition.volume, playbackRate: definition.playbackRate,
                }).then(() => {
                    if (generation !== this.generation || !this.active.has(enemy.id)) return;
                    const current = this.snapshot?.enemies.find((item) => item.id === enemy.id);
                    if (current) this.engine.setEnemyPosition(current.id, relativeAngle(current.worldYaw, this.currentYaw), 0, current.distance);
                }).catch((error: unknown) => { if (generation === this.generation) this.errorHandler(error); });
            }
        }
        this.setPlayerYaw(yaw);
        const contactMs = Math.min(...alive.filter((enemy) => enemy.approachSpeed > 0).map((enemy) =>
            enemy.phase === "winding-up" ? 0 : (enemy.distance - attackDistance) / enemy.approachSpeed * 1000));
        const interval = contactMs <= 2000 ? 480 : 900;
        if (contactMs <= 5000 && snapshot.elapsedMs - this.lastBeatMs >= interval) {
            this.lastBeatMs = snapshot.elapsedMs;
            this.playFile("heartbeat", heartbeatSound, 0.28);
        } else if (contactMs > 5000) {
            this.engine.stopEnemy("heartbeat");
            this.lastBeatMs = -Infinity;
        }
    }

    private playFile(id: string, url: string, volume: number): void {
        const generation = this.generation;
        void this.engine.playEnemy(id, url, { loop: false, spatial: false, volume })
            .catch((error: unknown) => { if (generation === this.generation) this.errorHandler(error); });
    }

    handle(events: readonly GameEvent[], yaw: number): void {
        for (const event of events) {
            switch (event.type) {
                case "spawned": break; // 足音は sync() が開始する。
                case "lock-ready": this.playFile("lock-ready", lockReadySound, 0.35); break;
                case "enemy-defeated": {
                    this.engine.stopEnemy(event.enemy.id);
                    this.engine.stopEnemy(`warning-${event.enemy.id}`);
                    this.tails.delete(`warning-${event.enemy.id}`);
                    this.active.delete(event.enemy.id);
                    this.engine.stopEnemy("lock-ready");
                    this.engine.playCue(`strike-${++this.sequence}`, "strike", { spatial: false, volume: 0.9 });
                    const id = `collapse-${++this.sequence}`;
                    this.engine.playCue(id, "collapse", {
                        azimuthDeg: relativeAngle(event.enemy.worldYaw, yaw), distance: Math.min(1.5, event.enemy.distance),
                        volume: event.enemy.kind === "runner" ? 0.9 : 0.8, playbackRate: event.enemy.kind === "orbiter" ? 0.8 : 1,
                    });
                    this.tails.set(id, { worldYaw: event.enemy.worldYaw, distance: 1.5, until: performance.now() + 850 });
                    break;
                }
                case "attack-warning": {
                    const id = `warning-${event.enemy.id}`;
                    this.engine.playCue(id, "warning", { azimuthDeg: relativeAngle(event.enemy.worldYaw, yaw), distance: 1, volume: 0.7 });
                    this.tails.set(id, { worldYaw: event.enemy.worldYaw, distance: 1, until: performance.now() + 700 });
                    break;
                }
                case "player-damaged":
                    this.engine.stopEnemy("lock-ready");
                    this.engine.playCue(`damage-${++this.sequence}`, "damage", { spatial: false, volume: 0.85 });
                    break;
                case "wave-started":
                    this.engine.playCue(`wave-${++this.sequence}`, "wave", { spatial: false, volume: 0.55 });
                    break;
                case "finished":
                    // 最後の撃破音の余韻を残し、敵のループだけを停止する。
                    for (const id of this.active) this.engine.stopEnemy(id);
                    this.active.clear();
                    this.engine.stopEnemy("heartbeat");
                    this.engine.stopEnemy("lock-ready");
                    this.engine.playCue(`end-${++this.sequence}`, event.result.reason === "defeated" ? "game-over" : "clear", { spatial: false, volume: 0.7 });
                    break;
            }
        }
    }

    async dispose(): Promise<void> { this.stop(); await this.engine.dispose(); }
}
