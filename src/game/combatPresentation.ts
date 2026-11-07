import { difficultyRules } from "./difficulty.ts";
import { isInCaptureRange, relativeAngle } from "./capture.ts";
import type { GameSnapshot } from "./types.ts";

export type CombatPhase = "countdown" | "playing" | "paused" | "finished";

/** NORMALの見た目・操作可否は、敵の位置や捕捉状態に依存させない。 */
export function combatPresentation(snapshot: GameSnapshot, phase: CombatPhase, playerYaw: number) {
    const rules = difficultyRules[snapshot.difficulty];
    let progress = 0;
    if (rules.showGauge) {
        const target = snapshot.enemies.find((enemy) => enemy.id === snapshot.targetId);
        if (target && isInCaptureRange(relativeAngle(target.worldYaw, playerYaw))) {
            progress = Math.min(1, target.capture.progressMs / target.lockTimeMs);
        }
    }
    const recovering = snapshot.attackRecoveryMs > 0;
    const canAttack = phase === "playing" && !snapshot.ending && !recovering && (!rules.requiresLock || progress >= 1);
    const locked = rules.showGauge && canAttack;
    const title = phase === "countdown" ? "開始まで" : phase === "finished"
        ? snapshot.result?.reason === "defeated" ? "ゲームオーバー" : snapshot.result?.reason === "time" ? "練習終了" : "クリア"
        : snapshot.ending ? "クリア" : recovering ? "クールタイム" : !rules.showGauge ? ""
        : locked ? "タップで攻撃" : progress > 0 ? "狙いを定める" : "捜索中";
    return { showGauge: rules.showGauge, progress, locked, canAttack, title };
}
