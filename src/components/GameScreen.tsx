import type { ReactElement } from "react";

// B担当のゲーム画面
export default function GameScreen(): ReactElement {
    return (
        <main>
            <h1>ECHO HUNT</h1>
            <h2>ゲーム画面</h2>

            <p>ここに捕捉ゲージと長押しボタンを追加します。</p>

            <a href="?page=audio">
                音響テスト画面に戻る
            </a>
        </main>
    );
}