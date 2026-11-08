import { campaignStages, stages } from "./stages.ts";
import { getRecord } from "./storage.ts";
import type { StageDefinition } from "./types.ts";

// Session clears keep progression working when browser storage is unavailable.
export function getUnlockedStageIds(sessionClearedIds: readonly string[] = []): readonly string[] {
    let lastUnlockedIndex: number = 0;
    for (const [index, stage] of campaignStages.entries()) {
        const cleared: boolean = sessionClearedIds.includes(stage.id)
            || getRecord(stage.id, "easy").cleared || getRecord(stage.id, "normal").cleared;
        if (cleared) lastUnlockedIndex = Math.max(lastUnlockedIndex, index + 1);
    }

    // Existing later-stage clears also preserve access to earlier stages.
    const unlockedCampaignIds: readonly string[] = campaignStages
        .slice(0, lastUnlockedIndex + 1).map((stage: StageDefinition): string => stage.id);
    return stages.filter((stage: StageDefinition): boolean =>
        !campaignStages.some((campaign: StageDefinition): boolean => campaign.id === stage.id)
        || unlockedCampaignIds.includes(stage.id)
    ).map((stage: StageDefinition): string => stage.id);
}

export function getNextStage(stageId: string): StageDefinition | null {
    const index: number = campaignStages.findIndex((stage: StageDefinition): boolean => stage.id === stageId);
    return index < 0 ? null : campaignStages[index + 1] ?? null;
}
