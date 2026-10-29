/*
要約
メソッド	用途
start()	センサーを開始する
getYaw()	現在のプレイヤーの向きを取得する
recenter()	現在の方向を0°にする
subscribe()	向きが変わるたびに通知を受ける


*/



import {
    getPhoneDirection,
    wrapAngle,
} from "./heading";

// ゲーム側へ渡すセンサーデータ
export type OrientationData = {
    yaw: number;
    heading: number;
    elevation: number;
    horizontalStrength: number;
};

// センサー更新時に呼び出す関数の型
type OrientationListener = (data: OrientationData) => void;

// iPhoneなどの権限要求に対応
type PermissionAPI = typeof DeviceOrientationEvent & {
    requestPermission?: () => Promise<"granted" | "denied">;
};

export class OrientationController {
    private referenceHeading: number | null = null;
    private latestHeading: number | null = null;

    private currentYaw = 0;
    private latestData: OrientationData | null = null;

    private running = false;

    // 更新の通知先を登録
    private listeners = new Set<OrientationListener>();

    // センサーイベントを受信
    private handleOrientation = (
        event: DeviceOrientationEvent
    ) => {
        // α・β・γから方位角を計算
        const pose = getPhoneDirection(event);

        if (!pose || pose.heading === null) {
            // 方位角が取得できないときは
            // 最後の有効な角度を維持する
            return;
        }

        const heading = pose.heading;

        this.latestHeading = heading;

        // 初回の方向を基準0°にする
        const reference = this.referenceHeading ?? heading;
        this.referenceHeading = reference;

        this.currentYaw = wrapAngle(heading - reference);

        const data: OrientationData = {
            yaw: this.currentYaw,
            heading,
            elevation: pose.elevation,
            horizontalStrength: pose.horizontalStrength,
        };

        this.latestData = data;

        // 登録済みの関数へ新しい角度を通知
        this.notify(data);
    };

    private notify(data: OrientationData) {
        for (const listener of this.listeners) {
            listener(data);
        }
    }

    // センサー開始
    async start(): Promise<void> {
        if (this.running) return;

        if (!window.isSecureContext) {
            throw new Error("HTTPS環境が必要です");
        }

        if (!("DeviceOrientationEvent" in window)) {
            throw new Error("姿勢センサーに対応していません");
        }

        const api =
            window.DeviceOrientationEvent as PermissionAPI;

        // 対応ブラウザではユーザーの許可を取得
        if (typeof api.requestPermission === "function") {
            const result = await api.requestPermission();

            if (result !== "granted") {
                throw new Error("センサーの利用が許可されませんでした");
            }
        }

        window.addEventListener(
            "deviceorientation",
            this.handleOrientation
        );

        this.running = true;
    }

    // 現在のプレイヤーの水平方向を取得
    getYaw(): number {
        return this.currentYaw;
    }

    // 最新の姿勢データを取得
    getData(): OrientationData | null {
        return this.latestData;
    }

    // 現在の方向を0°に再設定
    recenter(): boolean {
        if (this.latestHeading === null) {
            return false;
        }

        this.referenceHeading = this.latestHeading;
        this.currentYaw = 0;

        if (this.latestData) {
            this.latestData = {
                ...this.latestData,
                yaw: 0,
            };

            this.notify(this.latestData);
        }

        return true;
    }

    // 角度が更新されるたびに関数を呼び出す
    subscribe(listener: OrientationListener): () => void {
        this.listeners.add(listener);

        // 登録解除用の関数を返す
        return () => {
            this.listeners.delete(listener);
        };
    }

    // センサー停止
    stop(): void {
        window.removeEventListener(
            "deviceorientation",
            this.handleOrientation
        );

        this.running = false;
    }

    // 全体の後片付け
    dispose(): void {
        this.stop();
        this.listeners.clear();
    }
}
