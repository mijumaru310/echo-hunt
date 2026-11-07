import type { GameResult } from "./types.ts";

export interface GameSettings { volume: number; haptics: boolean }
export interface StageRecord { score: number; cleared: boolean }
const settingsKey = "echo-hunt:settings:v1";
const recordKey = (id: string): string => `echo-hunt:record:v1:${id}`;

function read(key: string): unknown {
    try { return JSON.parse(localStorage.getItem(key) ?? "null"); } catch { return null; }
}
function write(key: string, value: unknown): void {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* 保存不可でもプレイは継続。 */ }
}

export function loadSettings(): GameSettings {
    const value = read(settingsKey) as Partial<GameSettings> | null;
    return {
        volume: typeof value?.volume === "number" && Number.isFinite(value.volume) ? Math.max(0.05, Math.min(1, value.volume)) : 0.7,
        haptics: typeof value?.haptics === "boolean" ? value.haptics : true,
    };
}
export function saveSettings(settings: GameSettings): void { write(settingsKey, settings); }

export function getRecord(stageId: string): StageRecord {
    const value = read(recordKey(stageId)) as Partial<StageRecord> | null;
    return {
        score: typeof value?.score === "number" && Number.isFinite(value.score) ? Math.max(0, value.score) : 0,
        cleared: value?.cleared === true,
    };
}

export function saveResult(result: GameResult): { bestScore: number; isNewRecord: boolean } {
    const previous = getRecord(result.stageId);
    const score = Math.max(previous.score, result.score);
    write(recordKey(result.stageId), { score, cleared: previous.cleared || result.reason === "cleared" });
    return { bestScore: score, isNewRecord: result.score > previous.score };
}
