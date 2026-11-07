import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";

class RecordingAudio {
    sources = [];
    stops = [];
    cues = [];
    positions = [];
    urls = [];
    async preload(urls) { this.urls = urls; }
    setMasterVolume() {}
    setEnemyVolume() {}
    isRunning() { return true; }
    async playEnemy(id, url, options) { this.sources.push({ id, url, options }); }
    stopEnemy(id) { this.stops.push(id); }
    playCue(id, kind, options) { this.cues.push({ id, kind, options }); }
    setEnemyPosition(id, yaw, elevation, distance) { this.positions.push({ id, yaw, elevation, distance }); }
    stopAll() { this.stops.push("*"); }
    async suspend() {}
    async initialize() {}
    async dispose() {}
}

test("行動の変化を音に反映し、フェイクの重複再生や上下の音源を作らない", async () => {
    const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: "custom" });
    try {
        const { GameAudio } = await server.ssrLoadModule("/src/audio/GameAudio.ts");
        const { GameEngine } = await server.ssrLoadModule("/src/game/GameEngine.ts");
        const { getStage } = await server.ssrLoadModule("/src/game/stages.ts");
        const errors = [];
        const recording = new RecordingAudio();
        const audio = new GameAudio((error) => errors.push(error), recording);
        const stage = { ...getStage("sealed-hall"), haunting: undefined, waves: [{ name: "test", enemies: [{ kind: "lurker" }] }] };
        await audio.prepare(stage, 0.7);
        assert.ok(recording.urls.includes("/sounds/breath.wav"));
        const game = new GameEngine(stage, () => 0.5, "normal");
        game.start(); game.update(600, 90);
        audio.sync(game.snapshot(), 90);
        assert.equal(recording.sources.at(-1).url, "/sounds/footstep.wav");
        game.update(2600, 90); audio.sync(game.snapshot(), 90);
        assert.equal(recording.sources.at(-1).url, "/sounds/breath.wav");
        const voiceCount = recording.sources.length;
        game.update(900, 90); audio.sync(game.snapshot(), 90);
        assert.equal(recording.sources.length, voiceCount);
        assert.ok(recording.stops.includes(game.snapshot().enemies[0].id));
        game.update(1300, 90); audio.sync(game.snapshot(), 90);
        assert.equal(recording.sources.at(-1).url, "/sounds/footstep.wav");

        const fakeStage = { ...getStage("sealed-hall"),
            haunting: { fakeIntervalMs: 1800, fakeLifetimeMs: 6500, atmosphereIntervalMs: 0 },
            waves: [{ name: "fake", enemies: [{ kind: "walker", approachSpeed: 0 }] }],
        };
        const fake = new GameEngine(fakeStage, () => 0.5, "normal");
        const fakeRecording = new RecordingAudio();
        const fakeAudio = new GameAudio((error) => errors.push(error), fakeRecording);
        fake.start(); fake.update(2400, 90);
        for (const dt of [0, 0, 420, 0, 420, 0, 600]) {
            fake.update(dt, 90); fakeAudio.sync(fake.snapshot(), 90);
        }
        assert.equal(fakeRecording.cues.filter((cue) => cue.kind === "false-step").length, 3);
        await fakeAudio.pause();
        fakeAudio.sync(fake.snapshot(), 90); // 3歩目から600ms経過。途中再開で古い足音を鳴らさない。
        assert.equal(fakeRecording.cues.filter((cue) => cue.kind === "false-step").length, 3);
        fake.attack(90);
        fakeAudio.handle(fake.drainEvents(), 90);
        assert.equal(fakeRecording.cues.at(-1).kind, "miss");
        fake.update(650, 0); fake.attack(0);
        fakeAudio.handle(fake.drainEvents(), 0);
        assert.equal(fakeRecording.cues.at(-1).kind, "collapse");
        const bossStage = getStage("boss-room");
        const bossGame = new GameEngine(bossStage, () => 0.5, "normal");
        const bossRecording = new RecordingAudio();
        const bossAudio = new GameAudio((error) => errors.push(error), bossRecording);
        bossGame.start(); bossGame.update(600, 90);
        bossAudio.handle(bossGame.drainEvents(), 90); bossAudio.sync(bossGame.snapshot(), 90);
        assert.ok(bossRecording.cues.some((cue) => cue.kind === "boss-keys"));
        bossGame.update(4200, 90);
        bossAudio.handle(bossGame.drainEvents(), 90); bossAudio.sync(bossGame.snapshot(), 90);
        assert.ok(bossRecording.stops.includes("boss-keys-enemy-1"));
        assert.equal(bossRecording.cues.filter((cue) => cue.kind === "boss-breath").length, 1);
        await bossAudio.pause();
        bossAudio.sync(bossGame.snapshot(), 90);
        assert.equal(bossRecording.cues.filter((cue) => cue.kind === "boss-breath").length, 2);
        bossGame.attack(bossGame.snapshot().enemies[0].worldYaw);
        bossAudio.handle(bossGame.drainEvents(), 90); bossAudio.sync(bossGame.snapshot(), 90);
        assert.equal(bossRecording.cues.at(-1).kind, "boss-hit");
        for (let hit = 0; hit < 2; hit++) {
            while (bossGame.snapshot().enemies[0].phase !== "exposed") bossGame.update(25, 90);
            bossAudio.handle(bossGame.drainEvents(), 90); bossAudio.sync(bossGame.snapshot(), 90);
            bossGame.attack(bossGame.snapshot().enemies[0].worldYaw);
            bossAudio.handle(bossGame.drainEvents(), 90); bossAudio.sync(bossGame.snapshot(), 90);
        }
        assert.equal(bossRecording.cues.at(-1).kind, "boss-fall");
        assert.ok(recording.positions.every((position) => position.elevation === 0));
        assert.ok(fakeRecording.positions.every((position) => position.elevation === 0));
        await Promise.resolve();
        assert.deepEqual(errors, []);
        await audio.dispose(); await fakeAudio.dispose(); await bossAudio.dispose();
    } finally { await server.close(); }
});
