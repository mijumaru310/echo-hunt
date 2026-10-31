import type { ChangeEvent, ReactElement } from "react";
import { useState } from "react";

// ゲーム画面
export default function GameScreen(): ReactElement {
    const [playerYaw, setPlayerYaw] = useState<number>(0);
        function changePlayerYaw(event: ChangeEvent<HTMLInputElement>):
    void {
        setPlayerYaw(Number(event.currentTarget.value));
    }
    return (
        <main>
            <h1>ECHO HUNT</h1>
            <h2>ゲーム画面</h2>

            <label htmlFor="player-yaw">
                開発用のプレイヤー方向：{playerYaw}°
            </label>

            <input
                id="player-yaw"
                type="range"
                min={-180}
                max={180}
                step={1}
                value={playerYaw}
                onChange={changePlayerYaw}
            />

            <a href="?page=audio">
                音響テスト画面に戻る
            </a>
        </main>
    );
}