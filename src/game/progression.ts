import { campaignStages, stages } from "./stages.ts";
import { getRecord } from "./storage.ts";
import type { StageDefinition } from "./types.ts";

// 保存できないブラウザでも、起動中のクリア履歴から次のステージを解放する。
export function getUnlockedStageIds(sessionClearedIds: readonly string[] = []): readonly string[] {
    let lastUnlockedIndex: number = 0;
    for (const [campaignIndex, stage] of campaignStages.entries()) {
        const cleared: boolean = sessionClearedIds.includes(stage.id)
            || getRecord(stage.id, "easy").cleared || getRecord(stage.id, "normal").cleared;
        if (cleared) lastUnlockedIndex = Math.max(lastUnlockedIndex, campaignIndex + 1);
    }

    // 順番制を導入する前のクリア記録でも、手前のステージをロックし直さない。
    const unlockedCampaignIds: readonly string[] = campaignStages
        .slice(0, lastUnlockedIndex + 1).map((stage: StageDefinition): string => stage.id);
    return stages.filter((stage: StageDefinition): boolean =>
        !campaignStages.some((campaign: StageDefinition): boolean => campaign.id === stage.id)
        || unlockedCampaignIds.includes(stage.id)
    ).map((stage: StageDefinition): string => stage.id);
}

export function getNextStage(stageId: string): StageDefinition | null {
    const stageIndex: number = campaignStages.findIndex((stage: StageDefinition): boolean => stage.id === stageId);
    return stageIndex < 0 ? null : campaignStages[stageIndex + 1] ?? null;
}
