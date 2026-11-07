import { SpatialAudio } from "./SpatialAudioEngine.ts";
import { enemyDefinitions } from "../game/enemies.ts";
import { relativeAngle } from "../game/capture.ts";
import { attackDistance } from "../game/GameEngine.ts";
import { getEnemyVoice, isActiveEnemy, phantomPulse } from "../game/enemyBehavior.ts";
import type { CombatEnemy, GameEvent, GameSnapshot, StageDefinition } from "../game/types.ts";
import lockReadySound from "../assets/lock-ready.wav";
import heartbeatSound from "../assets/heartbeat.wav";

/** ゲームのイベントを音に翻訳する。敵の判定・得点・時間には触れない。 */
export class GameAudio {
    private engine: SpatialAudio;
    private active = new Set<string>();
    private tails = new Map<string, { worldYaw: number; distance: number; until: number; enemyId?: string }>();
    private sequence = 0;
    private lastBeatMs = -Infinity;
    private currentYaw = 0;
    private snapshot: GameSnapshot | null = null;
    private errorHandler: (error: unknown) => void;
    private generation = 0;
    private ambientUrl: string | undefined;
    private voiceKeys = new Map<string, string>();
    private phantomBeats = new Map<string, number>();
    private lastBossKeyMs = -Infinity;
    private bossOpeningId: string | null = null;

    constructor(onError: (error: unknown) => void, engine: SpatialAudio = new SpatialAudio()) {
        this.errorHandler = onError;
        this.engine = engine;
    }

    async prepare(stage: StageDefinition, volume: number): Promise<void> {
        this.ambientUrl = stage.ambientSoundUrl;
        this.engine.setMasterVolume(volume);
        await this.engine.preload([
            ...stage.waves.flatMap((wave) => wave.enemies.flatMap((spawn) => {
                const definition = enemyDefinitions[spawn.kind];
                return [definition.soundUrl, ...(definition.concealment ? [definition.concealment.breathUrl] : [])];
            })),
            "/sounds/footstep.wav",
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
        this.voiceKeys.clear();
        this.phantomBeats.clear();
        this.tails.clear();
        this.lastBeatMs = -Infinity;
        this.lastBossKeyMs = -Infinity;
        this.bossOpeningId = null;
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
            const owner = tail.enemyId ? this.snapshot?.enemies.find((enemy) => enemy.id === tail.enemyId) : undefined;
            this.engine.setEnemyPosition(id, relativeAngle(owner?.worldYaw ?? tail.worldYaw, yaw), 0, tail.distance);
        }
    }

    sync(snapshot: GameSnapshot, yaw: number): void {
        this.snapshot = snapshot;
        this.currentYaw = yaw;
        const alive = snapshot.enemies.filter(isActiveEnemy);
        const voices = alive.map((enemy) => ({ enemy, voice: getEnemyVoice(enemy) })).filter((item) => item.voice !== null);
        const ids = new Set(voices.map(({ enemy }) => enemy.id));
        for (const id of this.active) {
            if (id === "ambient" && this.ambientUrl) continue;
            if (!ids.has(id)) { this.engine.stopEnemy(id); this.active.delete(id); this.voiceKeys.delete(id); }
        }
        const phantomIds = new Set(snapshot.phantoms.map((phantom) => phantom.id));
        for (const id of this.phantomBeats.keys()) {
            if (!phantomIds.has(id)) {
                this.engine.stopEnemy(`fake-${id}`);
                this.tails.delete(`fake-${id}`);
                this.phantomBeats.delete(id);
            }
        }
        if (snapshot.status !== "playing") { this.setPlayerYaw(yaw); return; }
        if (this.ambientUrl && !this.active.has("ambient")) {
            this.active.add("ambient");
            const generation = this.generation;
            void this.engine.playEnemy("ambient", this.ambientUrl, { spatial: false, volume: 0.15 })
                .catch((error: unknown) => { if (generation === this.generation) this.errorHandler(error); });
        }
        for (const { enemy, voice } of voices) {
            if (!voice) continue;
            if (this.voiceKeys.get(enemy.id) !== voice.key) {
                this.engine.stopEnemy(enemy.id);
                this.active.add(enemy.id);
                this.voiceKeys.set(enemy.id, voice.key);
                const generation = this.generation;
                void this.engine.playEnemy(enemy.id, voice.url, {
                    azimuthDeg: relativeAngle(enemy.worldYaw, yaw), distance: enemy.distance,
                    volume: voice.volume, playbackRate: voice.playbackRate,
                }).then(() => {
                    if (generation !== this.generation || !this.active.has(enemy.id)) return;
                    const current = this.snapshot?.enemies.find((item) => item.id === enemy.id);
                    if (current) this.engine.setEnemyPosition(current.id, relativeAngle(current.worldYaw, this.currentYaw), 0, current.distance);
                }).catch((error: unknown) => { if (generation === this.generation) this.errorHandler(error); });
            }
            this.engine.setEnemyVolume(enemy.id, voice.volume);
        }
        for (const phantom of snapshot.phantoms) {
            const pulse = phantomPulse(snapshot.elapsedMs - phantom.bornAtMs);
            if (this.phantomBeats.get(phantom.id) === pulse.index || !pulse.justStarted) continue;
            this.phantomBeats.set(phantom.id, pulse.index);
            const id = `fake-${phantom.id}`;
            this.engine.playCue(id, "false-step", { azimuthDeg: relativeAngle(phantom.worldYaw, yaw), distance: phantom.distance, volume: 0.9 });
            this.tails.set(id, { worldYaw: phantom.worldYaw, distance: phantom.distance, until: performance.now() + 250 });
        }
        const guardingBoss = alive.find((enemy) => enemyDefinitions[enemy.kind].boss && enemy.phase === "guarding");
        if (guardingBoss && snapshot.elapsedMs - this.lastBossKeyMs >= 900) {
            this.lastBossKeyMs = snapshot.elapsedMs;
            const id = `boss-keys-${guardingBoss.id}`;
            this.engine.playCue(id, "boss-keys", { azimuthDeg: relativeAngle(guardingBoss.worldYaw, yaw), distance: guardingBoss.distance, volume: 0.8 });
            this.tails.set(id, { worldYaw: guardingBoss.worldYaw, distance: guardingBoss.distance, until: performance.now() + 950, enemyId: guardingBoss.id });
        } else if (!guardingBoss) {
            this.stopBossKeys();
        }
        const exposedBoss = alive.find((enemy) => enemyDefinitions[enemy.kind].boss && enemy.phase === "exposed");
        if (exposedBoss && this.bossOpeningId !== exposedBoss.id) {
            this.playBossBreath(exposedBoss, yaw);
        } else if (!exposedBoss && this.bossOpeningId) {
            this.engine.stopEnemy(`boss-breath-${this.bossOpeningId}`);
            this.tails.delete(`boss-breath-${this.bossOpeningId}`);
            this.bossOpeningId = null;
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
                case "spawned":
                    if (enemyDefinitions[event.enemy.kind].boss) this.engine.playCue(`arrival-${++this.sequence}`, "door", { spatial: false, volume: 0.65 });
                    break; // 足音は sync() が開始する。
                case "lock-ready": this.playFile("lock-ready", lockReadySound, 0.35); break;
                case "attack-missed":
                    this.engine.playCue(`miss-${++this.sequence}`, "miss", { spatial: false, volume: 0.65 });
                    break;
                case "attack-blocked":
                    this.engine.playCue(`blocked-${++this.sequence}`, "blocked", { azimuthDeg: relativeAngle(event.enemy.worldYaw, yaw), distance: 1, volume: 0.7 });
                    break;
                case "boss-opening": {
                    this.playBossBreath(event.enemy, yaw);
                    break;
                }
                case "enemy-hit":
                    this.stopMisdirections();
                    this.stopBossKeys();
                    this.engine.stopEnemy(`boss-breath-${event.enemy.id}`);
                    this.engine.stopEnemy(`warning-${event.enemy.id}`);
                    this.engine.stopEnemy("lock-ready");
                    this.engine.playCue(`boss-hit-${++this.sequence}`, "boss-hit", { spatial: false, volume: 0.95 });
                    break;
                case "haunting": {
                    const id = `haunt-${++this.sequence}`;
                    this.engine.playCue(id, event.kind, { azimuthDeg: relativeAngle(event.worldYaw, yaw), distance: event.distance, volume: 0.45 });
                    this.tails.set(id, { worldYaw: event.worldYaw, distance: event.distance, until: performance.now() + 1500 });
                    break;
                }
                case "enemy-defeated": {
                    this.stopMisdirections();
                    this.stopBossKeys();
                    this.engine.stopEnemy(`boss-breath-${event.enemy.id}`);
                    this.engine.stopEnemy(event.enemy.id);
                    this.engine.stopEnemy(`warning-${event.enemy.id}`);
                    this.tails.delete(`warning-${event.enemy.id}`);
                    this.active.delete(event.enemy.id);
                    this.voiceKeys.delete(event.enemy.id);
                    this.engine.stopEnemy("lock-ready");
                    this.engine.playCue(`strike-${++this.sequence}`, "strike", { spatial: false, volume: 0.9 });
                    const id = `collapse-${++this.sequence}`;
                    const isBoss = Boolean(enemyDefinitions[event.enemy.kind].boss);
                    this.engine.playCue(id, isBoss ? "boss-fall" : "collapse", {
                        azimuthDeg: relativeAngle(event.enemy.worldYaw, yaw), distance: Math.min(1.5, event.enemy.distance),
                        volume: isBoss ? 1 : event.enemy.kind === "runner" ? 0.9 : 0.8, playbackRate: event.enemy.kind === "orbiter" ? 0.8 : 1,
                    });
                    this.tails.set(id, { worldYaw: event.enemy.worldYaw, distance: 1.5, until: performance.now() + (isBoss ? 1750 : 850) });
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
                    this.stopMisdirections();
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

    private playBossBreath(enemy: CombatEnemy, yaw: number): void {
        this.stopMisdirections();
        this.stopBossKeys();
        this.bossOpeningId = enemy.id;
        const id = `boss-breath-${enemy.id}`;
        this.engine.playCue(id, "boss-breath", { azimuthDeg: relativeAngle(enemy.worldYaw, yaw), distance: 1.5, volume: 0.95 });
        this.tails.set(id, { worldYaw: enemy.worldYaw, distance: 1.5, until: performance.now() + 1850, enemyId: enemy.id });
    }

    private stopBossKeys(): void {
        for (const id of this.tails.keys()) {
            if (id.startsWith("boss-keys-")) { this.engine.stopEnemy(id); this.tails.delete(id); }
        }
        this.lastBossKeyMs = -Infinity;
    }

    private stopMisdirections(): void {
        for (const id of this.tails.keys()) {
            if (id.startsWith("haunt-") || id.startsWith("fake-")) {
                this.engine.stopEnemy(id);
                this.tails.delete(id);
            }
        }
        this.phantomBeats.clear();
    }

    async dispose(): Promise<void> { this.stop(); await this.engine.dispose(); }
}
