import { enemyDefinitions } from "./enemies.ts";
import { relativeAngle } from "./capture.ts";
import type { CombatEnemy, GameDifficulty } from "./types.ts";

export function recoverBoss(enemy: CombatEnemy): void {
    const definition = enemyDefinitions[enemy.kind];
    enemy.phase = "recovering";
    enemy.phaseRemainingMs = definition.boss?.recoveryMs ?? 1200;
    enemy.capture = { progressMs: 0, isCaptured: false };
}

/** 位置は水平方向だけ。各周期で一度だけ攻撃し、撃破まで戦闘を続ける。 */
export function updateBoss(enemy: CombatEnemy, dtMs: number, difficulty: GameDifficulty, random: () => number): "opening" | "warning" | "attack" | null {
    const definition = enemyDefinitions[enemy.kind];
    const pattern = definition.boss;
    if (!pattern) return null;
    enemy.phaseRemainingMs = Math.max(0, enemy.phaseRemainingMs - dtMs);
    const wounds = enemy.maxHealth - enemy.health;
    if (enemy.phase === "guarding") {
        // 息を吸う直前には足を止める。音を追って向きを合わせる時間を残す。
        if (enemy.phaseRemainingMs > 600) {
            enemy.worldYaw = relativeAngle(enemy.worldYaw + enemy.angularVelocity * dtMs / 1000, 0);
        }
        if (enemy.phaseRemainingMs === 0) {
            enemy.phase = "exposed";
            enemy.phaseRemainingMs = pattern.exposedMs - wounds * 200 + (difficulty === "easy" ? 500 : 0);
            enemy.capture = { progressMs: 0, isCaptured: false };
            return "opening";
        }
    } else if (enemy.phase === "exposed" && enemy.phaseRemainingMs === 0) {
        enemy.phase = "winding-up";
        enemy.phaseRemainingMs = definition.windupMs;
        return "warning";
    } else if (enemy.phase === "winding-up") {
        enemy.distance = 1 + (definition.spawnDistance - 1) * enemy.phaseRemainingMs / definition.windupMs;
        if (enemy.phaseRemainingMs === 0) {
            recoverBoss(enemy);
            return "attack";
        }
    } else if (enemy.phase === "recovering" && enemy.phaseRemainingMs === 0) {
        enemy.phase = "guarding";
        enemy.phaseRemainingMs = pattern.guardMs - wounds * 450;
        enemy.distance = definition.spawnDistance;
        const direction = random() < 0.5 ? -1 : 1;
        enemy.worldYaw = relativeAngle(enemy.worldYaw + direction * (80 + random() * 60), 0);
        enemy.angularVelocity = direction * definition.angularSpeed * (1 + wounds * 0.35);
    }
    return null;
}
