import { useState } from "react";
import type { ReactElement } from "react";
import { campaignStages, stages, getStage } from "../game/stages.ts";
import { getRecord } from "../game/storage.ts";
import { getUnlockedStageIds } from "../game/progression.ts";
import { enemyDefinitions } from "../game/enemies.ts";
import { isDebug } from "../game/config.ts";
import { stageBackgroundStyle } from "./stagePresentation.ts";
import { difficultyRules } from "../game/difficulty.ts";
import type { GameDifficulty, StageDefinition } from "../game/types.ts";

export default function TitleScreen({ initialStageId, initialDifficulty = "easy", unlockedStageIds = getUnlockedStageIds(), onStart }: {
    initialStageId: string; initialDifficulty?: GameDifficulty; onStart: (stageId: string, difficulty: GameDifficulty) => void;
    unlockedStageIds?: readonly string[];
}): ReactElement {
    const [selectedId, setSelectedId] = useState<string>((): string =>
        unlockedStageIds.includes(initialStageId) ? initialStageId : stages[0].id);
    const [difficulty, setDifficulty] = useState<GameDifficulty>(initialDifficulty);
    const stage = getStage(selectedId);
    const boss = stage.waves.flatMap((wave) => wave.enemies).map((spawn) => enemyDefinitions[spawn.kind]).find((enemy) => enemy.boss);
    const record = getRecord(stage.id, difficulty);
    const practiceStages: readonly StageDefinition[] = stages.filter((item: StageDefinition): boolean =>
        !campaignStages.some((campaign: StageDefinition): boolean => campaign.id === item.id));

    function stageChoice(item: StageDefinition): ReactElement {
        const unlocked: boolean = unlockedStageIds.includes(item.id);
        const cleared: boolean = getRecord(item.id, "easy").cleared || getRecord(item.id, "normal").cleared;
        return (
            <li key={item.id} data-locked={!unlocked} data-selected={selectedId === item.id} data-complete={cleared}>
                <button type="button" className="stage-choice" data-stage-id={item.id} disabled={!unlocked}
                    aria-pressed={selectedId === item.id} onClick={() => { if (unlocked) setSelectedId(item.id); }}>
                    <span className="stage-mark" aria-hidden="true">{!unlocked ? (
                        <svg viewBox="0 0 20 24"><path d="M5 10V6a5 5 0 0 1 10 0v4M3 10h14v12H3z" /><path d="M10 15v3" /></svg>
                    ) : cleared ? "✓" : null}</span>
                    <span className="stage-choice-name">{item.name}</span>
                    {cleared && <small>クリア済み</small>}
                </button>
            </li>
        );
    }
    return (
        <main className="echo-game echo-title mansion-menu" style={stageBackgroundStyle(stage.background)}>
            <div className="title-landing">
                <header className="title-heading"><h1 className="haunt-wordmark"><span>ECHO</span><span>HUNT</span></h1><p className="title-tagline">イヤホンで遊ぶホラーゲーム</p></header>
                <div className="menu-controls title-main-controls">
                    <fieldset className="stage-selector">
                        <legend>探索する場所</legend>
                        <ol className="stage-route">{campaignStages.map(stageChoice)}</ol>
                        <details className="practice-selector" open={practiceStages.some((item: StageDefinition): boolean => item.id === selectedId) || undefined}>
                            <summary>練習</summary>
                            <ul className="practice-stages">{practiceStages.map(stageChoice)}</ul>
                        </details>
                    </fieldset>
                    <article className="stage-card" aria-live="polite"><div className="stage-card-meta"><span>{stage.difficulty}</span><span>{boss?.boss ? boss.boss.health + "回命中で撃破" : stage.mode === "waves" ? "全" + stage.waves.length + "波" : "60秒"}</span></div><p className="stage-best">最高得点 <strong>{record.score.toLocaleString()}</strong>{record.cleared && <span>クリア済み</span>}</p></article>
                    <fieldset className="difficulty-selector" aria-describedby="difficulty-description"><legend>難易度</legend>
                        {(["easy", "normal"] as const).map((mode) => <label key={mode} className={difficulty === mode ? "difficulty-option is-selected" : "difficulty-option"}>
                            <input type="radio" name="difficulty" value={mode} checked={difficulty === mode} onChange={() => setDifficulty(mode)} />
                            <span><strong>{difficultyRules[mode].label}</strong><small>{mode === "easy" ? "ゲージあり" : "音だけで狙う"}</small></span>
                        </label>)}
                    </fieldset>
                    <button className="menu-primary" type="button" onClick={() => onStart(stage.id, difficulty)}>準備する</button>
                </div>
            </div>
            <div className="menu-controls title-help">
                <p className="stage-description" aria-live="polite">{stage.description}</p>
                <p id="difficulty-description">{difficultyRules[difficulty].description}</p>
                <p className="screen-note title-instructions">イヤホンを装着し、スマホを持って体を回す。<br />{difficulty === "easy" ? "気配を捉え、合図が鳴ったら画面をタップ。" : "音で方向を判断してタップ。空振り後は約0.65秒、攻撃できません。"}</p>
                <details className="enemy-guide"><summary>操作と敵の特徴</summary><ul>{Object.entries(enemyDefinitions).map(([id, enemy]) => <li key={id}><strong>{enemy.name}</strong><span>{enemy.description}</span></li>)}</ul><p>鋭い唸り声は攻撃予告。撃破が間に合わないとライフを失います。連続撃破で得点が増えます。</p>
                    <p className="fake-clue">第二夜の残響：同じ強さの3歩を繰り返し、近づかず、呼吸もしない。攻撃しても倒せません。</p>
                </details>
                {isDebug && <a className="debug-link" href="?page=audio">音響・センサーのテスト画面</a>}
            </div>
        </main>
    );
}
