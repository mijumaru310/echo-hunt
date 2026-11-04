import type { ChangeEvent, ReactElement } from "react";
import { useState, useEffect, useRef } from "react";
import type { Enemy } from "../game/types.ts";
import { relativeAngle, isInCaptureRange,captureTimeMs, updateCapture, tryCapture } from "../game/capture.ts";
import type { CaptureState } from "../game/capture.ts";
import { createRandomEnemy } from "../game/EnemyManager.ts";
import { SpatialAudio } from "../audio/SpatialAudioEngine.ts";
import { OrientationController } from "../sensors/OrientationController.ts";
import type { OrientationData } from "../sensors/OrientationController.ts";

interface GameScreeenProps {
    onFinish: (score: number) => void;    
}

const gameTimeMs: number = 60000;
// ゲーム画面
export default function GameScreen({ onFinish }: GameScreeenProps): ReactElement {
    const [playerYaw, setPlayerYaw] = useState<number>(0);
    const [score, setScore] = useState<number>(0);
    const [remainingMs, setRemainingMs] = useState<number>(gameTimeMs);
    const endTimeMs = useRef<number>(0);
    const [enemy, setEnemy] = useState<Enemy>(
        (): Enemy => createRandomEnemy(2, "enemy-1")
    );
    const enemySeq = useRef<number>(1);
    const audioRef = useRef<SpatialAudio | null>(null);
    const sensorRef = useRef<OrientationController | null>(null);
    const playerYawRef = useRef<number>(playerYaw);
    const relAngle: number = relativeAngle(enemy.worldYaw, playerYaw);
    const relAngleRef = useRef<number>(relAngle);
    const inRange: boolean = isInCaptureRange(relAngle);
    const isFinished: boolean = remainingMs <= 0;

    function changePlayerYaw(event: ChangeEvent<HTMLInputElement>): void {
        const sensor: OrientationController | null = sensorRef.current;
        sensorRef.current = null;
        sensor?.dispose();

        setPlayerYaw(Number(event.currentTarget.value));
    }

    async function startSensor(): Promise<void> {
        if (sensorRef.current !== null) {
            return;
        }

        const sensor: OrientationController = new OrientationController();
        sensorRef.current = sensor;

        sensor.subscribe((data: OrientationData): void => {
            if (sensorRef.current === sensor) {
                setPlayerYaw(data.yaw);
            }
        });

        try {
            await sensor.start();

            if (sensorRef.current !== sensor) {
                sensor.dispose();
            }
        } catch (error: unknown) {
            sensor.dispose();

            if (sensorRef.current === sensor) {
                sensorRef.current = null;
                console.error(error);
                window.alert("センサーを開始できませんでした。");
            }
        }
    }

    async function startAudio(targetEnemy: Enemy): Promise<void> {
        let audio: SpatialAudio | null = audioRef.current;

        if (audio === null) {
            audio = new SpatialAudio();
            audioRef.current = audio;
        }

        const requestSeq: number = enemySeq.current;

        try {
            await audio.playEnemy(targetEnemy.id,"/sounds/footstep.wav",{
                azimuthDeg: relativeAngle(targetEnemy.worldYaw, playerYaw),
                elevationDeg: 0,
                distance: targetEnemy.distance,
            });

            if (
                audioRef.current !== audio ||
                enemySeq.current !== requestSeq
            ) {
                audio.stopEnemy(targetEnemy.id);
                return;
            }

            audio.setEnemyPosition(
                targetEnemy.id,
                relAngleRef.current,
                0,
                targetEnemy.distance
            );
        } catch (error: unknown) {
            console.error(error);
            if(audioRef.current === audio){
            window.alert("音声の再生に失敗しました。");
            }
        }
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
        audioRef.current?.stopEnemy(enemy.id);

        enemySeq.current +=1;

        const nextEnemy: Enemy = createRandomEnemy(
            2,
            `enemy-${enemySeq.current}`
        );
        relAngleRef.current = relativeAngle(nextEnemy.worldYaw, playerYaw);

        setEnemy(nextEnemy);
        setScore((prev: number): number => prev + 100);

        if (audioRef.current !== null) {
            void startAudio(nextEnemy);
        }
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

            const currentPlayerYaw: number = playerYawRef.current;

            setEnemy((prev: Enemy): Enemy => {
                const currentRelAngle: number = relativeAngle(
                    prev.worldYaw,
                    currentPlayerYaw
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
    }, []);

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
    useEffect((): void => {
        if (isFinished) {
            onFinish(score);
        }
    }, [isFinished, score , onFinish]);
        useEffect((): (() => void) => {
        return (): void => {
            const sensor: OrientationController | null = sensorRef.current;
            sensorRef.current = null;
            sensor?.dispose();
            const audio: SpatialAudio | null = audioRef.current;
            audioRef.current = null;

            if (audio !== null) {
                void audio.dispose().catch((error: unknown): void => {
                    console.error(error);
                });
            }
        };
    }, []);
    useEffect((): void => {
        playerYawRef.current = playerYaw;
        relAngleRef.current = relAngle;

        audioRef.current?.setEnemyPosition(
            enemy.id,
            relAngle,
            0,
            enemy.distance
        );
    }, [enemy.id, enemy.distance, playerYaw, relAngle]);
    return (
        <main>
            <h1>ECHO HUNT</h1>
            <h2>ゲーム画面</h2>
            <button type="button"
            onClick={(): void => {
                void startAudio(enemy);
            }}
            disabled={isFinished}
            >   
                音声を再生
            </button>

            <button
                type="button"
                onClick={(): void => {
                    void startSensor();
                }}
                disabled={isFinished}
            >
                センサー開始
            </button>

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