import type { StageDefinition } from "./types.ts";
import { mansionStage } from "./stages/mansion.ts";
import { practiceStages } from "./stages/practice.ts";

/** 新しいステージは別ファイルで作り、ここに1行登録する。 */
export const stages: readonly StageDefinition[] = [mansionStage, ...practiceStages];

export function getStage(id: string): StageDefinition {
    return stages.find((stage) => stage.id === id) ?? stages[0];
}

/** 設定ミスを起動時に発見し、メンバーが原因を追えるようにする。 */
export function validateStage(stage: StageDefinition): void {
    const positive = (value: number): boolean => Number.isFinite(value) && value > 0;
    if (!stage.id || !Number.isInteger(stage.initialLife) || stage.initialLife < 1
        || !Number.isInteger(stage.maxConcurrent) || stage.maxConcurrent < 1 || stage.maxConcurrent > 4
        || !stage.waves.length || stage.waves.some((wave) => !wave.enemies.length)
        || !positive(stage.spawnIntervalMs) || !positive(stage.waveBreakMs) || !positive(stage.defeatPauseMs)
        || (stage.mode === "timed" && !positive(stage.durationMs ?? 0))) {
        throw new Error(`ステージ設定を確認してください: ${stage.id}`);
    }
    for (const wave of stage.waves) {
        for (const spawn of wave.enemies) {
            if (!["walker", "runner", "orbiter"].includes(spawn.kind)
                || (spawn.approachSpeed !== undefined && (!Number.isFinite(spawn.approachSpeed) || spawn.approachSpeed < 0))
                || (spawn.angularSpeed !== undefined && !Number.isFinite(spawn.angularSpeed))) {
                throw new Error(`敵の設定を確認してください: ${stage.id} / ${wave.name}`);
            }
        }
    }
}
