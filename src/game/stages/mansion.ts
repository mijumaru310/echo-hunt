import type { StageDefinition } from "../types.ts";
import { stageDefaults } from "./defaults.ts";

export const mansionStage: StageDefinition = {
    ...stageDefaults,
    id: "mansion", name: "第一夜・洋館", subtitle: "THE FIRST NIGHT",
    description: "3種類の敵が出現する洋館。3回の襲撃を生き延びればクリア。",
    hint: "音の方へ向き、合図が鳴ったら画面をタップ。鋭い唸り声は攻撃の前触れ。",
    difficulty: "標準", mode: "waves",
    haunting: { fakeIntervalMs: 0, fakeLifetimeMs: 6500, atmosphereIntervalMs: 14000 },
    waves: [
        { name: "廊下の足音", enemies: [{ kind: "walker" }, { kind: "walker" }, { kind: "walker" }] },
        { name: "駆け寄る影", enemies: [{ kind: "walker" }, { kind: "runner" }, { kind: "runner" }] },
        { name: "扉の向こうの息", enemies: [{ kind: "orbiter" }, { kind: "runner" }, { kind: "orbiter" }] },
    ],
};
