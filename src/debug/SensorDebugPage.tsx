
import { useCallback, useEffect, useRef, useState } from "react";

type SensorValues = {
    alpha: number | null;
    beta: number | null;
    gamma: number | null;
    absolute: boolean;
};

type OrientationAPI = typeof DeviceOrientationEvent & {
    requestPermission?: () => Promise<"granted" | "denied">;
};

export default function SensorDebugPage() {
    const [sensor, setSensor] = useState<SensorValues | null>(null);
    const [status, setStatus] = useState("未開始");
    const lastUpdate = useRef(0);

    const handleOrientation = useCallback(
        (event: DeviceOrientationEvent) => {
            // 表示更新は約30回/秒に制限
            const now = performance.now();
            if (now - lastUpdate.current < 16) return;
            lastUpdate.current = now;

            setSensor({
                alpha: event.alpha,
                beta: event.beta,
                gamma: event.gamma,
                absolute: event.absolute,
            });

            setStatus("取得中");
        },
        []
    );

    async function startSensor() {
        try {
            if (!window.isSecureContext) {
                throw new Error("HTTPSが必要です");
            }

            if (!("DeviceOrientationEvent" in window)) {
                throw new Error("この端末は非対応です");
            }

            const Orientation =
                window.DeviceOrientationEvent as OrientationAPI;

            // 対応ブラウザでは利用許可を求める
            if (typeof Orientation.requestPermission === "function") {
                const result = await Orientation.requestPermission();

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

            setStatus("データ待機中");
        } catch (error) {
            setStatus(String(error));
        }
    }

    useEffect(() => {
        return () => {
            window.removeEventListener(
                "deviceorientation",
                handleOrientation
            );
        };
    }, [handleOrientation]);

    const format = (value: number | null | undefined) =>
        value == null ? "---" : `${value.toFixed(1)}°`;

    return (
        <main style={{ padding: 24 }}>
            <h1>ECHO HUNT - Sensor Debug</h1>

            <button onClick={startSensor}>
                センサー開始
            </button>

            <p>状態: {status}</p>

            <h2>Alpha: {format(sensor?.alpha)}</h2>
            <h2>Beta: {format(sensor?.beta)}</h2>
            <h2>Gamma: {format(sensor?.gamma)}</h2>

            <p>Absolute: {String(sensor?.absolute ?? false)}</p>
        </main>
    );
}
