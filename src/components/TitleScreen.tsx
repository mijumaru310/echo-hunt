import { useState } from "react";
import type { ReactElement } from "react";
import { stages, getStage } from "../game/stages.ts";
import { getRecord } from "../game/storage.ts";
import { enemyDefinitions } from "../game/enemies.ts";
import { isDebug } from "../game/config.ts";
import { stageBackgroundStyle } from "./stagePresentation.ts";

export default function TitleScreen({ initialStageId, onStart }: { initialStageId: string; onStart: (stageId: string) => void }): ReactElement {
    const [selectedId, setSelectedId] = useState(initialStageId);
    const stage = getStage(selectedId);
    const record = getRecord(stage.id);
    return (
        <main className="echo-game echo-title mansion-menu" style={stageBackgroundStyle(stage.background)}>
            <header className="title-heading"><p className="eyebrow">A HORROR EXPERIENCE IN SOUND</p><h1 className="haunt-wordmark"><span>ECHO</span><span>HUNT</span></h1><p className="title-tagline">見えない気配を、音で狩る。</p></header>
            <div className="menu-controls">
                <div className="stage-selector"><label htmlFor="stage-select">探索する場所</label><select id="stage-select" value={selectedId} onChange={(event) => setSelectedId(event.currentTarget.value)}>{stages.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
                <article className="stage-card" aria-live="polite"><div className="stage-card-meta"><span>{stage.subtitle}</span><span>{stage.difficulty} · {stage.mode === "waves" ? stage.waves.length + " WAVES" : "60 SEC"}</span></div><p>{stage.description}</p><p className="stage-best">BEST <strong>{record.score.toLocaleString()}</strong>{record.cleared && <span>踏破済み</span>}</p></article>
                <button className="menu-primary" type="button" onClick={() => onStart(stage.id)}>探索の準備へ <span aria-hidden="true">→</span></button>
                <p className="screen-note title-instructions">イヤホンを装着し、スマホを持って体を回す。<br />気配を捉え、合図が鳴ったら画面をタップ。</p>
                <details className="enemy-guide"><summary>3つの気配と、生き延びるための手がかり</summary><ul>{Object.entries(enemyDefinitions).map(([id, enemy]) => <li key={id}><strong>{enemy.name}</strong><span>{enemy.description}</span></li>)}</ul><p>鋭い唸り声は攻撃予告。撃破が間に合わないとライフを失います。連続撃破で得点が増えます。</p></details>
                {isDebug && <a className="debug-link" href="?page=audio">音響・センサーのテスト画面</a>}
            </div>
        </main>
    );
}
