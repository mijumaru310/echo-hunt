import type { ReactElement } from "react";
import type { GameResult } from "../game/types.ts";
import { getStage } from "../game/stages.ts";
import { stageBackgroundStyle } from "./stagePresentation.ts";
import { difficultyRules } from "../game/difficulty.ts";
import { enemyDefinitions } from "../game/enemies.ts";

export interface SavedResult extends GameResult { bestScore: number; isNewRecord: boolean }

export default function ResultScreen({ result, onRestart, onTitle, onNextStage }: {
    result: SavedResult; onRestart: () => void; onTitle: () => void; onNextStage?: () => void;
}): ReactElement {
    const success = result.reason !== "defeated";
    const canContinue: boolean = result.reason === "cleared" && onNextStage !== undefined;
    const stage = getStage(result.stageId);
    const bossStage = stage.waves.some((wave) => wave.enemies.some((spawn) => enemyDefinitions[spawn.kind].boss));
    return (
        <main className="echo-game echo-result mansion-menu" style={stageBackgroundStyle(stage.background)} data-success={success} aria-label="探索結果">
            <div className="menu-controls result-content">
                <header className="result-heading">
                    <h1>{result.reason === "cleared" ? "クリア" : result.reason === "time" ? "練習終了" : "ゲームオーバー"}</h1>
                    <p className="stage-caption">{result.stageName} · {difficultyRules[result.difficulty ?? "easy"].label}</p>
                </header>
                <div className="result-record">
                    <p className="result-score"><span>得点</span><strong>{result.score.toLocaleString()}</strong></p>
                    <p className="record-line">{result.isNewRecord ? <strong>自己ベスト更新</strong> : "最高得点"} <span>{result.bestScore.toLocaleString()}</span></p>
                </div>
                <dl className="result-stats">
                    <div><dt>{bossStage ? "命中" : "撃破"}</dt><dd>{bossStage ? result.shots - result.misses : result.defeated}<small>{bossStage ? "回" : "体"}</small></dd></div>
                    <div><dt>{bossStage ? "外した攻撃" : "最大連続撃破"}</dt><dd>{bossStage ? result.misses : result.maxCombo}<small>回</small></dd></div>
                    <div><dt>残りライフ</dt><dd>{result.life}<small>/ {result.maxLife}</small></dd></div>
                    <div><dt>{bossStage ? "戦闘時間" : result.waveCount ? "クリアした波" : "生存時間"}</dt><dd>{bossStage || !result.waveCount ? Math.floor(result.elapsedMs / 1000) : result.wavesCleared}<small>{bossStage || !result.waveCount ? "秒" : "/ " + result.waveCount}</small></dd></div>
                </dl>
                <p className="result-hint">{result.stageId === "boss-room"
                    ? success ? "屋敷の主を倒しました。" : "鍵の音が止まり、息を吸う間に攻撃してください。"
                    : success ? "プレイ終了。記録はこのブラウザに保存されます。" : "攻撃される前なら、予告音が鳴っている間も撃破できます。"}</p>
                {result.difficulty === "normal" && <p className="accuracy-line">攻撃 {result.shots}回 ／ 空振り {result.misses}回 ／ 命中率 {result.shots ? Math.round((result.shots - result.misses) / result.shots * 100) : 0}%</p>}
                <div className="screen-actions">
                    {canContinue && <button className="menu-primary" type="button" onClick={onNextStage}>次のステージへ</button>}
                    <button className={canContinue ? "text-button" : "menu-primary"} type="button" onClick={onRestart}>もう一度探索する</button>
                    <button className="text-button" type="button" onClick={onTitle}>ステージを選ぶ</button>
                </div>
            </div>
        </main>
    );
}
