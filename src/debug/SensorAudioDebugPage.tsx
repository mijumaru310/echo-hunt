
import {
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";

import { SpatialAudio } from "../audio/SpatialAudioEngine";
import {
    getPhoneDirection,
    wrapAngle,
} from "../sensors/heading";

type PermissionAPI = typeof DeviceOrientationEvent & {
    requestPermission?: () => Promise<"granted" | "denied">;
};

type Enemy = {
    yaw: number;
    distance: number;
};

export default function SensorAudioDebugPage() {
    const audioRef = useRef<SpatialAudio | null>(null);

    // プレイヤーの姿勢
    const playerYawRef = useRef(0);
    const referenceHeading = useRef<number | null>(null);
    const latestHeading = useRef<number | null>(null);

    // 敵の位置（ゲーム内の基準方位）
    const enemyARef = useRef<Enemy>({
        yaw: 90,
        distance: 2,
    });

    const enemyBRef = useRef<Enemy>({
        yaw: -90,
        distance: 5,
    });

    // 動作設定
    const movingRef = useRef(false);
    const speedRef = useRef(30);
    const loadingRef = useRef(false);
    const lastDebugRef = useRef(0);

    // UI用state
    const [playerYaw, setPlayerYaw] = useState(0);
    const [enemyAYaw, setEnemyAYaw] = useState(90);
    const [enemyBYaw, setEnemyBYaw] = useState(-90);

    const [distanceA, setDistanceA] = useState(2);
    const [distanceB, setDistanceB] = useState(5);

    const [moving, setMoving] = useState(false);
    const [speed, setSpeed] = useState(30);
    const [playing, setPlaying] = useState(false);
    const [loading, setLoading] = useState(false);

    const [status, setStatus] = useState("未開始");

    const [debug, setDebug] = useState({
        alpha: "---",
        beta: "---",
        gamma: "---",
        heading: "---",
    });

    // 2体の音源位置を更新
    const updateAudioPositions = useCallback(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const playerYaw = playerYawRef.current;

        const relativeA = wrapAngle(
            enemyARef.current.yaw - playerYaw
        );

        const relativeB = wrapAngle(
            enemyBRef.current.yaw - playerYaw
        );

        audio.setEnemyPosition(
            "enemyA",
            relativeA,
            0,
            enemyARef.current.distance
        );

        audio.setEnemyPosition(
            "enemyB",
            relativeB,
            0,
            enemyBRef.current.distance
        );
    }, []);

    // スマホの姿勢センサー
    const handleOrientation = useCallback(
        (event: DeviceOrientationEvent) => {
            const pose = getPhoneDirection(event);

            if (pose?.heading != null) {
                latestHeading.current = pose.heading;

                const reference =
                    referenceHeading.current ?? pose.heading;

                referenceHeading.current = reference;

                playerYawRef.current = wrapAngle(
                    pose.heading - reference
                );

                // センサーイベントごとに音響更新
                updateAudioPositions();
            }

            const now = performance.now();

            if (now - lastDebugRef.current >= 50) {
                lastDebugRef.current = now;

                setDebug({
                    alpha: event.alpha?.toFixed(1) ?? "---",
                    beta: event.beta?.toFixed(1) ?? "---",
                    gamma: event.gamma?.toFixed(1) ?? "---",
                    heading: pose?.heading?.toFixed(1) ?? "---",
                });

                setStatus(
                    pose?.heading != null
                        ? "センサー取得中"
                        : "方位角を計算できない姿勢"
                );
            }
        },
        [updateAudioPositions]
    );

    // センサー開始
    async function startSensor() {
        try {
            if (!window.isSecureContext) {
                throw new Error("HTTPS環境が必要です");
            }

            if (!("DeviceOrientationEvent" in window)) {
                throw new Error("センサー非対応");
            }

            const api = DeviceOrientationEvent as PermissionAPI;

            if (typeof api.requestPermission === "function") {
                const result = await api.requestPermission();

                if (result !== "granted") {
                    throw new Error("センサーが許可されませんでした");
                }
            }

            window.removeEventListener(
                "deviceorientation",
                handleOrientation
            );

            window.addEventListener(
                "deviceorientation",
                handleOrientation
            );

            setStatus("センサーデータ待機中");
        } catch (error) {
            setStatus(String(error));
        }
    }

    // 2体の音声を開始
    async function startAudio() {
        if (audioRef.current || loadingRef.current) return;

        loadingRef.current = true;
        setLoading(true);

        const audio = new SpatialAudio();
        audioRef.current = audio;

        try {
            // ユーザー操作からAudioContextを初期化
            await audio.initialize();

            // 2種類のWAVを並行して読み込む
            await Promise.all([
                audio.playEnemy(
                    "enemyA",
                    "/sounds/footstep.wav",
                    {
                        loop: true,
                        volume: 0.7,
                        azimuthDeg: wrapAngle(
                            enemyARef.current.yaw - playerYawRef.current
                        ),
                        distance: enemyARef.current.distance,
                    }
                ),

                audio.playEnemy(
                    "enemyB",
                    "/sounds/breath.wav",
                    {
                        loop: true,
                        volume: 0.9,
                        azimuthDeg: wrapAngle(
                            enemyBRef.current.yaw - playerYawRef.current
                        ),
                        distance: enemyBRef.current.distance,
                    }
                ),
            ]);

            if (audioRef.current !== audio) return;

            updateAudioPositions();
            setPlaying(true);
        } catch (error) {
            if (audioRef.current === audio) {
                audioRef.current = null;
            }

            setPlaying(false);
            setStatus(`音声エラー: ${String(error)}`);
            await audio.dispose();
        } finally {
            loadingRef.current = false;
            setLoading(false);
        }
    }

    async function stopAudio() {
        const audio = audioRef.current;

        audioRef.current = null;
        setPlaying(false);

        await audio?.dispose();
    }

    // 現在のスマホの向きを正面0°に設定
    function recenter() {
        if (latestHeading.current == null) {
            setStatus("有効な方位角がありません");
            return;
        }

        referenceHeading.current = latestHeading.current;
        playerYawRef.current = 0;

        setPlayerYaw(0);
        updateAudioPositions();
    }

    // 敵の移動開始・停止
    function toggleMovement() {
        const next = !movingRef.current;

        movingRef.current = next;
        setMoving(next);
    }

    function changeSpeed(value: number) {
        speedRef.current = value;
        setSpeed(value);
    }

    // 敵Aの距離変更
    function changeDistanceA(value: number) {
        enemyARef.current.distance = value;
        setDistanceA(value);
        updateAudioPositions();
    }

    // 敵Bの距離変更
    function changeDistanceB(value: number) {
        enemyBRef.current.distance = value;
        setDistanceB(value);
        updateAudioPositions();
    }

    // 敵の自動移動
    useEffect(() => {
        let frameId = 0;
        let previousTime = performance.now();
        let lastUiUpdate = 0;

        function animate(now: number) {
            const deltaTime = Math.min(
                Math.max((now - previousTime) / 1000, 0),
                0.05
            );

            previousTime = now;

            if (movingRef.current) {
                // 敵Aは時計回り
                enemyARef.current.yaw = wrapAngle(
                    enemyARef.current.yaw +
                    speedRef.current * deltaTime
                );

                // 敵Bは逆方向、半分の速度
                enemyBRef.current.yaw = wrapAngle(
                    enemyBRef.current.yaw -
                    speedRef.current * 0.5 * deltaTime
                );

                updateAudioPositions();
            }

            // UI更新は約20回/秒
            if (now - lastUiUpdate >= 50) {
                lastUiUpdate = now;

                setPlayerYaw(playerYawRef.current);
                setEnemyAYaw(enemyARef.current.yaw);
                setEnemyBYaw(enemyBRef.current.yaw);
            }

            frameId = requestAnimationFrame(animate);
        }

        frameId = requestAnimationFrame(animate);

        return () => {
            cancelAnimationFrame(frameId);

            window.removeEventListener(
                "deviceorientation",
                handleOrientation
            );

            const audio = audioRef.current;
            audioRef.current = null;

            if (audio) {
                void audio.dispose().catch(console.error);
            }
        };
    }, [handleOrientation, updateAudioPositions]);

    const relativeA = wrapAngle(enemyAYaw - playerYaw);
    const relativeB = wrapAngle(enemyBYaw - playerYaw);

    return (
        <main
            style={{
                padding: 24,
                maxWidth: 600,
                margin: "auto",
            }}
        >
            <h1>ECHO HUNT - Multi Audio Test</h1>

            <p>状態: {status}</p>

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
                    if (playing) void stopAudio();
                    else void startAudio();
                }}
            >
                {loading
                    ? "音声読み込み中..."
                    : playing
                        ? "音を停止"
                        : "2体の音を再生"}
            </button>

            <h2>プレイヤー: {playerYaw.toFixed(1)}°</h2>

            <hr />

            <h2>敵A：足音</h2>

            <p>敵の方位角: {enemyAYaw.toFixed(1)}°</p>
            <p>相対方向: {relativeA.toFixed(1)}°</p>
            <p>距離: {distanceA.toFixed(1)}</p>

            <input
                type="range"
                min="1"
                max="10"
                step="0.5"
                value={distanceA}
                onChange={(e) =>
                    changeDistanceA(Number(e.target.value))
                }
                style={{ width: "100%" }}
            />

            <hr />

            <h2>敵B：呼吸音</h2>

            <p>敵の方位角: {enemyBYaw.toFixed(1)}°</p>
            <p>相対方向: {relativeB.toFixed(1)}°</p>
            <p>距離: {distanceB.toFixed(1)}</p>

            <input
                type="range"
                min="1"
                max="10"
                step="0.5"
                value={distanceB}
                onChange={(e) =>
                    changeDistanceB(Number(e.target.value))
                }
                style={{ width: "100%" }}
            />

            <hr />

            <h2>移動設定</h2>

            <button onClick={toggleMovement}>
                {moving ? "敵の移動を停止" : "敵の移動を開始"}
            </button>

            <p>敵Aの速度: {speed}°/秒</p>
            <p>敵Bの速度: {speed * 0.5}°/秒（逆方向）</p>

            <input
                type="range"
                min="0"
                max="180"
                step="5"
                value={speed}
                onChange={(e) =>
                    changeSpeed(Number(e.target.value))
                }
                style={{ width: "100%" }}
            />

            <hr />

            <h2>Sensor Diagnostics</h2>

            <p>Alpha: {debug.alpha}°</p>
            <p>Beta: {debug.beta}°</p>
            <p>Gamma: {debug.gamma}°</p>
            <p>Heading: {debug.heading}°</p>
        </main>
    );
}
