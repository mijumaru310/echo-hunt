import type { ReactElement } from "react";
import type { FinishReason } from "../game/types.ts";

interface ResultScreenProps {
    score: number;
    reason: FinishReason;
    onRestart: () => void;
    onTitle: () => void;
}

export default function ResultScreen({ score, reason, onRestart, onTitle }: ResultScreenProps): ReactElement {
    return (
        <main className="echo-game echo-result">
            <h1>ECHO HUNT</h1>
            <h2>結果</h2>
            {reason === "caught" && <p>敵に追いつかれました。</p>}

            <p className="result-score">スコア：<strong>{score}</strong>点</p>

            <div className="screen-actions">
                <button className="primary-button" type="button" onClick={onRestart}>
                    もう一度遊ぶ
                </button>

                <button type="button" onClick={onTitle}>
                    タイトルに戻る
                </button>
            </div>
        </main>
    );
}   
