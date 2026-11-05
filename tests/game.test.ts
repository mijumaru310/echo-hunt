import test from "node:test";
import assert from "node:assert/strict";
import type { Enemy } from "../src/game/types.ts";
import {
    createEnemy,
    createRandomEnemy,
    createEnemyForMode,
    updateEnemyPosition,
    updateEnemyCapture
} from "../src/game/EnemyManager.ts";
import { isInCaptureRange, relativeAngle, tryCapture } from "../src/game/capture.ts";

test("既存の生成方法は静止する敵を返す", (): void => {
    assert.equal(createEnemy(90, 2, "fixed").angularVelocity, 0);
    assert.equal(createRandomEnemy(2, "random").angularVelocity, 0);
    assert.equal(createEnemyForMode("stationary", "standard").angularVelocity, 0);
});

test("移動モードは毎秒12度で左右どちらかに移動する敵を返す", (): void => {
    const enemy: Enemy = createEnemyForMode("moving", "moving-1");
    assert.equal(Math.abs(enemy.angularVelocity), 12);
    assert.equal(enemy.id, "moving-1");
    assert.equal(enemy.distance, 2);
    assert.ok(enemy.worldYaw >= -180 && enemy.worldYaw < 180);
    assert.deepEqual(enemy.capture, { progressMs: 0, isCaptured: false });
});

test("静止する敵は時間が経過しても位置が変わらない", (): void => {
    const enemy: Enemy = createEnemy(90, 2, "stationary");
    assert.equal(updateEnemyPosition(enemy, 60000).worldYaw, 90);
});

test("正の角速度は経過時間に応じて角度を増やす", (): void => {
    const enemy: Enemy = createEnemy(90, 2, "right", 12);
    assert.equal(updateEnemyPosition(enemy, 500).worldYaw, 96);
});

test("負の角速度は経過時間に応じて角度を減らす", (): void => {
    const enemy: Enemy = createEnemy(90, 2, "left", -12);
    assert.equal(updateEnemyPosition(enemy, 500).worldYaw, 84);
});

test("180度をまたぐ移動でも角度を正規化する", (): void => {
    assert.equal(updateEnemyPosition(createEnemy(179, 2, "right", 12), 500).worldYaw, -175);
    assert.equal(updateEnemyPosition(createEnemy(-179, 2, "left", -12), 500).worldYaw, 175);
});

test("更新回数が違っても同じ経過時間なら同じ距離を移動する", (): void => {
    const enemy: Enemy = createEnemy(90, 2, "frames", 12);
    let stepped: Enemy = enemy;

    for (let index: number = 0; index < 60; index++) {
        stepped = updateEnemyPosition(stepped, 1000 / 60);
    }

    const once: Enemy = updateEnemyPosition(enemy, 1000);
    assert.ok(Math.abs(relativeAngle(stepped.worldYaw, once.worldYaw)) < 0.000001);
});

test("負の時間や不正な経過時間では移動しない", (): void => {
    const enemy: Enemy = createEnemy(90, 2, "invalid-time", 12);
    assert.equal(updateEnemyPosition(enemy, -100).worldYaw, 90);
    assert.equal(updateEnemyPosition(enemy, Number.NaN).worldYaw, 90);
    assert.equal(updateEnemyPosition(enemy, Number.POSITIVE_INFINITY).worldYaw, 90);
});

test("移動で元の敵や捕捉状態を変更しない", (): void => {
    const enemy: Enemy = createEnemy(90, 2, "original", 12);
    enemy.capture = { progressMs: 350, isCaptured: false };
    const moved: Enemy = updateEnemyPosition(enemy, 500);

    assert.notEqual(moved, enemy);
    assert.equal(enemy.worldYaw, 90);
    assert.equal(moved.worldYaw, 96);
    assert.equal(moved.id, enemy.id);
    assert.equal(moved.distance, enemy.distance);
    assert.deepEqual(moved.capture, { progressMs: 350, isCaptured: false });
});

test("移動して180度をまたいだ敵も同じ700msの捕獲処理を使える", (): void => {
    const enemy: Enemy = updateEnemyPosition(createEnemy(179, 2, "lock", 12), 700);
    updateEnemyCapture(enemy, -180, 700);

    assert.equal(enemy.capture.progressMs, 700);
    assert.equal(enemy.capture.isCaptured, false);
    assert.equal(tryCapture(enemy.capture, relativeAngle(enemy.worldYaw, -180)).isCaptured, true);
});

test("動く敵も捕捉範囲外では従来の速度でゲージが減る", (): void => {
    const enemy: Enemy = createEnemy(45, 2, "decay", 12);
    enemy.capture = { progressMs: 700, isCaptured: false };
    const moved: Enemy = updateEnemyPosition(enemy, 100);
    updateEnemyCapture(moved, 0, 100);

    assert.equal(moved.capture.progressMs, 525);
    updateEnemyCapture(moved, 0, 300);
    assert.equal(moved.capture.progressMs, 0);
});

test("捕捉範囲は静止・移動とも正面のプラスマイナス15度を含む", (): void => {
    assert.equal(isInCaptureRange(15), true);
    assert.equal(isInCaptureRange(-15), true);
    assert.equal(isInCaptureRange(15.01), false);
    assert.equal(isInCaptureRange(-15.01), false);
});
