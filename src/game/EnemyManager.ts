import type { Enemy, EnemyMode } from "./types.ts";
import { relativeAngle, updateCapture } from "./capture.ts";

const spawnDistance: number = 3;
export const contactDistance: number = 1;
export const approachTimeMs: number = 15_000;
// ラウンドの残り時間ではなく、現在の敵が到達するまでの時間。
export function timeToContactMs(distance: number): number {
    return Math.max(0, distance - contactDistance) * approachTimeMs / (spawnDistance - contactDistance);
}
export const enemyModeLabels: Record<EnemyMode, string> = {
    stationary: "静止する敵", moving: "動く敵", approaching: "接近する敵"
};

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

export function createEnemyForMode(mode: EnemyMode, id: string): Enemy {
    const angularVelocity: number = mode === "moving"
        ? (Math.random() < 0.5 ? -12 : 12)
        : 0;

    return createRandomEnemy(mode === "approaching" ? spawnDistance : 2, id, angularVelocity);
}

// 経過時間から位置を更新する。元の敵データは直接変更しない。
export function updateEnemyPosition(enemy: Enemy, dtMs: number, mode?: EnemyMode): Enemy {
    const elapsedMs: number = Number.isFinite(dtMs) ? Math.max(0, dtMs) : 0;

    if (mode === "approaching" && elapsedMs > 0) {
        const travelDistance: number = (spawnDistance - contactDistance) * elapsedMs / approachTimeMs;
        return { ...enemy, distance: Math.max(contactDistance, enemy.distance - travelDistance) };
    }

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
