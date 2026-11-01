import type {ReactElement} from "react";

interface TitleScreenProps {
    onStart: () => void;
}

export default function TitleScreen({ onStart }: TitleScreenProps): ReactElement {
    return (
        <main>
            <h1>Echo Hunt</h1>

            <p>敵の方向を向き、ゲージが満タンになったら捕獲！</p>
            <p>制限時間は60秒です。</p>

            <button type="button" onClick={onStart}>
                ゲーム開始
            </button>

            <p>
                <a href="?page=audio">音響テスト画面</a>
            </p>
        </main>
    );
}