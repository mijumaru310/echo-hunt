import type { ChangeEvent, ReactElement } from "react";
import { useState } from "react";
import type { EnemyMode } from "../game/types.ts";
import { isDebug } from "../game/config.ts";
import { approachTimeMs, enemyModeLabels } from "../game/EnemyManager.ts";

interface TitleScreenProps {
    onStart: (enemyMode: EnemyMode) => void;
}

export default function TitleScreen({ onStart }: TitleScreenProps): ReactElement {
    const [enemyMode, setEnemyMode] = useState<EnemyMode>("stationary");

    function changeEnemyMode(event: ChangeEvent<HTMLSelectElement>): void {
        const nextMode: string = event.currentTarget.value;

        if (nextMode === "stationary" || nextMode === "moving" || nextMode === "approaching") {
            setEnemyMode(nextMode);
        }
    }

    return (
        <main className="echo-game echo-title mansion-menu">
            <h1 className="haunt-wordmark" aria-label="ECHO HUNT">
                <span>ECHO</span> <span>HUNT</span>
            </h1>

            <div className="menu-controls">
                <p className="screen-note">足音のする方を向いて、ピッと鳴ったら{isDebug ? "「捕獲する」を" : "画面を"}タップ。</p>

                <div className="mode-selector">
                    <label htmlFor="enemy-mode">敵の種類</label>
                    <select id="enemy-mode" value={enemyMode} onChange={changeEnemyMode} aria-describedby="mode-description">
                        <option value="stationary">{enemyModeLabels.stationary}</option>
                        <option value="moving">{enemyModeLabels.moving}</option>
                        <option value="approaching">{enemyModeLabels.approaching}</option>
                    </select>
                </div>

                <p className="mode-description" id="mode-description">
                    {enemyMode === "stationary" && "制限時間は60秒。敵は同じ場所で足音を立てます。"}
                    {enemyMode === "moving" && "制限時間は60秒。敵はあなたの周りをゆっくり移動します。"}
                    {enemyMode === "approaching" && `敵は約${approachTimeMs / 1000}秒で追いつきます。心音が聞こえたら、あと5秒です。`}
                </p>

                <button className="menu-primary" type="button" onClick={(): void => { onStart(enemyMode); }}>
                    プレイ準備へ
                </button>

                {isDebug && (
                    <p className="debug-link">
                        <a href="?page=audio">音響テスト画面</a>
                    </p>
                )}
            </div>
        </main>
    );
}
