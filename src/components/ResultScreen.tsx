import type { ReactElement } from "react";

interface ResultScreenProps {
    score: number;
    onRestart: () => void;
    onTitle: () => void;
}

export default function ResultScreen({ score, onRestart, onTitle }: ResultScreenProps): ReactElement {
    return (
        <main>
            <h1>ECHO HUNT</h1>
            <h2>結果</h2>

            <p>スコア：{score}点</p>

            <button type="button" onClick={onRestart}>
                もう一度遊ぶ
            </button>

            <button type="button" onClick={onTitle}>
                タイトルに戻る
            </button>
        </main>
    );
}   