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
        <main>
            <h1>Echo Hunt</h1>

            <p>敵の方向を向き、ゲージが満タンになったら捕獲！</p>
            <p>制限時間は60秒です。</p>

            <p>
                <label htmlFor="enemy-mode">敵の種類：</label>
                <select id="enemy-mode" value={enemyMode} onChange={changeEnemyMode}>
                    <option value="stationary">静止する敵</option>
                    <option value="moving">動く敵</option>
                </select>
            </p>

            <button type="button" onClick={(): void => { onStart(enemyMode); }}>
                プレイ準備へ
            </button>

           {isDebug && (
                <p>
                    <a href="?page=audio">音響テスト画面</a>
                </p>
            )}
        </main>
    );
}
