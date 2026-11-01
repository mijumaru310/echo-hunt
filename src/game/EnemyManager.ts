import type { Enemy } from "./types.ts";
import { relativeAngle, updateCapture } from "./capture.ts";

export function createEnemy(
    worldYaw: number,
    distance: number,
    id: string,
): Enemy {
    const enemy: Enemy = {
        id: id,
        worldYaw: worldYaw,
        distance: distance,
        capture: {
            progressMs: 0,
            isCaptured: false
        }
    };

    return enemy;
}

export function createRandomEnemy(
    distance: number,
    id: string
): Enemy {
    const randomWorldYaw: number = Math.random() * 360 - 180;

    return createEnemy(randomWorldYaw, distance, id);
}

export function updateEnemyCapture(
    enemy: Enemy,
    playerYaw: number,
    dtMs: number
): void {
    const relAngle: number = relativeAngle(enemy.worldYaw, playerYaw);
    enemy.capture = updateCapture(enemy.capture, relAngle, dtMs);
}