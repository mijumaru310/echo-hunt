import type { StageDefinition } from "../types.ts";
import { stageDefaults } from "./defaults.ts";

export const sealedHallStage: StageDefinition = {
    ...stageDefaults,
    id: "sealed-hall", name: "第二夜・閉ざされた廊下", subtitle: "THE LISTENING DARK",
    description: "足音が途切れる敵と、同じ場所で鳴る偽の足音が出現する。",
    hint: "敵は足音が止まっても同じ場所にいる。フェイクは3歩を繰り返し、近づかず、呼吸しない。",
    difficulty: "応用", mode: "waves",
    haunting: { fakeIntervalMs: 7000, fakeLifetimeMs: 6500, atmosphereIntervalMs: 11000 },
    waves: [
        { name: "止まった足音", enemies: [{ kind: "lurker" }, { kind: "walker" }, { kind: "lurker" }] },
        { name: "残響のある廊下", enemies: [{ kind: "lurker" }, { kind: "orbiter" }, { kind: "runner" }] },
        { name: "奥の廊下", enemies: [{ kind: "orbiter" }, { kind: "lurker" }, { kind: "lurker" }] },
    ],
};
