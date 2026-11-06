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
        <main className="echo-game echo-result mansion-menu" aria-label="ゲーム結果">
            <div className="menu-controls">
                <h1>{reason === "caught" ? "敵に追いつかれた" : "時間終了"}</h1>
                <p className="result-score">スコア <strong>{score}</strong> 点</p>

                <div className="screen-actions">
                    <button className="menu-primary" type="button" onClick={onRestart}>
                        もう一度遊ぶ
                    </button>

                    <button className="menu-secondary" type="button" onClick={onTitle}>
                        タイトルに戻る
                    </button>
                </div>
            </div>
        </main>
    );
}   
