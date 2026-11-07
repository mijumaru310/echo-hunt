import { useState } from "react";
import type { ReactElement } from "react";
import { stages, getStage } from "../game/stages.ts";
import { getRecord } from "../game/storage.ts";
import { enemyDefinitions } from "../game/enemies.ts";
import { isDebug } from "../game/config.ts";
import { stageBackgroundStyle } from "./stagePresentation.ts";
import { difficultyRules } from "../game/difficulty.ts";
import type { GameDifficulty } from "../game/types.ts";

export default function TitleScreen({ initialStageId, initialDifficulty = "easy", onStart }: {
    initialStageId: string; initialDifficulty?: GameDifficulty; onStart: (stageId: string, difficulty: GameDifficulty) => void;
}): ReactElement {
    const [selectedId, setSelectedId] = useState(initialStageId);
    const [difficulty, setDifficulty] = useState<GameDifficulty>(initialDifficulty);
    const stage = getStage(selectedId);
    const boss = stage.waves.flatMap((wave) => wave.enemies).map((spawn) => enemyDefinitions[spawn.kind]).find((enemy) => enemy.boss);
    const record = getRecord(stage.id, difficulty);
    return (
        <main className="echo-game echo-title mansion-menu" style={stageBackgroundStyle(stage.background)}>
            <header className="title-heading"><h1 className="haunt-wordmark"><span>ECHO</span><span>HUNT</span></h1><p className="title-tagline">イヤホンで遊ぶホラーゲーム</p></header>
            <div className="menu-controls">
                <div className="stage-selector"><label htmlFor="stage-select">探索する場所</label><select id="stage-select" value={selectedId} onChange={(event) => setSelectedId(event.currentTarget.value)}>{stages.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
                <article className="stage-card" aria-live="polite"><div className="stage-card-meta"><span>{stage.difficulty}</span><span>{boss?.boss ? boss.boss.health + "回命中で撃破" : stage.mode === "waves" ? "全" + stage.waves.length + "波" : "60秒"}</span></div><p>{stage.description}</p><p className="stage-best">最高得点 <strong>{record.score.toLocaleString()}</strong>{record.cleared && <span>クリア済み</span>}</p></article>
                <fieldset className="difficulty-selector"><legend>難易度</legend>
                    {(["easy", "normal"] as const).map((mode) => <label key={mode} className={difficulty === mode ? "difficulty-option is-selected" : "difficulty-option"}>
                        <input type="radio" name="difficulty" value={mode} checked={difficulty === mode} onChange={() => setDifficulty(mode)} />
                        <span><strong>{difficultyRules[mode].label}</strong><small>{mode === "easy" ? "ゲージあり" : "音だけで狙う"}</small></span>
                    </label>)}
                    <p id="difficulty-description">{difficultyRules[difficulty].description}</p>
                </fieldset>
                <button className="menu-primary" type="button" onClick={() => onStart(stage.id, difficulty)}>準備する</button>
                <p className="screen-note title-instructions">イヤホンを装着し、スマホを持って体を回す。<br />{difficulty === "easy" ? "気配を捉え、合図が鳴ったら画面をタップ。" : "音で方向を判断してタップ。空振り後は約0.65秒、攻撃できません。"}</p>
                <details className="enemy-guide"><summary>操作と敵の特徴</summary><ul>{Object.entries(enemyDefinitions).map(([id, enemy]) => <li key={id}><strong>{enemy.name}</strong><span>{enemy.description}</span></li>)}</ul><p>鋭い唸り声は攻撃予告。撃破が間に合わないとライフを失います。連続撃破で得点が増えます。</p>
                    <p className="fake-clue">第二夜の残響：同じ強さの3歩を繰り返し、近づかず、呼吸もしない。攻撃しても倒せません。</p>
                </details>
                {isDebug && <a className="debug-link" href="?page=audio">音響・センサーのテスト画面</a>}
            </div>
        </main>
    );
}
