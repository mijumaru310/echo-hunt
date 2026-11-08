import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { getNextStage, getUnlockedStageIds } from "../src/game/progression.ts";
import { getRecord, saveResult } from "../src/game/storage.ts";
import type { FinishReason, GameDifficulty, GameResult } from "../src/game/types.ts";

const globals = globalThis as unknown as Record<string, unknown>;
const practiceIds: readonly string[] = ["stationary", "moving", "approaching"];
let originalStorage: unknown;
let values: Map<string, string>;

beforeEach((): void => {
    originalStorage = globals.localStorage;
    values = new Map<string, string>();
    globals.localStorage = {
        getItem: (key: string): string | null => values.get(key) ?? null,
        setItem: (key: string, value: string): void => { values.set(key, value); },
    };
});
afterEach((): void => { globals.localStorage = originalStorage; });

function result(stageId: string, reason: FinishReason = "cleared", difficulty: GameDifficulty = "easy"): GameResult {
    return { stageId, stageName: stageId, reason, difficulty, score: 1000,
        defeated: 9, escaped: 0, maxCombo: 9, life: 3, maxLife: 3,
        elapsedMs: 20000, wavesCleared: 3, waveCount: 3, shots: 9, misses: 0 };
}

test("初回は第一夜とすべての練習だけが選べる", (): void => {
    assert.deepEqual(getUnlockedStageIds(), ["mansion", ...practiceIds]);
});

test("どちらの難易度でも第一夜クリアで第二夜を解放し、記録は難易度別に保つ", (): void => {
    for (const difficulty of ["easy", "normal"] as const) {
        values.clear();
        saveResult(result("mansion", "cleared", difficulty));
        assert.deepEqual(getUnlockedStageIds(), ["mansion", "sealed-hall", ...practiceIds]);
        assert.equal(getRecord("mansion", difficulty).cleared, true);
        assert.equal(getRecord("mansion", difficulty === "easy" ? "normal" : "easy").cleared, false);
    }
});

test("ゲームオーバー・時間終了・練習の記録では次の本編を解放しない", (): void => {
    saveResult(result("mansion", "defeated"));
    saveResult(result("mansion", "time", "normal"));
    saveResult(result("stationary", "time"));
    assert.deepEqual(getUnlockedStageIds(), ["mansion", ...practiceIds]);
});

test("第一夜から第二夜をクリアすると第三夜まで解放され、後の敗北でも失われない", (): void => {
    saveResult(result("mansion"));
    saveResult(result("sealed-hall", "cleared", "normal"));
    saveResult(result("sealed-hall", "defeated"));
    assert.deepEqual(getUnlockedStageIds(), ["mansion", "sealed-hall", "boss-room", ...practiceIds]);
});

test("順番の制限前に保存された後半のクリア記録を引き継ぐ", (): void => {
    values.set("echo-hunt:record:v1:sealed-hall:normal", JSON.stringify({ score: 800, cleared: true }));
    assert.deepEqual(getUnlockedStageIds(), ["mansion", "sealed-hall", "boss-room", ...practiceIds]);
});

test("保存が禁止されても起動中のクリアから順番に進める", (): void => {
    globals.localStorage = {
        getItem: (): never => { throw new Error("denied"); },
        setItem: (): never => { throw new Error("denied"); },
    };
    saveResult(result("mansion"));
    assert.deepEqual(getUnlockedStageIds(["mansion"]), ["mansion", "sealed-hall", ...practiceIds]);
    assert.deepEqual(getUnlockedStageIds(["mansion", "sealed-hall"]), ["mansion", "sealed-hall", "boss-room", ...practiceIds]);
});

test("壊れた保存値や存在しないIDでは解放されない", (): void => {
    values.set("echo-hunt:record:v1:mansion", "broken-json");
    values.set("echo-hunt:record:v1:mansion:normal", JSON.stringify({ score: 99999, cleared: "true" }));
    assert.deepEqual(getUnlockedStageIds(["missing-stage"]), ["mansion", ...practiceIds]);
});

test("次の本編は第一夜から第三夜の順で、最後と練習には存在しない", (): void => {
    assert.equal(getNextStage("mansion")?.id, "sealed-hall");
    assert.equal(getNextStage("sealed-hall")?.id, "boss-room");
    for (const id of ["boss-room", ...practiceIds, "missing-stage"]) assert.equal(getNextStage(id), null);
});
