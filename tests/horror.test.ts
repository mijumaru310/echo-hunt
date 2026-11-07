import test from "node:test";
import assert from "node:assert/strict";
import { GameEngine } from "../src/game/GameEngine.ts";
import { getStage, validateStage } from "../src/game/stages.ts";
import { getEnemyVoice, isActiveEnemy, phantomPulse } from "../src/game/enemyBehavior.ts";
import { combatPresentation } from "../src/game/combatPresentation.ts";
import { relativeAngle } from "../src/game/capture.ts";
import type { GameDifficulty, StageDefinition } from "../src/game/types.ts";

function fixture(overrides: Partial<StageDefinition> = {}, difficulty: GameDifficulty = "normal"): GameEngine {
    const game = new GameEngine({
        ...getStage("mansion"), haunting: undefined,
        waves: [{ name: "test", enemies: [{ kind: "walker", approachSpeed: 0 }] }], ...overrides,
    }, () => 0.5, difficulty);
    game.start(); game.update(600, 0); game.drainEvents();
    return game;
}
const haunting = { fakeIntervalMs: 1800, fakeLifetimeMs: 6500, atmosphereIntervalMs: 1000 };

test("NORMALは狙った瞬間に攻撃でき、待ってもロック・合図が生じない", () => {
    const game = fixture();
    assert.equal(game.snapshot().enemies[0].capture.progressMs, 0);
    game.update(2000, 0);
    assert.equal(game.snapshot().targetId, null);
    assert.equal(game.snapshot().enemies[0].capture.progressMs, 0);
    assert.equal(game.drainEvents().some((event) => event.type === "lock-ready"), false);
    assert.equal(game.attack(0), true);
    assert.equal(game.snapshot().shots, 1);
    assert.equal(game.snapshot().misses, 0);
});

test("EASYは既存の700msロック・合図・ゲージを保持", () => {
    const game = fixture({}, "easy");
    assert.equal(game.attack(0), false);
    assert.equal(game.snapshot().shots, 0);
    game.update(350, 0);
    assert.equal(combatPresentation(game.snapshot(), "playing", 0).progress, 0.5);
    game.update(350, 0);
    assert.equal(game.drainEvents().filter((event) => event.type === "lock-ready").length, 1);
    assert.equal(combatPresentation(game.snapshot(), "playing", 0).locked, true);
    assert.equal(game.attack(0), true);
});

test("NORMALの表示と攻撃可否は敵の有無・方向・距離から変化しない", () => {
    const game = fixture();
    const view = game.snapshot();
    const baseline = combatPresentation(view, "playing", 0);
    for (const yaw of [-180, -15, 0, 15, 90, 180]) {
        const moved = structuredClone(view);
        moved.enemies[0].worldYaw = yaw;
        moved.enemies[0].distance = yaw === 0 ? 1 : 3;
        moved.targetId = moved.enemies[0].id;
        moved.enemies[0].capture.progressMs = 700;
        assert.deepEqual(combatPresentation(moved, "playing", 0), baseline);
    }
    assert.deepEqual(combatPresentation({ ...view, enemies: [], targetId: null }, "playing", 0), baseline);
    assert.equal(baseline.progress, 0);
    assert.equal(baseline.canAttack, true);
    assert.equal(baseline.locked, false);
});

test("空振りはライフを減らさず650msの隙となり、連打で時間を延長しない", () => {
    const game = fixture();
    assert.equal(game.attack(90), false);
    const afterMiss = game.snapshot();
    assert.equal(afterMiss.attackRecoveryMs, 650);
    assert.equal(afterMiss.life, 3);
    assert.equal(afterMiss.misses, 1);
    assert.equal(game.attack(0), false);
    game.update(649, 0);
    assert.equal(game.attack(0), false);
    assert.equal(game.snapshot().shots, 1);
    game.update(1, 0);
    assert.equal(game.attack(0), true);
    assert.equal(game.snapshot().shots, 2);
    assert.equal(game.drainEvents().filter((event) => event.type === "attack-missed").length, 1);
});

test("空振り後の隙は一時停止中に進まず、終わっていないゲームの敵は接近を続ける", () => {
    const game = fixture({ waves: [{ name: "test", enemies: [{ kind: "walker" }] }] });
    game.attack(90);
    game.pause(); const paused = game.snapshot(); game.update(5000, 0);
    assert.deepEqual(game.snapshot(), paused);
    game.resume(); game.update(325, 0);
    assert.equal(game.snapshot().attackRecoveryMs, 325);
    assert.ok(game.snapshot().enemies[0].distance < paused.enemies[0].distance);
});

test("空振りは連続撃破を切るが、既存の得点を減らさない", () => {
    const game = fixture({ waves: [{ name: "pair", enemies: [{ kind: "walker", approachSpeed: 0 }, { kind: "walker", approachSpeed: 0 }] }] });
    game.attack(0); game.update(1100, 0);
    assert.equal(game.snapshot().combo, 1);
    game.attack(90);
    assert.equal(game.snapshot().combo, 0);
    assert.equal(game.snapshot().score, 100);
    game.update(650, 0); game.attack(0);
    assert.equal(game.snapshot().score, 200);
});

test("NORMALも正面±15度だけに当たり、180度の境界を扱える", () => {
    assert.equal(fixture().attack(15), true);
    assert.equal(fixture().attack(-15), true);
    assert.equal(fixture().attack(15.01), false);
    const game = new GameEngine({ ...getStage("stationary"), haunting: undefined }, () => 0, "normal");
    game.start(); game.update(600, 0);
    assert.equal(game.attack(179), true);
});

test("息を潜める敵は足音→短い呼吸→沈黙。同じ場所に留まり、沈黙中も撃破可能", () => {
    const game = fixture({ waves: [{ name: "lurker", enemies: [{ kind: "lurker" }] }] });
    assert.equal(getEnemyVoice(game.snapshot().enemies[0])?.key, "movement");
    game.update(2600, 90);
    const hidden = game.snapshot().enemies[0];
    assert.equal(hidden.phase, "hiding");
    assert.equal(getEnemyVoice(hidden)?.key, "breath");
    game.update(900, 90);
    const silent = game.snapshot().enemies[0];
    assert.equal(getEnemyVoice(silent), null);
    assert.equal(silent.distance, hidden.distance);
    assert.equal(silent.worldYaw, hidden.worldYaw);
    assert.equal(game.attack(silent.worldYaw), true);
    assert.equal(game.snapshot().score, 200);
    assert.equal(game.snapshot().life, 3);
});

test("息を潜める敵は沈黙の後、同じ位置から移動を再開", () => {
    const game = fixture({ waves: [{ name: "lurker", enemies: [{ kind: "lurker" }] }] });
    game.update(2600, 90);
    const hidden = game.snapshot().enemies[0];
    game.update(2200, 90);
    const resumed = game.snapshot().enemies[0];
    assert.equal(resumed.phase, "approaching");
    assert.equal(resumed.distance, hidden.distance);
    game.update(25, 90);
    assert.ok(game.snapshot().enemies[0].distance < hidden.distance);
    assert.equal(getEnemyVoice(game.snapshot().enemies[0])?.key, "movement");
});

test("フェイクは本物と離れた方向に現れ、位置・距離を変えず、攻撃も得点も生まない", () => {
    const game = fixture({ haunting });
    game.update(1800, 90);
    const phantom = game.snapshot().phantoms[0];
    assert.ok(phantom);
    assert.ok(Math.abs(relativeAngle(phantom.worldYaw, game.snapshot().enemies[0].worldYaw)) >= 55);
    assert.equal(game.attack(phantom.worldYaw), false);
    assert.equal(game.snapshot().misses, 1);
    game.update(2000, 90);
    const later = game.snapshot().phantoms.find((item) => item.id === phantom.id)!;
    assert.equal(later.worldYaw, phantom.worldYaw);
    assert.equal(later.distance, phantom.distance);
    assert.equal(game.snapshot().life, 3);
    assert.equal(game.snapshot().score, 0);
    assert.equal(game.snapshot().enemies.length, 1);
});

test("フェイクが残っていても本物を倒すと消え、ウェーブ完了を妨げない", () => {
    const game = fixture({ haunting }); game.update(1800, 90);
    assert.equal(game.snapshot().phantoms.length, 1);
    assert.equal(game.attack(0), true);
    assert.equal(game.snapshot().phantoms.length, 0);
    game.update(800, 0);
    assert.equal(game.snapshot().result?.reason, "cleared");
    assert.equal(game.snapshot().result?.defeated, 1);
});

test("EASYのゲージはフェイクをロックしない", () => {
    const game = fixture({ haunting }, "easy"); game.update(1800, 90);
    const phantom = game.snapshot().phantoms[0];
    game.drainEvents(); game.update(1000, phantom.worldYaw);
    assert.equal(game.snapshot().targetId, null);
    assert.equal(game.drainEvents().some((event) => event.type === "lock-ready"), false);
});

test("怪異とフェイクは停止・再校正を正しく扱い、ライフに影響しない", () => {
    const game = fixture({ haunting }); game.update(1800, 90);
    assert.ok(game.drainEvents().some((event) => event.type === "haunting"));
    game.pause(); const before = game.snapshot(); game.update(10000, 0);
    assert.deepEqual(game.snapshot(), before);
    game.recenter(30);
    assert.equal(relativeAngle(before.phantoms[0].worldYaw, 30), game.snapshot().phantoms[0].worldYaw);
    assert.equal(game.snapshot().life, 3);
});

test("フェイクの3歩は0・420・840msで鳴り、次は2400msまで待つ", () => {
    assert.deepEqual([0, 420, 840, 2400].map((age) => phantomPulse(age).index), [0, 1, 2, 3]);
    assert.equal(phantomPulse(1000).justStarted, false);
    assert.equal(phantomPulse(2399).justStarted, false);
    assert.equal(phantomPulse(2400).justStarted, true);
});

test("怪異設定の不正な値を検出", () => {
    assert.throws(() => validateStage({ ...getStage("mansion"), haunting: { ...haunting, fakeIntervalMs: NaN } }));
    assert.throws(() => validateStage({ ...getStage("mansion"), haunting: { ...haunting, fakeLifetimeMs: 0 } }));
});

test("第二夜は両難易度で9体・3ウェーブを通してクリアできる", () => {
    for (const difficulty of ["easy", "normal"] as const) {
        const game = new GameEngine(getStage("sealed-hall"), () => 0.5, difficulty);
        const kinds = new Set<string>();
        game.start();
        for (let frame = 0; frame < 5000 && game.snapshot().status !== "finished"; frame++) {
            const active = game.snapshot().enemies.find(isActiveEnemy);
            const yaw = active?.worldYaw ?? 0;
            game.update(25, yaw);
            if (active && game.snapshot().enemies.find((enemy) => enemy.id === active.id && isActiveEnemy(enemy))) game.attack(yaw);
            for (const event of game.drainEvents()) if (event.type === "spawned") kinds.add(event.enemy.kind);
        }
        assert.equal(game.snapshot().result?.reason, "cleared");
        assert.equal(game.snapshot().result?.defeated, 9);
        assert.equal(game.snapshot().result?.life, 3);
        assert.equal(game.snapshot().result?.difficulty, difficulty);
        assert.ok(kinds.has("lurker"));
    }
});
