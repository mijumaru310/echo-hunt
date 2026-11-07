import type { ChangeEvent, ReactElement } from "react";
import { useState, useEffect, useRef, useEffectEvent } from "react";
import type { Enemy, EnemyMode, FinishReason } from "../game/types.ts";
import { relativeAngle, isInCaptureRange,captureTimeMs, updateCapture, tryCapture } from "../game/capture.ts";
import type { CaptureState } from "../game/capture.ts";
import { createEnemyForMode, updateEnemyPosition, recenterEnemy, contactDistance, timeToContactMs } from "../game/EnemyManager.ts";
import { SpatialAudio } from "../audio/SpatialAudioEngine.ts";
import { OrientationController } from "../sensors/OrientationController.ts";
import type { OrientationData } from "../sensors/OrientationController.ts";
import { isDebug } from "../game/config.ts";
import lockReadySound from "../assets/lock-ready.wav?inline";
import heartbeatSound from "../assets/heartbeat.wav?inline";

interface GameScreenProps {
    onFinish: (score: number, reason: FinishReason) => void;
    enemyMode: EnemyMode;
}

type InputStatus = "pc" | "permission" | "waiting" | "sensor";
type AudioStatus = "idle" | "loading" | "ready" | "error";
const gameTimeMs: number = 60000;
const sensorWaitMs: number = 5000;
const enemySoundUrl: string = "/sounds/footstep.wav";

function sensorStartMessage(error: unknown): string {
    if (!window.isSecureContext) {
        return "センサーを使うには、HTTPSのゲームURLを開いてください。";
    }
    if (!("DeviceOrientationEvent" in window)) {
        return "このブラウザは方向センサーに対応していません。スマホの対応ブラウザで開いてください。";
    }
    if (error instanceof Error && (error.name === "NotAllowedError"
        || error.message === "センサーの利用が許可されませんでした")) {
        return "センサーの利用が許可されていません。ブラウザのセンサー利用設定を確認して、「センサー開始」を押してください。";
    }
    return "センサーを開始できませんでした。「センサー開始」を押して再試行してください。";
}

// ゲーム画面
export default function GameScreen({ onFinish, enemyMode }: GameScreenProps): ReactElement {
    const [playerYaw, setPlayerYaw] = useState<number>(0);
    const [roomOriginYaw, setRoomOriginYaw] = useState<number>(0);
    const [inputStatus, setInputStatus] = useState<InputStatus>("pc");
    const [sensorError, setSensorError] = useState<string>("");
    const [score, setScore] = useState<number>(0);
    const [remainingMs, setRemainingMs] = useState<number>(gameTimeMs);
    const [hasStarted, setHasStarted] = useState<boolean>(false);
    const [isPaused, setIsPaused] = useState<boolean>(false);
    const pausedRef = useRef<boolean>(false);
    const pausedRemainingMs = useRef<number>(gameTimeMs);
    const [recenterMessage, setRecenterMessage] = useState<string>("");
    const [audioStatus, setAudioStatus] = useState<AudioStatus>("idle");
    const [captureNotice, setCaptureNotice] = useState<number>(0);
    const endTimeMs = useRef<number>(0);
    const [enemy, setEnemy] = useState<Enemy>(
        (): Enemy => createEnemyForMode(enemyMode, "enemy-1")
    );
    const enemySeq = useRef<number>(1);
    const audioRef = useRef<SpatialAudio | null>(null);
    const cueSequence = useRef<number>(0);
    const audioStatusRef = useRef<AudioStatus>("idle");
    const sensorRef = useRef<OrientationController | null>(null);
    const playerYawRef = useRef<number>(playerYaw);
    const relAngle: number = relativeAngle(enemy.worldYaw, playerYaw);
    const relAngleRef = useRef<number>(relAngle);
    const inRange: boolean = isInCaptureRange(relAngle);
    const caught: boolean = enemyMode === "approaching" && enemy.distance <= contactDistance;
    const isFinished: boolean = remainingMs <= 0 || caught;
    const isInputReady: boolean = inputStatus === "sensor" || (isDebug && inputStatus === "pc");
    const isReady: boolean = audioStatus === "ready" && isInputReady;
    const canStart: boolean = !hasStarted && isReady;
    const contactMs: number = timeToContactMs(enemy.distance);
    let heartbeatIntervalMs: number = 0;
    if (enemyMode === "approaching" && hasStarted && isReady && !isPaused && !isFinished && contactMs <= 5000) {
        heartbeatIntervalMs = contactMs <= 2000 ? 480 : 900;
    }
    const canCapture: boolean = hasStarted && !isPaused && !isFinished && isReady && inRange
        && enemy.capture.progressMs >= captureTimeMs && !enemy.capture.isCaptured;
    const lockOnPercent: number = Math.round(enemy.capture.progressMs / captureTimeMs * 100);
    const captureLabel: string = canCapture ? "捕獲する" : hasStarted && !isPaused && isReady ? "探索中" : "捕獲";
    let inputLabel: string = isDebug ? "PC入力" : "センサー未接続";

    if (inputStatus === "permission") {
        inputLabel = "センサーの許可確認中";
    } else if (inputStatus === "waiting") {
        inputLabel = "センサー受信待ち";
    } else if (inputStatus === "sensor") {
        inputLabel = "センサー入力";
    }

    let gameMessage: string = "";
    if (isFinished) {
        gameMessage = "終了！";
    } else if (isPaused) {
        gameMessage = audioStatus === "error"
            ? "音声を再生できませんでした。再開を押してやり直してください。"
            : audioStatus === "loading"
                ? "再開のために音声を準備しています。"
                : "";
    } else if (audioStatus === "error") {
        gameMessage = "音声を再生できませんでした。音声を再生し直してください。";
    } else if (audioStatus === "loading") {
        gameMessage = "音声を準備しています。";
    } else if (hasStarted && !isInputReady) {
        gameMessage = "方向入力の準備を待っています。";
    }

    // 更新ループからも最新の再生状態を読めるよう、参照と画面の状態を同時に更新する。
    function updateAudioStatus(status: AudioStatus): void {
        audioStatusRef.current = status;
        setAudioStatus(status);
    }

    function isInputReadyNow(): boolean {
        const sensor: OrientationController | null = sensorRef.current;
        return sensor !== null ? sensor.getData() !== null : isDebug;
    }

    function isReadyNow(): boolean {
        return !pausedRef.current && audioRef.current !== null
            && audioStatusRef.current === "ready" && isInputReadyNow();
    }

    function beginGame(): void {
        if (!canStart || !isReadyNow() || endTimeMs.current !== 0 || document.hidden) {
            return;
        }

        if (!recenterPlayer()) {
            return;
        }
        endTimeMs.current = performance.now() + gameTimeMs;
        setHasStarted(true);
    }

    // 音声の読み込み中でも取り消せるよう、停止時に再生エンジンを切り離す。
    function releaseAudio(): void {
        const audio: SpatialAudio | null = audioRef.current;
        audioRef.current = null;
        updateAudioStatus("idle");
        if (audio !== null) {
            audio.stopEnemy(enemy.id);
            void audio.dispose().catch((error: unknown): void => {
                console.error(error);
            });
        }
    }

    function pauseGame(): void {
        if (hasStarted && !pausedRef.current) {
            const nextRemainingMs: number = Math.max(0, endTimeMs.current - performance.now());
            if (nextRemainingMs === 0) {
                setRemainingMs(0);
                releaseAudio();
                return;
            }
            // 時間表示の更新間隔に依存せず、停止ボタンを押した時点の残り時間を保存する。
            pausedRemainingMs.current = nextRemainingMs;
            setRemainingMs(nextRemainingMs);
            pausedRef.current = true;
            setIsPaused(true);
            setCaptureNotice(0);
            setRecenterMessage("");
        }
        releaseAudio();
    }

    async function resumeGame(): Promise<void> {
        if (!pausedRef.current || audioStatusRef.current === "loading"
            || document.hidden || !isInputReadyNow()) {
            return;
        }

        // 音が戻るまで停止を保ち、読み込み待ちの時間を制限時間から差し引かない。
        const audioReady: boolean = await startAudio(enemy);
        if (!audioReady || !pausedRef.current || document.hidden) {
            return;
        }
        endTimeMs.current = performance.now() + pausedRemainingMs.current;
        pausedRef.current = false;
        setIsPaused(false);
        setRecenterMessage("");
    }

    function recenterPlayer(): boolean {
        if ((hasStarted && !pausedRef.current) || audioStatusRef.current === "loading"
            || !isInputReadyNow()) {
            return false;
        }
        const sensor: OrientationController | null = sensorRef.current;
        const oldYaw: number = sensor !== null ? sensor.getYaw() : playerYawRef.current;
        if (sensor !== null && !sensor.recenter()) {
            setRecenterMessage("正面を設定できませんでした。スマホを少し動かして再度お試しください。");
            return false;
        }
        setEnemy((prev: Enemy): Enemy => recenterEnemy(prev, oldYaw));
        // 再校正で角度の原点だけが変わる。見ている壁はその場に保つ。
        if (pausedRef.current) {
            setRoomOriginYaw((origin: number): number => (origin + oldYaw) % 360);
        }
        playerYawRef.current = 0;
        setPlayerYaw(0);
        setRecenterMessage(pausedRef.current ? "今の向きを正面に設定しました。" : "");
        return true;
    }

    function changePlayerYaw(event: ChangeEvent<HTMLInputElement>): void {
        const sensor: OrientationController | null = sensorRef.current;
        if (!hasStarted && sensor !== null) {
            setRecenterMessage("");
        }
        sensorRef.current = null;
        sensor?.dispose();
        setInputStatus("pc");
        setSensorError("");
        setPlayerYaw(Number(event.currentTarget.value));
    }

    async function startSensor(): Promise<void> {
        if (sensorRef.current !== null) {
            return;
        }

        if (!hasStarted) {
            setRecenterMessage("");
        }
        const sensor: OrientationController = new OrientationController();
        sensorRef.current = sensor;
        setSensorError("");
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
                setSensorError(sensorStartMessage(error));
            }
        }
    }

    async function startAudio(targetEnemy: Enemy): Promise<boolean> {
        let audio: SpatialAudio | null = audioRef.current;

        if (audio === null) {
            audio = new SpatialAudio();
            audioRef.current = audio;
        }

        const requestSeq: number = enemySeq.current;

        updateAudioStatus("loading");
        try {
            await audio.playEnemy(targetEnemy.id, enemySoundUrl, {
                volume: 0.8, // 静かな足音を補正してから距離による減衰を適用する。
                azimuthDeg: relativeAngle(targetEnemy.worldYaw, playerYaw),
                elevationDeg: 0,
                distance: targetEnemy.distance,
            });

            if (
                audioRef.current !== audio ||
                enemySeq.current !== requestSeq
            ) {
                audio.stopEnemy(targetEnemy.id);
                return false;
            }

            audio.setEnemyPosition(
                targetEnemy.id,
                relAngleRef.current,
                0,
                targetEnemy.distance
            );
            updateAudioStatus("ready");
            return true;
            
        } catch (error: unknown) {
            if (audioRef.current === audio && enemySeq.current === requestSeq) {
                console.error(error);
                updateAudioStatus("error");
            }
            return false;
        }
    }
    function captureEnemy(): void {
        if(!hasStarted || pausedRef.current){
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
        if(!hasStarted || isPaused){
            return;
        }

        let frameId: number = 0;
        let prevMs: number = performance.now();

        function tick(nowMs: number): void {
            if (pausedRef.current) {
                return;
            }
            if (performance.now() >= endTimeMs.current) {
                setRemainingMs(0);
                return;
            }

            const dtMs: number = nowMs - prevMs;
            prevMs = nowMs;

            if (isReadyNow()) {
                const currentPlayerYaw: number = playerYawRef.current;

                setEnemy((prev: Enemy): Enemy => {
                    const movedEnemy: Enemy = updateEnemyPosition(prev, dtMs, enemyMode);
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
    }, [hasStarted, isPaused, enemyMode]);

    useEffect((): void | (() => void) => {
        if (!hasStarted || isPaused) {
            return;
        }

        const timerId: number = window.setInterval((): void => {
            if (pausedRef.current) {
                return;
            }
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
    }, [hasStarted, isPaused]);
    // 敵の方向を示す足音と区別できるよう、心音は常に左右の中央で鳴らす。
    useEffect((): void | (() => void) => {
        const audio: SpatialAudio | null = audioRef.current;
        if (!audio || heartbeatIntervalMs === 0) return;

        const id: string = `heartbeat-${++cueSequence.current}`;
        let stopped: boolean = false;
        let pending: boolean = false;
        async function beat(engine: SpatialAudio): Promise<void> {
            if (stopped || pending || pausedRef.current || audioRef.current !== engine) return;
            pending = true;
            try {
                await engine.playEnemy(id, heartbeatSound, {
                    loop: false, azimuthDeg: 0, distance: 1, volume: 0.28
                });
                if (stopped) engine.stopEnemy(id);
            } catch (error: unknown) {
                if (!stopped) console.warn("心音を再生できませんでした。", error);
            } finally {
                pending = false;
            }
        }
        void beat(audio);
        const timer: number = window.setInterval(() => { void beat(audio); }, heartbeatIntervalMs);
        return (): void => {
            stopped = true;
            window.clearInterval(timer);
            audio.stopEnemy(id);
        };
    }, [heartbeatIntervalMs, enemy.id]);

    // 捕獲可能になった瞬間だけ、足音とは別の音源で短く知らせる。
    useEffect((): void | (() => void) => {
        const audio: SpatialAudio | null = audioRef.current;
        if (!canCapture || !audio) return;

        const cueId: string = `lock-ready-${++cueSequence.current}`;
        let cancelled: boolean = false;
        void audio.playEnemy(cueId, lockReadySound, {
            loop: false, volume: 0.3, azimuthDeg: 0, distance: 1
        }).then((): void => {
            if (cancelled) audio.stopEnemy(cueId);
        }).catch((error: unknown): void => {
            if (!cancelled) console.warn("ロックオンの合図音を再生できませんでした。", error);
        });
        return (): void => {
            cancelled = true;
            audio.stopEnemy(cueId);
        };
    }, [canCapture, enemy.id]);

    // 非表示の通知では、最新の敵と開始状態を使って停止する。
    const pauseOnHide = useEffectEvent((): void => {
        pauseGame();
    });
    useEffect((): (() => void) => {
        function handleVisibility(): void {
            if (document.hidden) {
                pauseOnHide();
            }
        }
        function handlePageHide(): void {
            pauseOnHide();
        }
        document.addEventListener("visibilitychange", handleVisibility);
        window.addEventListener("pagehide", handlePageHide);
        return (): void => {
            document.removeEventListener("visibilitychange", handleVisibility);
            window.removeEventListener("pagehide", handlePageHide);
        };
    }, []);
    useEffect((): void => {
        if (isFinished) {
            onFinish(score, caught ? "caught" : "time");
        }
    }, [isFinished, score, onFinish, caught]);
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
            setSensorError("5秒間、向きのデータを受信できませんでした。「センサー開始」をもう一度押し、スマホを少し動かしてください。");
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

    const debugPanel = isDebug && (
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
            <section className={canCapture ? "lockon-panel is-locked" : "lockon-panel"} aria-label="ロックオン">
                <div className="lockon-heading">
                    <span>ロックオン</span>
                    <strong>{lockOnPercent}%</strong>
                </div>
                <progress aria-label="ロックオンゲージ" value={enemy.capture.progressMs} max={captureTimeMs} />
            </section>
            <p>{inRange ? "捕捉範囲内" : "捕捉範囲外"}</p>
            <a href="?page=audio">音響テスト画面に戻る</a>
        </section>
    );

    if (!hasStarted) {
        return (
            <main className="echo-game foyer" aria-label="プレイ準備">
                <div className="foyer-controls">
                    <header>
                        <p>イヤホンをつけて、足音を確かめてください。</p>
                    </header>
                    <div className="foyer-checks">
                        <button type="button" onClick={(): void => { void startAudio(enemy); }}
                            disabled={audioStatus === "loading"}>
                            <span>{audioStatus === "ready" ? "足音をもう一度聴く" : "足音を聴く"}</span>
                            <small aria-live="polite">{audioStatus === "ready" ? "再生中" : audioStatus === "loading" ? "読込中" : ""}</small>
                        </button>
                        {audioStatus === "error" && <p role="alert">音声を再生できませんでした。「足音を聴く」で再試行してください。</p>}
                        <button type="button" onClick={(): void => { void startSensor(); }} disabled={inputStatus !== "pc"}>
                            <span>センサー開始</span>
                            <small aria-live="polite">{inputLabel}</small>
                        </button>
                        {sensorError && <p role="alert">{sensorError}</p>}
                    </div>
                    <button className="foyer-enter" type="button" onClick={beginGame} disabled={!canStart}>
                        この向きを正面にして開始
                    </button>
                    {recenterMessage && <p role="alert">{recenterMessage}</p>}
                    {isDebug && <details className="foyer-debug"><summary>PCの方向を調整</summary>{debugPanel}</details>}
                </div>
            </main>
        );
    }

    return (
        <main className={isDebug ? "echo-game" : "echo-game ear-play"} data-playing={hasStarted} data-paused={isPaused} aria-label="ECHO HUNT">
            {hasStarted && (
                <div className="mansion-panorama" aria-hidden="true"
                    style={{ backgroundPositionX: `calc(50% - var(--room-width) * ${(roomOriginYaw + playerYaw) / 360})` }}
                />
            )}
            {!isPaused && (isDebug || audioStatus === "error") && (
                <section className="preparation-panel" aria-label="入力と音声">
                    <div className="preparation-actions">
                        <button type="button" onClick={(): void => { void startAudio(enemy); }}
                            disabled={isFinished || audioStatus === "loading"}>音声を再生</button>
                        <button type="button" onClick={(): void => { void startSensor(); }}
                            disabled={isFinished || inputStatus !== "pc"}>センサー開始</button>
                    </div>
                    <p className="screen-note">入力：{inputLabel}</p>
                    {sensorError && <p role="alert">{sensorError}</p>}
                </section>
            )}

            <div className="game-stats">
                <p className={hasStarted && remainingMs <= 10000 ? "time-warning" : ""}>
                    <span>残り時間：</span><strong>{Math.ceil(remainingMs / 1000)}</strong>秒
                </p>
                <p><span>スコア：</span><strong>{score}</strong>点</p>
                {hasStarted && !isPaused && !isFinished && (
                    <button className="pause-button" type="button" aria-label="一時停止" title="一時停止" onClick={pauseGame}>
                        <svg aria-hidden="true" width="16" height="18" viewBox="0 0 16 18" fill="currentColor">
                            <rect x="2" y="2" width="4" height="14" rx="1" />
                            <rect x="10" y="2" width="4" height="14" rx="1" />
                        </svg>
                    </button>
                )}
            </div>

            {isPaused && !isFinished && (
                <section className="pause-panel" aria-labelledby="pause-title">
                    <h2 id="pause-title">一時停止中</h2>
                    <div className="pause-actions">
                        <button className="pause-resume" type="button" onClick={(): void => { void resumeGame(); }}
                            disabled={audioStatus === "loading" || !isInputReady}>
                            再開
                        </button>
                        <button className="pause-recenter" type="button" onClick={recenterPlayer} disabled={audioStatus === "loading"}>
                            今の向きを正面に設定
                        </button>
                    </div>
                    <p className="screen-note" role="status">{recenterMessage}</p>
                    {gameMessage && <p role="status">{gameMessage}</p>}
                </section>
            )}

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
                aria-label={captureLabel}
            >
                {isDebug && captureLabel}
            </button>
            {!isPaused && gameMessage && <p className="game-status">{gameMessage}</p>}

            {isPaused && isDebug
                ? <details className="pause-debug"><summary>PCの方向を調整</summary>{debugPanel}</details>
                : debugPanel}
        </main>
    );
}
