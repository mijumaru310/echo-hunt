import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { getRecord, loadSettings, saveResult } from "../src/game/storage.ts";
import type { GameResult } from "../src/game/types.ts";

const globals = globalThis as unknown as Record<string, unknown>;
let originalStorage: unknown;
let values: Map<string, string>;
beforeEach(() => {
    originalStorage = globals.localStorage;
    values = new Map();
    globals.localStorage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) };
});
afterEach(() => { globals.localStorage = originalStorage; });

test("ステージ別ベストスコアは低い得点で上書きされず、クリア履歴を保つ", () => {
    const result: GameResult = { stageId: "mansion", stageName: "洋館", reason: "cleared", score: 1000,
        defeated: 9, escaped: 0, maxCombo: 9, life: 3, maxLife: 3, elapsedMs: 20000, wavesCleared: 3, waveCount: 3,
        difficulty: "easy", shots: 9, misses: 0 };
    assert.deepEqual(saveResult(result), { bestScore: 1000, isNewRecord: true });
    assert.deepEqual(saveResult({ ...result, reason: "defeated", score: 500 }), { bestScore: 1000, isNewRecord: false });
    assert.deepEqual(getRecord("mansion"), { score: 1000, cleared: true });
    assert.deepEqual(getRecord("stationary"), { score: 0, cleared: false });
    assert.deepEqual(getRecord("mansion", "normal"), { score: 0, cleared: false });
    assert.deepEqual(saveResult({ ...result, difficulty: "normal", score: 700 }), { bestScore: 700, isNewRecord: true });
    assert.deepEqual(getRecord("mansion", "normal"), { score: 700, cleared: true });
    assert.deepEqual(getRecord("mansion", "easy"), { score: 1000, cleared: true });
});

test("保存データが壊れている・保存が禁止されている場合もプレイを妨げない", () => {
    values.set("echo-hunt:settings:v1", "broken-json");
    assert.deepEqual(loadSettings(), { volume: 0.7, haptics: true });
    globals.localStorage = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("denied"); } };
    assert.deepEqual(getRecord("mansion"), { score: 0, cleared: false });
    assert.doesNotThrow(() => saveResult({ stageId: "mansion", score: 100, reason: "cleared" } as GameResult));
});
