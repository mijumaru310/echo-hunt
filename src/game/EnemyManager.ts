import type { Enemy } from "./types.ts";

export function createEnemy(
    worldYaw: number,
    distance: number,
    id: string
): Enemy {
    const enemy: Enemy = {
        id: id,
        worldYaw: worldYaw,
        distance: distance
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
