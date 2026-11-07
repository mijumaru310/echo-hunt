import type { StageDefinition, SpawnDefinition } from "../types.ts";
import { stageDefaults } from "./defaults.ts";

export const practiceStages: readonly StageDefinition[] = ([
        { id: "stationary", name: "練習・静かな気配", subtitle: "LISTEN", difficulty: "入門",
            description: "同じ場所から聞こえる足音で、音の方向とロックオンを確かめる。",
            hint: "敵は近づきません。ゆっくり向きを変えて、前後左右の違いを確かめてください。",
            spawn: { kind: "walker", approachSpeed: 0, angularSpeed: 0 } },
        { id: "moving", name: "練習・さまよう気配", subtitle: "FOLLOW", difficulty: "入門",
            description: "周囲を移動する気配を、音だけで追いかける60秒。",
            hint: "敵は近づきません。呼吸音が移動する方向へ、ゆっくり体を向けてください。",
            spawn: { kind: "orbiter", approachSpeed: 0 } },
        { id: "approaching", name: "練習・近づく足音", subtitle: "SURVIVE", difficulty: "基礎",
            description: "約15秒で近づく敵を撃破し、ライフ3で60秒を生き延びる。",
            hint: "心音が速くなったら危険。攻撃予告の間にも、ロックして撃破できます。",
            spawn: { kind: "walker" } },
    ] satisfies Array<{ id: string; name: string; subtitle: string; difficulty: string; description: string; hint: string; spawn: SpawnDefinition }>).map(({ spawn, ...info }): StageDefinition => ({
        ...stageDefaults, ...info, mode: "timed", durationMs: 60_000,
        waves: [{ name: "60秒の練習", enemies: [spawn] }],
    }));
