import type { ChangeEvent, ReactElement } from "react";
import { useState, useEffect } from "react";
import type { Enemy } from "../game/types.ts";
import { createEnemy } from "../game/EnemyManager.ts";
import { relativeAngle, isInCaptureRange,captureTimeMs, updateCapture} from "../game/capture.ts";


// ゲーム画面
export default function GameScreen(): ReactElement {
    const [playerYaw, setPlayerYaw] = useState<number>(0);
    const [enemy, setEnemy] = useState<Enemy>(
        (): Enemy => createEnemy(90, 2, "enemy-1")
    );
    const relAngle: number = relativeAngle(enemy.worldYaw, playerYaw);
    const inRange: boolean = isInCaptureRange(relAngle);
    function changePlayerYaw(event:ChangeEvent<HTMLInputElement>): void {
        setPlayerYaw(Number(event.currentTarget.value));
    }
    useEffect((): (() => void) => {
        let frameId: number = 0;
        let prevMs: number = performance.now();

        function tick(nowMs: number): void {
            const dtMs: number = nowMs - prevMs;
            prevMs = nowMs;

            setEnemy((prev: Enemy): Enemy => {
                return {
                    ...prev,
                    capture: updateCapture(prev.capture, relAngle, dtMs)
                };
            });

            frameId = requestAnimationFrame(tick);
        }

        frameId = requestAnimationFrame(tick);

        return (): void => {
            cancelAnimationFrame(frameId);
        };
    }, [relAngle]);
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

            <p>
                {inRange ? "捕捉範囲内" : "捕捉範囲外"}
            </p>

            <progress
                aria-label="ロックオンゲージ"
                value={enemy.capture.progressMs}
                max={captureTimeMs}
            />

            <a href="?page=audio">
                音響テスト画面に戻る
            </a>
        </main>
    );
}