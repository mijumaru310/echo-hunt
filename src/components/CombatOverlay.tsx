import type { CSSProperties, ReactElement } from "react";
import { combatPresentation } from "../game/combatPresentation.ts";
import { difficultyRules } from "../game/difficulty.ts";
import type { CombatPhase } from "../game/combatPresentation.ts";
import type { GameSnapshot } from "../game/types.ts";
import type { Feedback } from "../game/useGameSession.ts";

export default function CombatOverlay({ snapshot, phase, playerYaw, countdown, feedback, onAttack }: {
    snapshot: GameSnapshot; phase: CombatPhase; playerYaw: number; countdown: number;
    feedback: Feedback | null; onAttack: () => void;
}): ReactElement {
    const view = combatPresentation(snapshot, phase, playerYaw);
    const recoveryFraction: number = Math.min(1, snapshot.attackRecoveryMs / Math.max(1, difficultyRules[snapshot.difficulty].missRecoveryMs));
    return <>
        <button type="button" className="attack-surface" disabled={!view.canAttack} onClick={onAttack} aria-label="正面に攻撃する">
            <span className="sr-only">正面に攻撃する</span>
        </button>
        <div className={"hunt-focus " + (view.locked ? "is-locked " : "") + (feedback?.kind === "kill" ? "is-victorious" : "")}>
            <div className={view.showGauge ? "reticle" : "reticle reticle-blind"} aria-hidden="true">
                {view.showGauge && <svg viewBox="0 0 100 100">
                    <circle className="reticle-track" cx="50" cy="50" r="40" />
                    <circle className="reticle-progress" cx="50" cy="50" r="40" pathLength="100" strokeDasharray="100" strokeDashoffset={100 - view.progress * 100} />
                </svg>}
                <span className="reticle-center">{phase === "countdown" ? countdown : feedback?.kind === "kill" ? "✦" : "+"}</span>
                {feedback?.kind === "kill" && <div className="defeat-burst" key={feedback.id}>
                    {Array.from({ length: 10 }, (_, index) => <i key={index} style={{ "--ray": index * 36 + "deg" } as CSSProperties} />)}
                </div>}
            </div>
            {view.title && <p className="hunt-focus-title">{view.title}</p>}
            {view.locked && <p className="hunt-focus-caption">画面のどこでもタップ</p>}
            {phase === "countdown" && <p className="hunt-focus-caption">スマホを正面に持ってください</p>}
        </div>
        <div className="combat-feedback" role="status" aria-live="polite" aria-atomic="true">
            {feedback && <div key={feedback.id} className={"feedback-notice feedback-" + feedback.kind}>
                <strong>{feedback.title}</strong><span>{feedback.detail}</span>
            </div>}
        </div>
        {phase === "playing" && snapshot.attackRecoveryMs > 0 && <div className="attack-recovery" aria-hidden="true">
            <span style={{ transform: `scaleX(${recoveryFraction})` }} />
        </div>}
        {snapshot.combo >= 2 && phase === "playing" && <p className="combo-counter">{snapshot.combo}<span>連続撃破</span></p>}
        {feedback?.kind === "damage" && <div key={feedback.id} className="damage-vignette" aria-hidden="true" />}
    </>;
}
