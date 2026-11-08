import type { GameDifficulty, GameResult } from "./types.ts";

export interface GameSettings { volume: number; haptics: boolean; music: boolean }
export interface StageRecord { score: number; cleared: boolean }
const settingsKey = "echo-hunt:settings:v1";
// EASYは従来のキーを使い、すでに保存された記録をそのまま引き継ぐ。
const recordKey = (id: string, difficulty: GameDifficulty): string =>
    difficulty === "normal" ? `echo-hunt:record:v1:${id}:normal` : `echo-hunt:record:v1:${id}`;

// 保存禁止や壊れたJSONは未保存として扱い、初期値でプレイを続ける。
function read(key: string): unknown {
    try { return JSON.parse(localStorage.getItem(key) ?? "null"); } catch { return null; }
}
function write(key: string, value: unknown): void {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* 保存不可でもプレイは継続。 */ }
}

export function loadSettings(): GameSettings {
    const savedSettings = read(settingsKey) as Partial<GameSettings> | null;
    return {
        volume: typeof savedSettings?.volume === "number" && Number.isFinite(savedSettings.volume) ? Math.max(0.05, Math.min(1, savedSettings.volume)) : 0.7,
        haptics: typeof savedSettings?.haptics === "boolean" ? savedSettings.haptics : true,
        music: typeof savedSettings?.music === "boolean" ? savedSettings.music : true,
    };
}
export function saveSettings(settings: GameSettings): void { write(settingsKey, settings); }

export function getRecord(stageId: string, difficulty: GameDifficulty = "easy"): StageRecord {
    const savedRecord = read(recordKey(stageId, difficulty)) as Partial<StageRecord> | null;
    return {
        score: typeof savedRecord?.score === "number" && Number.isFinite(savedRecord.score) ? Math.max(0, savedRecord.score) : 0,
        cleared: savedRecord?.cleared === true,
    };
}

export function saveResult(result: GameResult): { bestScore: number; isNewRecord: boolean } {
    const previousRecord = getRecord(result.stageId, result.difficulty);
    const score = Math.max(previousRecord.score, result.score);
    write(recordKey(result.stageId, result.difficulty), { score, cleared: previousRecord.cleared || result.reason === "cleared" });
    return { bestScore: score, isNewRecord: result.score > previousRecord.score };
}
