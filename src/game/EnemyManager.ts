import type { Enemy, EnemyMode } from "./types.ts";
import { relativeAngle, updateCapture } from "./capture.ts";

export function createEnemy(
    worldYaw: number,
    distance: number,
    id: string,
    angularVelocity: number = 0
): Enemy {
    const enemy: Enemy = {
        id: id,
        worldYaw: worldYaw,
        distance: distance,
        angularVelocity: angularVelocity,
        capture: {
            progressMs: 0,
            isCaptured: false
        }
    };

    return enemy;
}

export function createRandomEnemy(
    distance: number,
    id: string,
    angularVelocity: number = 0
): Enemy {
    const randomWorldYaw: number = Math.random() * 360 - 180;

    return createEnemy(randomWorldYaw, distance, id, angularVelocity);
}

// モードに応じて敵を1体生成する。既存の静止モードはそのまま残す。
export function createEnemyForMode(mode: EnemyMode, id: string): Enemy {
    const angularVelocity: number = mode === "moving"
        ? (Math.random() < 0.5 ? -12 : 12)
        : 0;

    return createRandomEnemy(2, id, angularVelocity);
}

// 経過時間から位置を更新する。元の敵データは直接変更しない。
export function updateEnemyPosition(enemy: Enemy, dtMs: number): Enemy {
    const elapsedMs: number = Number.isFinite(dtMs) ? Math.max(0, dtMs) : 0;

    if (elapsedMs === 0 || enemy.angularVelocity === 0) {
        return enemy;
    }

    const worldYaw: number = relativeAngle(
        enemy.worldYaw + enemy.angularVelocity * elapsedMs / 1000,
        0
    );

    return {
        ...enemy,
        worldYaw: worldYaw
    };
}

export function updateEnemyCapture(
    enemy: Enemy,
    playerYaw: number,
    dtMs: number
): void {
    const relAngle: number = relativeAngle(enemy.worldYaw, playerYaw);
    enemy.capture = updateCapture(enemy.capture, relAngle, dtMs);
}

// 正面を変えても敵の見かけの方向が飛ばないよう、敵側の基準も同じだけずらす。
export function recenterEnemy(enemy: Enemy, playerYaw: number): Enemy {
    return {
        ...enemy,
        worldYaw: relativeAngle(enemy.worldYaw, playerYaw)
    };
}
