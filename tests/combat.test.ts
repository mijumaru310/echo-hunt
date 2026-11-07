import test from "node:test";
import assert from "node:assert/strict";
import { GameEngine, invincibilityMs } from "../src/game/GameEngine.ts";
import { enemyDefinitions } from "../src/game/enemies.ts";
import { stages, getStage, validateStage } from "../src/game/stages.ts";
import { relativeAngle } from "../src/game/capture.ts";
import type { GameEvent, StageDefinition } from "../src/game/types.ts";

function stage(overrides: Partial<StageDefinition> = {}): StageDefinition {
    return {
        ...getStage("mansion"), id: "test", waves: [{ name: "test", enemies: [{ kind: "walker", approachSpeed: 0 }] }],
        ...overrides,
    };
}
function spawn(game: GameEngine): void { game.start(); game.update(600, 0); game.drainEvents(); }
function kill(game: GameEngine): void {
    const enemy = game.snapshot().enemies.find((item) => item.phase === "approaching" || item.phase === "winding-up");
    assert.ok(enemy);
    game.update(enemy.lockTimeMs, enemy.worldYaw);
    const current = game.snapshot().enemies.find((item) => item.id === enemy.id)!;
    assert.equal(game.attack(current.worldYaw), true);
}

test("すべての公開ステージの設定が有効", () => {
    for (const item of stages) assert.doesNotThrow(() => validateStage(item));
    assert.equal(getStage("unknown").id, "mansion");
    assert.throws(() => new GameEngine(stage({ maxConcurrent: 0 })));
    assert.throws(() => new GameEngine(stage({ mode: "timed", durationMs: NaN })));
    assert.throws(() => new GameEngine(stage({ waves: [] })));
    assert.throws(() => new GameEngine(stage({ waves: [{ name: "bad", enemies: [{ kind: "walker", approachSpeed: NaN }] }] })));
});

test("開始前は時間が進まず、開始して600ms後に最初の敵が出現", () => {
    const game = new GameEngine(stage(), () => 0.5);
    game.update(5000, 0);
    assert.equal(game.snapshot().elapsedMs, 0);
    assert.equal(game.attack(0), false);
    game.start(); game.start();
    assert.equal(game.drainEvents().filter((event) => event.type === "wave-started").length, 1);
    game.update(599, 0);
    assert.equal(game.snapshot().enemies.length, 0);
    game.update(1, 0);
    assert.equal(game.snapshot().enemies.length, 1);
});

test("ロック未完了・範囲外・二重タップは得点せず、撃破イベントは1回", () => {
    const game = new GameEngine(stage(), () => 0.5);
    spawn(game);
    assert.equal(game.attack(0), false);
    game.update(699, 0);
    assert.equal(game.attack(0), false);
    game.update(1, 0);
    assert.equal(game.attack(90), false);
    assert.equal(game.attack(0), true);
    assert.equal(game.attack(0), false);
    assert.equal(game.snapshot().score, 100);
    assert.equal(game.snapshot().defeated, 1);
    assert.equal(game.drainEvents().filter((event) => event.type === "enemy-defeated").length, 1);
});

test("撃破後800msは余韻を保ち、最後の敵の消滅後にクリアする", () => {
    const game = new GameEngine(stage(), () => 0.5);
    spawn(game); kill(game);
    game.update(799, 0);
    assert.equal(game.snapshot().status, "playing");
    assert.equal(game.snapshot().enemies[0].phase, "defeated");
    game.update(1, 0);
    assert.equal(game.snapshot().status, "finished");
    assert.equal(game.snapshot().result?.reason, "cleared");
    assert.equal(game.snapshot().result?.wavesCleared, 1);
});

test("一時停止中は時間・距離・ロック・撃破状態のいずれも進まない", () => {
    const game = new GameEngine(getStage("approaching"), () => 0.5);
    spawn(game); game.update(350, 0); game.pause();
    const before = game.snapshot();
    game.update(60_000, 0);
    assert.deepEqual(game.snapshot(), before);
    assert.equal(game.attack(0), false);
    game.resume(); game.update(350, 0);
    assert.equal(game.attack(0), true);
});

test("不正な時間や方向入力は戦闘状態を汚さない", () => {
    const game = new GameEngine(stage(), () => 0.5);
    spawn(game);
    const before = game.snapshot();
    for (const dt of [NaN, Infinity, -1, 0]) game.update(dt, 0);
    game.update(100, NaN);
    assert.equal(game.attack(NaN), false);
    game.recenter(NaN);
    assert.deepEqual(game.snapshot(), before);
});

test("範囲外で400ms経過すると満タンのゲージが0になる", () => {
    const game = new GameEngine(stage(), () => 0.5);
    spawn(game); game.update(700, 0); game.drainEvents();
    game.update(200, 90);
    assert.equal(game.snapshot().enemies[0].capture.progressMs, 350);
    game.update(200, 90);
    assert.equal(game.snapshot().enemies[0].capture.progressMs, 0);
    assert.equal(game.snapshot().targetId, null);
});

test("ロック完了音は満タンになった瞬間だけ通知される", () => {
    const game = new GameEngine(stage(), () => 0.5);
    spawn(game); game.update(700, 0);
    assert.equal(game.drainEvents().filter((event) => event.type === "lock-ready").length, 1);
    game.update(1000, 0);
    assert.equal(game.drainEvents().filter((event) => event.type === "lock-ready").length, 0);
});

test("接近型は15秒で攻撃予告、さらに1秒後に1ダメージで離脱", () => {
    const game = new GameEngine(stage({ waves: [{ name: "attack", enemies: [{ kind: "walker" }] }] }), () => 0.5);
    spawn(game); game.update(15_025, 90);
    assert.equal(game.snapshot().life, 3);
    assert.equal(game.snapshot().enemies[0].phase, "winding-up");
    assert.equal(game.drainEvents().filter((event) => event.type === "attack-warning").length, 1);
    game.update(1000, 90);
    assert.equal(game.snapshot().life, 2);
    assert.equal(game.snapshot().enemies[0].phase, "retreating");
    assert.equal(game.snapshot().escaped, 1);
    assert.equal(game.drainEvents().filter((event) => event.type === "player-damaged").length, 1);
    game.update(500, 90);
    assert.equal(game.snapshot().life, 2);
    assert.equal(game.snapshot().status, "playing");
    game.update(200, 90);
    assert.equal(game.snapshot().result?.reason, "cleared");
});

test("攻撃予告中も撃破でき、ダメージを受けない", () => {
    const game = new GameEngine(stage({ waves: [{ name: "attack", enemies: [{ kind: "walker" }] }] }), () => 0.5);
    spawn(game); game.update(15_025, 90); kill(game); game.update(1000, 90);
    assert.equal(game.snapshot().life, 3);
    assert.equal(game.snapshot().defeated, 1);
    assert.equal(game.snapshot().escaped, 0);
});

test("同時攻撃では無敵時間により1ダメージだけ受ける", () => {
    const game = new GameEngine(stage({ maxConcurrent: 2, spawnIntervalMs: 25,
        waves: [{ name: "pair", enemies: [{ kind: "walker", approachSpeed: 100 }, { kind: "walker", approachSpeed: 100 }] }],
    }), () => 0.5);
    spawn(game); game.update(1125, 90);
    assert.equal(game.snapshot().life, 2);
    assert.equal(game.snapshot().escaped, 2);
    assert.ok(game.snapshot().invincibleMs > 0 && game.snapshot().invincibleMs <= invincibilityMs);
    assert.equal(game.drainEvents().filter((event) => event.type === "player-damaged").length, 1);
});

test("ライフ0でゲームオーバーになり、以降更新しても終了イベントは増えない", () => {
    const game = new GameEngine(stage({ initialLife: 1, waves: [{ name: "attack", enemies: [{ kind: "walker", approachSpeed: 100 }] }] }), () => 0.5);
    spawn(game); game.update(2000, 90);
    assert.equal(game.snapshot().life, 0);
    assert.equal(game.snapshot().result?.reason, "defeated");
    assert.equal(game.drainEvents().filter((event) => event.type === "finished").length, 1);
    const before = game.snapshot();
    game.update(10000, 0); game.resume();
    assert.deepEqual(game.snapshot(), before);
    assert.deepEqual(game.drainEvents(), []);
});

test("周回型は回り込みと接近を同時に行い、角度も正規化する", () => {
    const game = new GameEngine(stage({ waves: [{ name: "orbit", enemies: [{ kind: "orbiter" }] }] }), () => 0.99);
    spawn(game);
    const before = game.snapshot().enemies[0];
    game.update(1000, 0);
    const after = game.snapshot().enemies[0];
    assert.ok(Math.abs(relativeAngle(after.worldYaw, before.worldYaw) - 12) < 1e-6);
    assert.ok(Math.abs(after.distance - before.distance + 0.15) < 1e-6);
    assert.ok(after.worldYaw >= -180 && after.worldYaw < 180);
});

test("複数の敵が正面にいても1体だけロックし、範囲内では対象を維持", () => {
    const randoms = [0.5, 0.5, 0.52, 0.5];
    const game = new GameEngine(stage({ maxConcurrent: 2, spawnIntervalMs: 25,
        waves: [{ name: "pair", enemies: [{ kind: "walker", approachSpeed: 0 }, { kind: "walker", approachSpeed: 0 }] }],
    }), () => randoms.shift() ?? 0.5);
    spawn(game); game.update(350, 0);
    const first = game.snapshot().targetId;
    game.update(350, 7);
    const view = game.snapshot();
    assert.equal(view.targetId, first);
    assert.equal(view.enemies.filter((enemy) => enemy.capture.progressMs > 0).length, 1);
    assert.equal(game.attack(7), true);
    assert.equal(game.attack(7), false);
    assert.equal(game.snapshot().defeated, 1);
});

test("正面の再設定は全敵の相対方向・ロック進捗を維持する", () => {
    const game = new GameEngine(stage(), () => 0.75);
    spawn(game); game.update(350, 90); game.pause();
    const before = game.snapshot().enemies[0];
    game.recenter(30);
    const after = game.snapshot().enemies[0];
    assert.equal(relativeAngle(before.worldYaw, 30), relativeAngle(after.worldYaw, 0));
    assert.deepEqual(after.capture, before.capture);
    game.resume(); game.recenter(90);
    assert.equal(game.snapshot().enemies[0].worldYaw, after.worldYaw);
});

test("連続撃破は25点ずつ最大100点のボーナスを加算", () => {
    const game = new GameEngine(stage({ waves: [{ name: "chain", enemies: Array.from({ length: 6 }, () => ({ kind: "walker" as const, approachSpeed: 0 })) }] }), () => 0.5);
    spawn(game);
    for (let index = 0; index < 6; index++) {
        if (index > 0) game.update(1100, 0);
        kill(game);
    }
    assert.equal(game.snapshot().score, 100 + 125 + 150 + 175 + 200 + 200);
    assert.equal(game.snapshot().maxCombo, 6);
});

test("60秒の練習は正確に時間終了し、停止時間は含まない", () => {
    const game = new GameEngine(getStage("stationary"), () => 0.5);
    game.start(); game.update(30_000, 90); game.pause(); game.update(60_000, 90); game.resume(); game.update(40_000, 90);
    assert.equal(game.snapshot().elapsedMs, 60_000);
    assert.equal(game.snapshot().remainingMs, 0);
    assert.equal(game.snapshot().result?.reason, "time");
});

test("見本ステージを開始から9体撃破・3ウェーブ踏破まで通して遊べる", () => {
    const game = new GameEngine(getStage("mansion"), () => 0.5);
    game.start();
    const events: GameEvent[] = [];
    for (let frame = 0; frame < 5000 && game.snapshot().status !== "finished"; frame++) {
        const active = game.snapshot().enemies.find((enemy) => enemy.phase === "approaching" || enemy.phase === "winding-up");
        const yaw = active?.worldYaw ?? 0;
        game.update(25, yaw);
        game.attack(yaw);
        events.push(...game.drainEvents());
    }
    const result = game.snapshot().result;
    assert.equal(result?.reason, "cleared");
    assert.equal(result?.defeated, 9);
    assert.equal(result?.life, 3);
    assert.equal(result?.wavesCleared, 3);
    assert.equal(events.filter((event) => event.type === "wave-started").length, 3);
    assert.equal(events.filter((event) => event.type === "finished").length, 1);
    assert.deepEqual(new Set(events.filter((event) => event.type === "spawned").map((event) => event.enemy.kind)), new Set(Object.keys(enemyDefinitions)));
});

test("スナップショットの変更は内部の敵や捕捉状態を変更しない", () => {
    const game = new GameEngine(stage(), () => 0.5);
    spawn(game);
    const view = game.snapshot();
    view.enemies[0].distance = 999;
    view.enemies[0].capture.progressMs = 999;
    assert.equal(game.snapshot().enemies[0].distance, 3);
    assert.equal(game.snapshot().enemies[0].capture.progressMs, 0);
});
