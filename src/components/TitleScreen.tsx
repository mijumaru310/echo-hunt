import type { ChangeEvent, ReactElement } from "react";
import { useState } from "react";
import type { EnemyMode } from "../game/types.ts";
import { isDebug } from "../game/config.ts";

interface TitleScreenProps {
    onStart: (enemyMode: EnemyMode) => void;
}

export default function TitleScreen({ onStart }: TitleScreenProps): ReactElement {
    const [enemyMode, setEnemyMode] = useState<EnemyMode>("stationary");

    function changeEnemyMode(event: ChangeEvent<HTMLSelectElement>): void {
        const nextMode: string = event.currentTarget.value;

        if (nextMode === "stationary" || nextMode === "moving") {
            setEnemyMode(nextMode);
        }
    }

    return (
        <main className="echo-game echo-title">
            <h1>ECHO HUNT</h1>

            <p className="screen-note">音を頼りに敵を探し、ゲージが満タンになったら捕獲！</p>
            <p className="screen-note">イヤホンを着けて、60秒のハントに挑もう。</p>

            <div className="mode-selector">
                <label htmlFor="enemy-mode">敵の種類：</label>
                <select id="enemy-mode" value={enemyMode} onChange={changeEnemyMode}>
                    <option value="stationary">静止する敵</option>
                    <option value="moving">動く敵</option>
                </select>
            </div>

            <p className="mode-description">
                {enemyMode === "moving"
                    ? "敵はゆっくり移動します。音の動きを追いかけてください。"
                    : "敵はその場で音を出します。初めての方はこちら。"}
            </p>

            <button className="primary-button full-width" type="button" onClick={(): void => { onStart(enemyMode); }}>
                プレイ準備へ
            </button>

           {isDebug && (
                <p className="debug-link">
                    <a href="?page=audio">音響テスト画面</a>
                </p>
            )}
        </main>
    );
}
