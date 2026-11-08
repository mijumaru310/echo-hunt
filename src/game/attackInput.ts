/** Controls keep their own actions; the rest of the room is a single attack area. */
export const attackControlSelector = "button, input, select, textarea, a, summary, [role='button'], [data-no-attack]";

export function isAttackTarget(target: Element): boolean {
    if (target.closest(".pause-panel, .pc-controls, .debug-panel, [data-no-attack]")) return false;
    const control = target.closest(attackControlSelector);
    return !control || control.classList.contains("attack-surface");
}
