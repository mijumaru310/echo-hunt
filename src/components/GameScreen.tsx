import type { ChangeEvent, ReactElement } from "react";
import { useState, useEffect, useRef } from "react";
import type { Enemy, EnemyMode } from "../game/types.ts";
import { relativeAngle, isInCaptureRange,captureTimeMs, updateCapture, tryCapture } from "../game/capture.ts";
import type { CaptureState } from "../game/capture.ts";
import { createEnemyForMode, updateEnemyPosition } from "../game/EnemyManager.ts";
import { SpatialAudio } from "../audio/SpatialAudioEngine.ts";
import { OrientationController } from "../sensors/OrientationController.ts";
import type { OrientationData } from "../sensors/OrientationController.ts";
import { isDebug } from "../game/config.ts";

interface GameScreenProps {
    onFinish: (score: number) => void;    
    enemyMode: EnemyMode;
}

type InputStatus = "pc" | "permission" | "waiting" | "sensor";
type AudioStatus = "idle" | "loading" | "ready" | "error";
const gameTimeMs: number = 60000;
const sensorWaitMs: number = 5000;
// ゲーム画面
export default function GameScreen({ onFinish, enemyMode }: GameScreenProps): ReactElement {
    const [playerYaw, setPlayerYaw] = useState<number>(0);
    const [inputStatus, setInputStatus] = useState<InputStatus>("pc");
    const [score, setScore] = useState<number>(0);
    const [remainingMs, setRemainingMs] = useState<number>(gameTimeMs);
    const [hasStarted, setHasStarted] = useState<boolean>(false);
    const [audioStatus, setAudioStatus] = useState<AudioStatus>("idle");
    const [captureNotice, setCaptureNotice] = useState<number>(0);
    const endTimeMs = useRef<number>(0);
    const [enemy, setEnemy] = useState<Enemy>(
        (): Enemy => createEnemyForMode(enemyMode, "enemy-1")
    );
    const enemySeq = useRef<number>(1);
    const audioRef = useRef<SpatialAudio | null>(null);
    const audioStatusRef = useRef<AudioStatus>("idle");
    const sensorRef = useRef<OrientationController | null>(null);
    const playerYawRef = useRef<number>(playerYaw);
    const relAngle: number = relativeAngle(enemy.worldYaw, playerYaw);
    const relAngleRef = useRef<number>(relAngle);
    const inRange: boolean = isInCaptureRange(relAngle);
    const isFinished: boolean = remainingMs <= 0;
    const isInputReady: boolean = inputStatus === "sensor" || (isDebug && inputStatus === "pc");
    const isReady: boolean = audioStatus === "ready" && isInputReady;
    const canStart: boolean = !hasStarted && isReady;
    const canCapture: boolean = hasStarted && !isFinished && isReady && inRange
        && enemy.capture.progressMs >= captureTimeMs && !enemy.capture.isCaptured;
    const lockOnPercent: number = Math.round(enemy.capture.progressMs / captureTimeMs * 100);
    let inputLabel: string = isDebug ? "PC入力" : "センサー未接続";

    if (inputStatus === "permission") {
        inputLabel = "センサーの許可確認中";
    } else if (inputStatus === "waiting") {
        inputLabel = "センサー受信待ち";
    } else if (inputStatus === "sensor") {
        inputLabel = "センサー入力";
    }

    let gameMessage: string = "音声と入力を準備してください。";
    if (isFinished) {
        gameMessage = "終了！";
    } else if (audioStatus === "error") {
        gameMessage = "音声を再生できませんでした。音声を再生し直してください。";
    } else if (audioStatus === "loading") {
        gameMessage = "音声を準備しています。";
    } else if (!hasStarted && canStart) {
        gameMessage = "準備完了！ゲーム開始を押してください。";
    } else if (hasStarted && !isInputReady) {
        gameMessage = "方向入力の準備を待っています。";
    } else if (canCapture) {
        gameMessage = "ロックオン完了！タップで捕獲。";
    } else if (hasStarted && inRange) {
        gameMessage = "その向きを保ってロックオン。";
    } else if (hasStarted) {
        gameMessage = "音の方向を探してください。";
    }

    // 更新ループからも最新の再生状態を読めるよう、参照と画面の状態を同時に更新する。
    function updateAudioStatus(status: AudioStatus): void {
        audioStatusRef.current = status;
        setAudioStatus(status);
    }

    function isReadyNow(): boolean {
        const sensor: OrientationController | null = sensorRef.current;
        return audioRef.current !== null && audioStatusRef.current === "ready"
            && (sensor !== null ? sensor.getData() !== null : isDebug);
    }

    function beginGame(): void {
        if (!canStart || endTimeMs.current !== 0) {
            return;
        }

        endTimeMs.current = performance.now() + gameTimeMs;
        setHasStarted(true);
    }

    function changePlayerYaw(event: ChangeEvent<HTMLInputElement>): void {
        const sensor: OrientationController | null = sensorRef.current;
        sensorRef.current = null;
        sensor?.dispose();
        setInputStatus("pc");
        setPlayerYaw(Number(event.currentTarget.value));
    }

    async function startSensor(): Promise<void> {
        if (sensorRef.current !== null) {
            return;
        }

        const sensor: OrientationController = new OrientationController();
        sensorRef.current = sensor;
        setInputStatus("permission");
        sensor.subscribe((data: OrientationData): void => {
            if (sensorRef.current === sensor) {
                setInputStatus("sensor");
                setPlayerYaw(data.yaw);
            }
        });

        try {
            await sensor.start();

            if (sensorRef.current !== sensor) {
                sensor.dispose();
                return;
            }

            if (sensor.getData() === null) {
                setInputStatus("waiting");
            }
        } catch (error: unknown) {
            sensor.dispose();

            if (sensorRef.current === sensor) {
                sensorRef.current = null;
                setInputStatus("pc");
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

        updateAudioStatus("loading");
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
            updateAudioStatus("ready");
            
        } catch (error: unknown) {
            console.error(error);
            if (audioRef.current === audio && enemySeq.current === requestSeq) {
                updateAudioStatus("error");
            }
        }
    }
    function captureEnemy(): void {
        if(!hasStarted){
            return;
        }

        if (performance.now() >= endTimeMs.current) {
            setRemainingMs(0);
            return;
        }

        if (!canCapture || !isReadyNow()) {
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
        setCaptureNotice(enemySeq.current);
        audioRef.current?.stopEnemy(enemy.id);

        enemySeq.current +=1;

        const nextEnemy: Enemy = createEnemyForMode(
            enemyMode,
            `enemy-${enemySeq.current}`
        );
        relAngleRef.current = relativeAngle(nextEnemy.worldYaw, playerYaw);

        setEnemy(nextEnemy);
        setScore((prev: number): number => prev + 100);

        if (audioRef.current !== null) {
            void startAudio(nextEnemy);
        }
    }
    useEffect((): void | (() => void) => {
        if(!hasStarted){
            return;
        }

        let frameId: number = 0;
        let prevMs: number = performance.now();

        function tick(nowMs: number): void {
            if (performance.now() >= endTimeMs.current) {
                setRemainingMs(0);
                return;
            }

            const dtMs: number = nowMs - prevMs;
            prevMs = nowMs;

            if (isReadyNow()) {
                const currentPlayerYaw: number = playerYawRef.current;

                setEnemy((prev: Enemy): Enemy => {
                    const movedEnemy: Enemy = updateEnemyPosition(prev, dtMs);
                    const currentRelAngle: number = relativeAngle(
                        movedEnemy.worldYaw,
                        currentPlayerYaw
                    );

                    return {
                        ...movedEnemy,
                        capture: updateCapture(movedEnemy.capture, currentRelAngle, dtMs)
                    };
                });
            }

            frameId = requestAnimationFrame(tick);
        }

        frameId = requestAnimationFrame(tick);

        return (): void => {
            cancelAnimationFrame(frameId);
        };
    }, [hasStarted]);

    useEffect((): void | (() => void) => {
        if (!hasStarted) {
            return;
        }

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
    }, [hasStarted]);
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
            audioStatusRef.current = "idle";

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
    useEffect((): void | (() => void) => {
        if (inputStatus !== "waiting") {
            return;
        }

        const sensor: OrientationController | null = sensorRef.current;

        if (sensor === null || sensor.getData() !== null) {
            return;
        }

        const timerId: number = window.setTimeout((): void => {
            if (
                sensorRef.current !== sensor ||
                sensor.getData() !== null
            ) {
                return;
            }

            sensorRef.current = null;
            sensor.dispose();
            setInputStatus("pc");
            window.alert("センサー値が届きませんでした。もう一度センサー開始を押してください。");
        }, sensorWaitMs);

        return (): void => {
            window.clearTimeout(timerId);
        };
    }, [inputStatus]);
    useEffect((): void | (() => void) => {
        if (captureNotice === 0) {
            return;
        }

        const timerId: number = window.setTimeout((): void => {
            setCaptureNotice(0);
        }, 900);

        return (): void => {
            window.clearTimeout(timerId);
        };
    }, [captureNotice]);

    return (
        <main className="echo-game">
            <header className="game-heading">
                <h1>ECHO HUNT</h1>
                <h2>ゲーム画面</h2>
                <p className="screen-note">敵の種類：{enemyMode === "moving" ? "動く敵" : "静止する敵"}</p>
            </header>

            {(!hasStarted || isDebug || audioStatus === "error") && (
                <section className="preparation-panel" aria-label="プレイ準備">
                    <div className="preparation-actions">
                        <button
                            type="button"
                            onClick={(): void => { void startAudio(enemy); }}
                            disabled={isFinished || audioStatus === "loading"}
                        >
                            音声を再生
                        </button>
                        <button
                            type="button"
                            onClick={(): void => { void startSensor(); }}
                            disabled={isFinished || inputStatus !== "pc"}
                        >
                            センサー開始
                        </button>
                        <button className="primary-button game-start" type="button" onClick={beginGame} disabled={!canStart}>
                            ゲーム開始
                        </button>
                    </div>
                    <p className="screen-note">入力：{inputLabel}</p>
                    {!hasStarted && (
                        <p className="screen-note">
                            {isDebug
                                ? "音声を再生すると、PCの方向スライダーで開始できます。"
                                : "センサーを許可し、音声を再生してから開始してください。"}
                        </p>
                    )}
                </section>
            )}

            <div className="game-stats">
                <p>スコア：<strong>{score}</strong>点</p>
                <p className={hasStarted && remainingMs <= 10000 ? "time-warning" : ""}>
                    残り時間：<strong>{Math.ceil(remainingMs / 1000)}</strong>秒
                </p>
            </div>

            <section className={canCapture ? "lockon-panel is-locked" : "lockon-panel"} aria-label="ロックオン">
                <div className="lockon-heading">
                    <span>ロックオン</span>
                    <strong>{lockOnPercent}%</strong>
                </div>
                <progress aria-label="ロックオンゲージ" value={enemy.capture.progressMs} max={captureTimeMs} />
            </section>

            <div className="capture-feedback-slot" role="status" aria-live="polite" aria-atomic="true">
                {captureNotice !== 0 && (
                    <div key={captureNotice} className="capture-feedback">
                        捕獲成功！ <strong>+100点</strong>
                    </div>
                )}
            </div>

            <button
                className={canCapture ? "capture-button is-ready" : "capture-button"}
                type="button"
                onClick={captureEnemy}
                disabled={!canCapture}
            >
                捕獲
            </button>
            <p className="game-status">{gameMessage}</p>

            {isDebug && (
                <section className="debug-panel" aria-label="PC確認用">
                    <p>開発用：{enemy.id} ／ 敵の方向：{enemy.worldYaw.toFixed(1)}° ／ 移動速度：{enemy.angularVelocity}°/秒</p>
                    <label htmlFor="player-yaw">開発用のプレイヤー方向：{playerYaw}°</label>
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
                    <p>{inRange ? "捕捉範囲内" : "捕捉範囲外"}</p>
                    <a href="?page=audio">音響テスト画面に戻る</a>
                </section>
            )}
        </main>
    );
}
