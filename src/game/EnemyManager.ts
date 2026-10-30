import type { Enemy } from "./types.ts";

export function createEnemy(
    worldYaw: number,
    distance: number
): Enemy {
    const enemy: Enemy = {
        worldYaw: worldYaw,
        distance: distance
    };

    return enemy;
}

export function createRandomEnemy(
    distance: number
): Enemy {
    const randomWorldYaw: number = Math.random() * 360 - 180;

    return createEnemy(randomWorldYaw, distance);
}