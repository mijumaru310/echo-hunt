import type { StageDefinition } from "../types.ts";
import { stageDefaults } from "./defaults.ts";

export const bossRoomStage: StageDefinition = {
    ...stageDefaults,
    id: "boss-room", name: "第三夜・開かずの間", subtitle: "屋敷の主",
    description: "屋敷の主との一対一。鍵の音が止まるまで待ち、息を吸う間に攻撃する。",
    hint: "鍵が鳴っている間は攻撃が通らない。息を吸ったら、その方向を狙う。3回命中で撃破。",
    difficulty: "ボス戦", mode: "waves", defeatPauseMs: 1800,
    haunting: { fakeIntervalMs: 6000, fakeLifetimeMs: 4000, atmosphereIntervalMs: 16000 },
    waves: [{ name: "屋敷の主", enemies: [{ kind: "warden" }] }],
};
