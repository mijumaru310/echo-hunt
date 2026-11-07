import test from "node:test";
import assert from "node:assert/strict";
import { GameEngine } from "../src/game/GameEngine.ts";
import { getStage, validateStage } from "../src/game/stages.ts";
import { combatPresentation } from "../src/game/combatPresentation.ts";
import { relativeAngle } from "../src/game/capture.ts";
import type { GameDifficulty } from "../src/game/types.ts";

function encounter(difficulty: GameDifficulty = "normal"): GameEngine {
    const game = new GameEngine(getStage("boss-room"), () => 0.5, difficulty);
    game.start(); game.update(600, 0); game.drainEvents();
    return game;
}
function opening(game: GameEngine): void {
    for (let frame = 0; frame < 500 && game.snapshot().enemies[0]?.phase !== "exposed"; frame++) game.update(25, 90);
    assert.equal(game.snapshot().enemies[0]?.phase, "exposed");
}
function hit(game: GameEngine): void {
    const boss = game.snapshot().enemies[0];
    if (game.difficulty === "easy") game.update(700, boss.worldYaw);
    assert.equal(game.attack(boss.worldYaw), true);
}

test("ボスは体力3で登場し、鍵が鳴っている間の攻撃を弾く", () => {
    const game = encounter();
    const boss = game.snapshot().enemies[0];
    assert.equal(boss.health, 3);
    assert.equal(boss.maxHealth, 3);
    assert.equal(boss.phase, "guarding");
    assert.equal(game.attack(boss.worldYaw), false);
    assert.equal(game.snapshot().enemies[0].health, 3);
    assert.equal(game.snapshot().score, 0);
    assert.equal(game.snapshot().life, 3);
    assert.equal(game.snapshot().attackRecoveryMs, 650);
    assert.equal(game.drainEvents().filter((event) => event.type === "attack-blocked").length, 1);
});

test("イージーではボスが隙を見せるまでゲージを作らない", () => {
    const game = encounter("easy");
    game.update(1000, game.snapshot().enemies[0].worldYaw);
    assert.equal(game.snapshot().targetId, null);
    assert.equal(game.attack(game.snapshot().enemies[0].worldYaw), false);
    opening(game);
    hit(game);
    assert.equal(game.snapshot().enemies[0].health, 2);
    assert.equal(game.snapshot().defeated, 0);
});

test("鍵の音が止まると静止して隙を見せ、ノーマルはその瞬間から攻撃可能", () => {
    const game = encounter();
    game.update(4200, 90);
    const boss = game.snapshot().enemies[0];
    assert.equal(boss.phase, "exposed");
    assert.equal(boss.phaseRemainingMs, 2400);
    assert.equal(game.drainEvents().filter((event) => event.type === "boss-opening").length, 1);
    game.update(100, 90);
    assert.equal(game.snapshot().enemies[0].worldYaw, boss.worldYaw);
    assert.equal(game.attack(boss.worldYaw), true);
    assert.equal(game.snapshot().enemies[0].health, 2);
    assert.equal(game.snapshot().enemies[0].phase, "recovering");
    assert.equal(game.snapshot().defeated, 0);
    assert.equal(game.snapshot().score, 50);
    assert.equal(game.drainEvents().filter((event) => event.type === "enemy-hit").length, 1);
});

test("1回の隙で連打しても複数ダメージを与えない", () => {
    const game = encounter(); opening(game); hit(game);
    const boss = game.snapshot().enemies[0];
    assert.equal(game.attack(boss.worldYaw), false);
    game.update(250, boss.worldYaw);
    assert.equal(game.attack(boss.worldYaw), false);
    assert.equal(game.snapshot().enemies[0].health, 2);
    assert.equal(game.snapshot().defeated, 0);
});

test("命中後に方向を変え、ダメージごとに次の攻撃までの間が短くなる", () => {
    const game = encounter(); opening(game);
    const before = game.snapshot().enemies[0]; hit(game);
    game.update(1200, 0);
    const next = game.snapshot().enemies[0];
    assert.equal(next.phase, "guarding");
    assert.equal(next.phaseRemainingMs, 3750);
    assert.ok(Math.abs(Math.abs(next.angularVelocity) - 10.8) < 1e-6);
    assert.ok(Math.abs(relativeAngle(next.worldYaw, before.worldYaw)) >= 80);
    opening(game); hit(game); game.update(1200, 0);
    assert.equal(game.snapshot().enemies[0].phaseRemainingMs, 3300);
});

test("隙を逃すと攻撃予告を経て1ダメージ。ボスは逃げず、戦闘が続く", () => {
    const game = encounter();
    game.update(4200 + 2400, 90);
    assert.equal(game.snapshot().enemies[0].phase, "winding-up");
    assert.equal(game.snapshot().life, 3);
    game.update(1100, 90);
    assert.equal(game.snapshot().life, 2);
    assert.equal(game.snapshot().enemies[0].phase, "recovering");
    assert.equal(game.snapshot().enemies[0].health, 3);
    assert.equal(game.snapshot().escaped, 0);
    assert.equal(game.snapshot().status, "playing");
    assert.equal(game.drainEvents().filter((event) => event.type === "player-damaged").length, 1);
    game.update(500, 90);
    assert.equal(game.snapshot().life, 2);
});

test("攻撃予告中でも最後の反撃が可能", () => {
    const game = encounter(); game.update(4200 + 2400, 90);
    hit(game);
    assert.equal(game.snapshot().enemies[0].health, 2);
    assert.equal(game.snapshot().life, 3);
});

test("放置してもボスが離脱してクリアになることはなく、ライフ0で敗北", () => {
    const game = encounter(); game.update(60000, 90);
    assert.equal(game.snapshot().result?.reason, "defeated");
    assert.equal(game.snapshot().result?.defeated, 0);
    assert.equal(game.snapshot().life, 0);
    assert.equal(game.snapshot().enemies[0].health, 3);
});

test("両難易度で3回命中して撃破、最後の消滅音の余韻を経てクリア", () => {
    for (const difficulty of ["easy", "normal"] as const) {
        const game = encounter(difficulty);
        let kills = 0;
        for (let index = 0; index < 3; index++) {
            opening(game); hit(game);
            kills += game.drainEvents().filter((event) => event.type === "enemy-defeated").length;
            assert.equal(game.snapshot().defeated, index === 2 ? 1 : 0);
        }
        assert.equal(kills, 1);
        assert.equal(game.snapshot().enemies[0].health, 0);
        assert.equal(game.snapshot().score, 1100);
        assert.equal(game.snapshot().ending, true);
        assert.equal(combatPresentation(game.snapshot(), "playing", 0).canAttack, false);
        assert.equal(game.attack(0), false);
        game.update(1799, 0);
        assert.equal(game.attack(90), false);
        assert.equal(game.snapshot().misses, 0);
        assert.equal(game.snapshot().status, "playing");
        game.update(1, 0);
        assert.equal(game.snapshot().result?.reason, "cleared");
        assert.equal(game.snapshot().result?.life, 3);
    }
});

test("一時停止と再校正はボスの体力・隙の残り時間・相対方向を保つ", () => {
    const game = encounter(); opening(game); game.pause();
    const before = game.snapshot(); game.update(6000, 0);
    assert.deepEqual(game.snapshot(), before);
    game.recenter(30);
    const after = game.snapshot().enemies[0];
    assert.equal(after.health, before.enemies[0].health);
    assert.equal(after.phaseRemainingMs, before.enemies[0].phaseRemainingMs);
    assert.equal(relativeAngle(before.enemies[0].worldYaw, 30), after.worldYaw);
});

test("ボスが隙を見せている間はフェイクを止め、画面からは隙を知らせない", () => {
    const game = encounter(); game.update(1800, 90);
    assert.equal(game.snapshot().phantoms.length, 1);
    const guarded = combatPresentation(game.snapshot(), "playing", 0);
    opening(game);
    assert.equal(game.snapshot().phantoms.length, 0);
    assert.deepEqual(combatPresentation(game.snapshot(), "playing", 0), guarded);
});

test("ボスを複数同時・時間制・ほかの敵と混ぜて配置できない", () => {
    const stage = getStage("boss-room");
    assert.throws(() => validateStage({ ...stage, maxConcurrent: 2 }));
    assert.throws(() => validateStage({ ...stage, mode: "timed", durationMs: 60000 }));
    assert.throws(() => validateStage({ ...stage, waves: [{ name: "bad", enemies: [{ kind: "warden" }, { kind: "walker" }] }] }));
});
