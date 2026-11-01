import type { ChangeEvent, ReactElement } from "react";
import { useState, useEffect, useRef } from "react";
import type { Enemy } from "../game/types.ts";
import { relativeAngle, isInCaptureRange,captureTimeMs, updateCapture, tryCapture } from "../game/capture.ts";
import type { CaptureState } from "../game/capture.ts";
import { createRandomEnemy } from "../game/EnemyManager.ts";


const gameTimeMs: number = 60000;
// ゲーム画面
export default function GameScreen(): ReactElement {
    const [playerYaw, setPlayerYaw] = useState<number>(0);
    const [score, setScore] = useState<number>(0);
    const [remainingMs, setRemainingMs] = useState<number>(gameTimeMs);
    const endTimeMs = useRef<number>(0);
    const [enemy, setEnemy] = useState<Enemy>(
        (): Enemy => createRandomEnemy(2, "enemy-1")
    );
    const enemySeq = useRef<number>(1);
    const relAngle: number = relativeAngle(enemy.worldYaw, playerYaw);
    const inRange: boolean = isInCaptureRange(relAngle);
    const isFinished: boolean = remainingMs <= 0;
    function changePlayerYaw(event:ChangeEvent<HTMLInputElement>): void {
        setPlayerYaw(Number(event.currentTarget.value));
    }
    function captureEnemy(): void {
        if (performance.now() >= endTimeMs.current) {
            setRemainingMs(0);
            return;
        }

        const currentRelAngle: number = relativeAngle(
            enemy.worldYaw,
            playerYaw
        );

        const nextCapture: CaptureState = tryCapture(
            enemy.capture,
            currentRelAngle
        );

        if (enemy.capture.isCaptured || !nextCapture.isCaptured) {
            return;
        }

        enemySeq.current +=1;

        const nextEnemy: Enemy = createRandomEnemy(
            2,
            `enemy-${enemySeq.current}`
        );
        setEnemy(nextEnemy);
        setScore((prev: number): number => prev + 100);
    }
    useEffect((): (() => void) => {
        let frameId: number = 0;
        let prevMs: number = performance.now();

        function tick(nowMs: number): void {
            if (performance.now() >= endTimeMs.current) {
                setRemainingMs(0);
                return;
            }

            const dtMs: number = nowMs - prevMs;
            prevMs = nowMs;

            setEnemy((prev: Enemy): Enemy => {
                const currentRelAngle: number = relativeAngle(
                    prev.worldYaw,
                    playerYaw
                );
                
                return {
                    ...prev,
                    capture: updateCapture(prev.capture, currentRelAngle, dtMs)
                };
            });

            frameId = requestAnimationFrame(tick);
        }

        frameId = requestAnimationFrame(tick);

        return (): void => {
            cancelAnimationFrame(frameId);
        };
    }, [playerYaw]);

    useEffect((): (() => void) => {
        endTimeMs.current = performance.now() + gameTimeMs;

        const timerId: number = window.setInterval((): void => {
            const nextRemainingMs: number = Math.max(
                0,
                endTimeMs.current - performance.now()
            );
            setRemainingMs(nextRemainingMs);

            if (nextRemainingMs === 0) {
                window.clearInterval(timerId);
            }
        }, 100);

        return (): void => {
            window.clearInterval(timerId);
        };
    }, []);
    return (
        <main>
            <h1>ECHO HUNT</h1>
            <h2>ゲーム画面</h2>
            <p>スコア：{score}点</p>

            <p>残り時間：{Math.ceil(remainingMs / 1000)}秒</p>

            <p>
                開発用：{enemy.id} ／ 敵の方向：
                {enemy.worldYaw.toFixed(1)}°
            </p>
            
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
                disabled={isFinished}
            />

            <p>
                {inRange ? "捕捉範囲内" : "捕捉範囲外"}
            </p>

            <progress
                aria-label="ロックオンゲージ"
                value={enemy.capture.progressMs}
                max={captureTimeMs}
            />

            <button
                type="button"
                onClick={captureEnemy}
                disabled={isFinished || enemy.capture.isCaptured || !inRange}
            >
                捕獲
            </button>

            <p>
                {isFinished ? "終了！" : "敵を探してください"}
            </p>

            <a href="?page=audio">
                音響テスト画面に戻る
            </a>
        </main>
    );
}