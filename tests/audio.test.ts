import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { SpatialAudio } from "../src/audio/SpatialAudioEngine.ts";

class FakeNode {
    gain = { value: 0 };
    positionX = { value: 0 };
    positionY = { value: 0 };
    positionZ = { value: 0 };
    playbackRate = { value: 1 };
    buffer: unknown;
    loop = false;
    onended: (() => void) | null = null;
    started = false;
    stopped = false;
    disconnected = false;
    constructor(_ctx?: unknown, options?: { gain?: number }) { this.gain.value = options?.gain ?? 0; }
    connect(): void {}
    disconnect(): void { this.disconnected = true; }
    start(): void { this.started = true; }
    stop(): void { this.stopped = true; }
}

class FakeContext {
    static instances: FakeContext[] = [];
    static resumeGate: Promise<void> | null = null;
    static decodeGate: Promise<void> | null = null;
    state = "running";
    sampleRate = 1000;
    destination = {};
    sources: FakeNode[] = [];
    constructor() { FakeContext.instances.push(this); }
    async resume(): Promise<void> { if (FakeContext.resumeGate) await FakeContext.resumeGate; this.state = "running"; }
    async suspend(): Promise<void> { this.state = "suspended"; }
    async close(): Promise<void> { this.state = "closed"; }
    createBufferSource(): FakeNode { const source = new FakeNode(); this.sources.push(source); return source; }
    createBuffer(_channels: number, length: number, sampleRate: number) {
        const data = new Float32Array(length);
        return { length, duration: length / sampleRate, getChannelData: () => data };
    }
    async decodeAudioData() {
        if (FakeContext.decodeGate) await FakeContext.decodeGate;
        return this.createBuffer(1, 100, 1000);
    }
}

const globals = globalThis as unknown as Record<string, unknown>;
const originals = new Map<string, unknown>();
let fetchCount = 0;
beforeEach(() => {
    for (const name of ["AudioContext", "GainNode", "PannerNode", "fetch"]) originals.set(name, globals[name]);
    globals.AudioContext = FakeContext;
    globals.GainNode = FakeNode;
    globals.PannerNode = FakeNode;
    globals.fetch = async () => { fetchCount++; return new Response(new ArrayBuffer(8)); };
    fetchCount = 0;
    FakeContext.instances = [];
    FakeContext.resumeGate = null;
    FakeContext.decodeGate = null;
});
afterEach(() => { for (const [name, value] of originals) globals[name] = value; });

test("事前読み込みはURLを共有し、敵・SEとも同じAudioContextを使う", async () => {
    const audio = new SpatialAudio();
    await audio.preload(["footstep", "footstep", "breath"]);
    await audio.playEnemy("one", "footstep");
    await audio.playEnemy("two", "footstep");
    audio.playCue("strike", "strike");
    assert.equal(fetchCount, 2);
    assert.equal(FakeContext.instances.length, 1);
    assert.equal(FakeContext.instances[0].sources.length, 3);
    assert.ok(FakeContext.instances[0].sources.every((source) => source.started));
    await audio.dispose();
});

test("初期化待ちの間に停止した音は、後から再生されない", async () => {
    let release!: () => void;
    FakeContext.resumeGate = new Promise<void>((resolve) => { release = resolve; });
    const audio = new SpatialAudio();
    const pending = audio.playEnemy("pending", "footstep");
    audio.stopAll();
    release();
    await pending;
    assert.equal(fetchCount, 0);
    assert.equal(FakeContext.instances[0].sources.length, 0);
    await audio.dispose();
});

test("読み込み中に停止・破棄しても、デコード完了後に音が復活しない", async () => {
    let release!: () => void;
    FakeContext.decodeGate = new Promise<void>((resolve) => { release = resolve; });
    const audio = new SpatialAudio();
    const pending = audio.playEnemy("pending", "footstep");
    // initialize() と fetch() の継続を進める。
    await new Promise<void>((resolve) => setImmediate(resolve));
    await audio.dispose();
    release();
    await pending;
    assert.equal(FakeContext.instances[0].sources.length, 0);
    assert.equal(FakeContext.instances[0].state, "closed");
});

test("一時停止後もデコード済み音源を保持し、再開時に再取得しない", async () => {
    const audio = new SpatialAudio();
    await audio.preload(["footstep"]);
    await audio.playEnemy("one", "footstep", { playbackRate: 1.55 });
    const first = FakeContext.instances[0].sources[0];
    assert.equal(first.playbackRate.value, 1.55);
    await audio.suspend();
    assert.equal(first.stopped, true);
    assert.equal(audio.isRunning(), false);
    await audio.initialize();
    await audio.playEnemy("one", "footstep");
    assert.equal(audio.isRunning(), true);
    assert.equal(fetchCount, 1);
    assert.equal(FakeContext.instances.length, 1);
    await audio.dispose();
});

test("すべての合成SEは有限値で、開始・終了にクリックノイズ用の余白を持つ", async () => {
    const audio = new SpatialAudio();
    await audio.preload([]);
    for (const kind of ["strike", "collapse", "warning", "damage", "wave", "clear", "game-over", "countdown"] as const) {
        audio.playCue(kind, kind);
        const source = FakeContext.instances[0].sources.at(-1)!;
        const buffer = source.buffer as { getChannelData: (channel: number) => Float32Array };
        const samples = buffer.getChannelData(0);
        assert.ok(samples.every((sample) => Number.isFinite(sample) && Math.abs(sample) <= 1));
        assert.equal(Math.abs(samples[0]), 0);
        assert.ok(Math.abs(samples.at(-1)!) < 0.03);
    }
    await audio.dispose();
});
