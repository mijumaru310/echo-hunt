import type { ReactElement } from "react";
import type { GameResult } from "../game/types.ts";
import { getStage } from "../game/stages.ts";
import { stageBackgroundStyle } from "./stagePresentation.ts";

export interface SavedResult extends GameResult { bestScore: number; isNewRecord: boolean }

export default function ResultScreen({ result, onRestart, onTitle }: { result: SavedResult; onRestart: () => void; onTitle: () => void }): ReactElement {
    const success = result.reason !== "defeated";
    return (
        <main className="echo-game echo-result mansion-menu" style={stageBackgroundStyle(getStage(result.stageId).background)} data-success={success} aria-label="探索結果">
            <div className="menu-controls result-content">
                <p className="eyebrow">{result.reason === "cleared" ? "THE NIGHT IS OVER" : result.reason === "time" ? "PRACTICE COMPLETE" : "LOST IN THE DARK"}</p>
                <h1>{result.reason === "cleared" ? "夜を、生き延びた。" : result.reason === "time" ? "耳は、闇を覚えた。" : "気配は、すぐそこに。"}</h1>
                <p className="stage-caption">{result.stageName}</p>
                <p className="result-score"><span>SCORE</span><strong>{result.score.toLocaleString()}</strong></p>
                <p className="record-line">{result.isNewRecord ? <strong>NEW BEST</strong> : "BEST"} <span>{result.bestScore.toLocaleString()}</span></p>
                <dl className="result-stats"><div><dt>撃破</dt><dd>{result.defeated}<small>体</small></dd></div><div><dt>最大連続撃破</dt><dd>{result.maxCombo}<small>CHAIN</small></dd></div><div><dt>残りライフ</dt><dd>{result.life}<small>/ {result.maxLife}</small></dd></div><div><dt>{result.waveCount ? "踏破ウェーブ" : "生存時間"}</dt><dd>{result.waveCount ? result.wavesCleared : Math.floor(result.elapsedMs / 1000)}<small>{result.waveCount ? "/ " + result.waveCount : "秒"}</small></dd></div></dl>
                <p className="result-hint">{success ? "音の違いを覚えたら、次は途切れない連続撃破を。" : "心音は接近の合図。鋭い唸り声が聞こえても、攻撃される前なら撃破できます。"}</p>
                <div className="screen-actions"><button className="menu-primary" type="button" onClick={onRestart}>もう一度探索する</button><button className="text-button" type="button" onClick={onTitle}>ステージを選ぶ</button></div>
            </div>
        </main>
    );
}
