import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { OrientationController } from "../src/sensors/OrientationController.ts";

const globals = globalThis as unknown as Record<string, unknown>;
let originalWindow: unknown;
let grant: () => Promise<string>;
const listeners = new Set<(event: DeviceOrientationEvent) => void>();
beforeEach(() => {
    originalWindow = globals.window;
    grant = async () => "granted";
    listeners.clear();
    globals.window = {
        isSecureContext: true,
        DeviceOrientationEvent: { requestPermission: () => grant() },
        addEventListener: (_name: string, listener: (event: DeviceOrientationEvent) => void) => listeners.add(listener),
        removeEventListener: (_name: string, listener: (event: DeviceOrientationEvent) => void) => listeners.delete(listener),
    };
});
afterEach(() => { globals.window = originalWindow; });

test("権限待ちで破棄されたセンサーは後から購読を開始しない", async () => {
    let release!: (value: string) => void;
    grant = () => new Promise<string>((resolve) => { release = resolve; });
    const sensor = new OrientationController();
    const pending = sensor.start();
    sensor.dispose();
    release("granted");
    await pending;
    assert.equal(listeners.size, 0);
});

test("初期方向・回転・再校正が通知され、停止後は購読を解除", async () => {
    const sensor = new OrientationController();
    const seen: number[] = [];
    sensor.subscribe(({ yaw }) => seen.push(yaw));
    await sensor.start();
    const send = (alpha: number): void => {
        for (const listener of listeners) listener({ alpha, beta: 90, gamma: 0 } as DeviceOrientationEvent);
    };
    send(0); send(90);
    assert.ok(Math.abs(sensor.getYaw() + 90) < 1e-6);
    assert.equal(sensor.recenter(), true);
    assert.equal(sensor.getYaw(), 0);
    assert.equal(seen.at(-1), 0);
    sensor.dispose();
    assert.equal(listeners.size, 0);
});
