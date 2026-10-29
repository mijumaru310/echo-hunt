
import { useEffect, useRef, useState } from "react";

import { SpatialAudio } from "../audio/SpatialAudioEngine";
import { OrientationController } from "../sensors/OrientationController";
import { wrapAngle } from "../sensors/heading";

export default function OrientationTestPage() {
    const controllerRef = useRef<OrientationController | null>(null);
    const audioRef = useRef<SpatialAudio | null>(null);

    const yawRef = useRef(0);
    const lastDisplayRef = useRef(0);
    const loadingRef = useRef(false);

    const [yaw, setYaw] = useState(0);
    const [playing, setPlaying] = useState(false);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState("未開始");

    const [heading, setHeading] = useState<number | null>(null);
    const [updateCount, setUpdateCount] = useState(0);


    // ゲーム内での敵の位置
    const enemyA = 90;
    const enemyB = -90;

    useEffect(() => {
        const controller = new OrientationController();

        controllerRef.current = controller;

        // センサーの角度が変化したら呼び出される
        const unsubscribe = controller.subscribe((data) => {
            yawRef.current = data.yaw;

            const audio = audioRef.current;

            if (audio) {
                audio.setEnemyPosition(
                    "enemyA",
                    wrapAngle(90 - data.yaw),
                    0,
                    2
                );

                audio.setEnemyPosition(
                    "enemyB",
                    wrapAngle(-90 - data.yaw),
                    0,
                    5
                );
            }

            // Reactの画面表示だけ30fps程度に制限
            const now = performance.now();


            if (now - lastDisplayRef.current >= 33) {
                lastDisplayRef.current = now;

                setYaw(data.yaw);
                setHeading(data.heading);
                setUpdateCount((count) => count + 1);
            }

        });

        return () => {
            unsubscribe();
            controller.dispose();
            controllerRef.current = null;

            const audio = audioRef.current;
            audioRef.current = null;

            if (audio) {
                void audio.dispose();
            }
        };
    }, []);

    // センサー開始
    async function startSensor() {
        try {
            const controller = controllerRef.current;
            if (!controller) return;

            await controller.start();
            setStatus("センサー開始：姿勢データ待機中");
        } catch (error) {
            setStatus(`センサーエラー: ${String(error)}`);
        }
    }

    // 音響開始
    async function startAudio() {
        if (audioRef.current || loadingRef.current) return;

        loadingRef.current = true;
        setLoading(true);

        const audio = new SpatialAudio();
        audioRef.current = audio;

        try {
            await audio.initialize();

            await Promise.all([
                audio.playEnemy(
                    "enemyA",
                    "/sounds/footstep.wav",
                    {
                        loop: true,
                        volume: 0.7,
                        azimuthDeg: wrapAngle(
                            enemyA - yawRef.current
                        ),
                        distance: 2,
                    }
                ),

                audio.playEnemy(
                    "enemyB",
                    "/sounds/breath.wav",
                    {
                        loop: true,
                        volume: 0.9,
                        azimuthDeg: wrapAngle(
                            enemyB - yawRef.current
                        ),
                        distance: 5,
                    }
                ),
            ]);

            if (audioRef.current !== audio) return;

            // 読み込み中に回転した場合も最新の向きにする
            audio.setEnemyPosition(
                "enemyA",
                wrapAngle(enemyA - yawRef.current),
                0,
                2
            );

            audio.setEnemyPosition(
                "enemyB",
                wrapAngle(enemyB - yawRef.current),
                0,
                5
            );

            setPlaying(true);
            setStatus("音響再生中");
        } catch (error) {
            if (audioRef.current === audio) {
                audioRef.current = null;
            }

            await audio.dispose();
            setPlaying(false);
            setStatus(`音響エラー: ${String(error)}`);
        } finally {
            loadingRef.current = false;
            setLoading(false);
        }
    }

    // 音響停止
    async function stopAudio() {
        const audio = audioRef.current;
        audioRef.current = null;

        setPlaying(false);
        await audio?.dispose();
    }

    // 正面を再設定
    function recenter() {
        const controller = controllerRef.current;

        if (!controller?.recenter()) {
            setStatus("センサーデータがまだありません");
            return;
        }

        setYaw(0);
        setStatus("正面を0°に設定しました");
    }

    const relativeA = wrapAngle(enemyA - yaw);
    const relativeB = wrapAngle(enemyB - yaw);

    return (
        <main
            style={{
                padding: 24,
                maxWidth: 600,
                margin: "auto",
            }}
        >
            <h1>ECHO HUNT - Controller Test</h1>

            <p>状態：{status}</p>

            <button onClick={startSensor}>
                センサー開始
            </button>

            <button onClick={recenter}>
                正面を再設定
            </button>

            <hr />

            <button
                disabled={loading}
                onClick={() => {
                    if (playing) {
                        void stopAudio();
                    } else {
                        void startAudio();
                    }
                }}
            >
                {loading
                    ? "読み込み中..."
                    : playing
                        ? "音を停止"
                        : "2体の音を再生"}
            </button>

            <hr />

            <h2>プレイヤー</h2>
            <p>Yaw：{yaw.toFixed(1)}°</p>

            <h2>敵A：足音</h2>
            <p>世界方向：{enemyA}°</p>
            <p>相対方向：{relativeA.toFixed(1)}°</p>
            <p>距離：2</p>

            <h2>敵B：呼吸音</h2>
            <p>世界方向：{enemyB}°</p>
            <p>相対方向：{relativeB.toFixed(1)}°</p>
            <p>距離：5</p>

            <hr />

            <h2>センサーデバッグ</h2>

            <p>更新回数：{updateCount}</p>

            <p>
                Heading：
                {heading === null ? "---" : heading.toFixed(1)}°
            </p>

            <p>Player Yaw：{yaw.toFixed(1)}°</p>

            <p>
                敵Aの相対方向：
                {wrapAngle(90 - yaw).toFixed(1)}°
            </p>

            <p>
                敵Bの相対方向：
                {wrapAngle(-90 - yaw).toFixed(1)}°
            </p>
        </main>
    );
}
