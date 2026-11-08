import { useEffect, useEffectEvent, useRef, useState } from "react";
import { GameEngine } from "./GameEngine.ts";
import { GameAudio } from "../audio/GameAudio.ts";
import { OrientationController } from "../sensors/OrientationController.ts";
import { enemyDefinitions } from "./enemies.ts";
import { loadSettings, saveSettings } from "./storage.ts";
import { isDebug } from "./config.ts";
import type { GameSettings } from "./storage.ts";
import type { GameDifficulty, GameEvent, GameResult, HauntingKind, StageDefinition } from "./types.ts";

type Phase = "setup" | "countdown" | "playing" | "paused" | "finished";
type InputStatus = "idle" | "permission" | "waiting" | "sensor" | "pc" | "error";
type AudioStatus = "idle" | "loading" | "ready" | "error";
export interface Feedback { id: number; kind: "kill" | "damage" | "wave" | "miss" | "hit" | "blocked" | "boss"; title: string; detail: string; until: number }
export interface HauntingNotice { id: number; kind: HauntingKind; until: number }

function sensorMessage(error: unknown): string {
    if (!window.isSecureContext) return "スマホのセンサーにはHTTPSのURLが必要です。" + (isDebug ? "PC操作でも試せます。" : "");
    if (!("DeviceOrientationEvent" in window)) return "このブラウザは方向センサーに対応していません。" + (isDebug ? "PC操作で試せます。" : "");
    if (error instanceof Error && (error.name === "NotAllowedError" || error.message.includes("許可"))) {
        return "センサーの利用が許可されていません。ブラウザの設定を確認し、もう一度接続してください。";
    }
    return "センサーを開始できませんでした。" + (isDebug ? "もう一度接続するか、PC操作を選んでください。" : "センサーを再接続してください。");
}

/** リアルタイム処理はref、表示だけ約30fps。音源位置はセンサーから直接更新。 */
export function useGameSession(stage: StageDefinition, difficulty: GameDifficulty, onFinish: (result: GameResult) => void) {
    const [engine] = useState(() => new GameEngine(stage, Math.random, difficulty));
    const [snapshot, setSnapshot] = useState(() => engine.snapshot());
    const [phase, setPhaseState] = useState<Phase>("setup");
    const phaseRef = useRef<Phase>("setup");
    const [countdown, setCountdown] = useState(3);
    const [inputStatus, setInputStatusState] = useState<InputStatus>("idle");
    const inputStatusRef = useRef<InputStatus>("idle");
    const [audioStatus, setAudioStatusState] = useState<AudioStatus>("idle");
    const audioStatusRef = useRef<AudioStatus>("idle");
    const [sensorError, setSensorError] = useState("");
    const [message, setMessage] = useState("");
    const [playerYaw, setPlayerYaw] = useState(0);
    const playerYawRef = useRef(0);
    const [roomOriginYaw, setRoomOriginYaw] = useState(0);
    const [feedback, setFeedback] = useState<Feedback | null>(null);
    const feedbackRef = useRef<Feedback | null>(null);
    const [haunting, setHaunting] = useState<HauntingNotice | null>(null);
    const hauntingRef = useRef<HauntingNotice | null>(null);
    const noticeSequence = useRef(0);
    const [settings, setSettings] = useState<GameSettings>(loadSettings);
    const settingsRef = useRef(settings);
    const audioRef = useRef<GameAudio | null>(null);
    const sensorRef = useRef<OrientationController | null>(null);
    const lastSensorMs = useRef(0);
    const lastTickMs = useRef(0);
    const lastViewMs = useRef(0);
    const lastAnimationMs = useRef(0);
    const countdownEndMs = useRef(0);
    const previousCount = useRef(3);
    const finishAtMs = useRef<number | null>(null);
    const finishDelivered = useRef(false);
    const mounted = useRef(false);
    const audioRequest = useRef(0);
    const onFinishRef = useRef(onFinish);

    useEffect(() => { onFinishRef.current = onFinish; }, [onFinish]);

    function setPhase(next: Phase): void { phaseRef.current = next; setPhaseState(next); }
    function setInputStatus(next: InputStatus): void {
        if (inputStatusRef.current === next) return;
        inputStatusRef.current = next;
        setInputStatusState(next);
    }
    function setAudioStatus(next: AudioStatus): void { audioStatusRef.current = next; setAudioStatusState(next); }

    function applyYaw(yaw: number): void {
        playerYawRef.current = yaw;
        audioRef.current?.setPlayerYaw(yaw);
    }

    function vibrate(pattern: number | number[]): void {
        if (!settingsRef.current.haptics) return;
        try { navigator.vibrate?.(pattern); } catch { /* 非対応ブラウザでは音と画面で伝える。 */ }
    }

    function showFeedback(kind: Feedback["kind"], title: string, detail: string, durationMs: number): void {
        const next = { id: ++noticeSequence.current, kind, title, detail, until: performance.now() + durationMs };
        feedbackRef.current = next;
        setFeedback(next);
    }

    function consumeEvents(): void {
        const events: GameEvent[] = engine.drainEvents();
        audioRef.current?.handle(events, playerYawRef.current);
        for (const event of events) {
            if (event.type === "enemy-defeated") {
                hauntingRef.current = null;
                setHaunting(null);
                showFeedback("kill", "撃破", `+${event.points}点  /  ${event.combo}連続`, 800);
                vibrate([35, 25, 65]);
            } else if (event.type === "player-damaged") {
                showFeedback("damage", "襲撃を受けた", `ライフ 残り${event.life}`, 1000);
                vibrate([100, 60, 100]);
            } else if (event.type === "attack-missed") {
                showFeedback("miss", "空振り", "構え直し中", 650);
                vibrate(15);
            } else if (event.type === "attack-blocked") {
                showFeedback("blocked", "弾かれた", "鍵の音が止まるのを待つ", 650);
                vibrate(20);
            } else if (event.type === "enemy-hit") {
                hauntingRef.current = null;
                setHaunting(null);
                showFeedback("hit", "命中", `残り${event.enemy.health}回  /  +${event.points}点`, 850);
                vibrate([35, 25, 35]);
            } else if (event.type === "spawned" && enemyDefinitions[event.enemy.kind].boss) {
                showFeedback("boss", enemyDefinitions[event.enemy.kind].name, "息を吸う音を待つ", 2400);
            } else if (event.type === "haunting") {
                const next = { id: ++noticeSequence.current, kind: event.kind, until: performance.now() + 2200 };
                hauntingRef.current = next;
                setHaunting(next);
            } else if (event.type === "wave-started") {
                showFeedback("wave", stage.mode === "waves" ? `第${event.index + 1}波` : "練習開始", event.name, 2000);
            } else if (event.type === "finished") {
                setPhase("finished");
                finishAtMs.current = performance.now();
                publish();
            }
        }
    }

    function publish(): void {
        setSnapshot(engine.snapshot());
        setPlayerYaw(playerYawRef.current);
    }

    function advance(now: number): void {
        if (phaseRef.current !== "playing") return;
        const dtMs = Math.max(0, now - lastTickMs.current);
        lastTickMs.current = now;
        engine.update(dtMs, playerYawRef.current);
        consumeEvents();
        audioRef.current?.sync(engine.snapshot(), playerYawRef.current);
    }

    function pause(reason = "", advanceClock = true): void {
        if (phaseRef.current !== "playing" && phaseRef.current !== "countdown" && phaseRef.current !== "paused") return;
        const now = performance.now();
        if (phaseRef.current === "playing" && advanceClock && now - lastTickMs.current <= 1500) advance(now);
        if (engine.snapshot().status === "finished") return;
        audioRequest.current++;
        engine.pause();
        setPhase("paused");
        setMessage(reason);
        void audioRef.current?.pause().catch(() => { /* 再開時に再試行。 */ });
        if (audioStatusRef.current === "loading") setAudioStatus("idle");
        try { navigator.vibrate?.(0); } catch { /* 任意機能。 */ }
        publish();
    }

    function audioFailed(error: unknown): void {
        if (!mounted.current) return;
        console.error("ゲーム音声を再生できませんでした。", error);
        pause("音声が停止しました。音声を再接続して再開してください。", false);
        setAudioStatus("error");
    }

    function isInputReady(): boolean {
        return inputStatusRef.current === "pc" || (inputStatusRef.current === "sensor" && performance.now() - lastSensorMs.current < 5000);
    }

    function rebaseInput(): void {
        const oldYaw = playerYawRef.current;
        engine.recenter(oldYaw);
        if (phaseRef.current === "paused") setRoomOriginYaw((origin) => (origin + oldYaw) % 360);
        applyYaw(0);
        setPlayerYaw(0);
    }

    function usePc(): void {
        if (!isDebug || (phaseRef.current !== "setup" && phaseRef.current !== "paused")) return;
        sensorRef.current?.dispose();
        sensorRef.current = null;
        rebaseInput();
        setInputStatus("pc");
        setSensorError("");
    }

    async function startSensor(): Promise<void> {
        if (phaseRef.current !== "setup" && phaseRef.current !== "paused") return;
        if (sensorRef.current) return;
        rebaseInput();
        const sensor = new OrientationController();
        sensorRef.current = sensor;
        setInputStatus("permission");
        setSensorError("");
        sensor.subscribe(({ yaw }) => {
            if (!mounted.current || sensorRef.current !== sensor) return;
            lastSensorMs.current = performance.now();
            applyYaw(yaw);
            setInputStatus("sensor");
        });
        try {
            await sensor.start();
            if (!mounted.current || sensorRef.current !== sensor) { sensor.dispose(); return; }
            if (!sensor.getData()) {
                lastSensorMs.current = performance.now();
                setInputStatus("waiting");
            }
        } catch (error: unknown) {
            sensor.dispose();
            if (mounted.current && sensorRef.current === sensor) {
                sensorRef.current = null;
                setInputStatus("error");
                setSensorError(sensorMessage(error));
            }
        }
    }

    function recenter(): void {
        if ((phaseRef.current !== "setup" && phaseRef.current !== "paused") || !isInputReady()) return;
        const oldYaw = playerYawRef.current;
        if (sensorRef.current && !sensorRef.current.recenter()) return;
        // recenter() の通知でyawが0になる前の値で敵の基準をずらす。
        engine.recenter(oldYaw);
        if (phaseRef.current === "paused") setRoomOriginYaw((origin) => (origin + oldYaw) % 360);
        applyYaw(0);
        setPlayerYaw(0);
        setMessage("今の向きを正面に設定しました。");
        publish();
    }

    async function prepareAudio(): Promise<void> {
        if (audioStatusRef.current === "loading" || (phaseRef.current !== "setup" && phaseRef.current !== "paused")) return;
        const request = ++audioRequest.current;
        const audio = audioRef.current ?? new GameAudio(audioFailed);
        audioRef.current = audio;
        setAudioStatus("loading");
        try {
            await audio.prepare(stage, settingsRef.current.volume);
            if (!mounted.current || audioRequest.current !== request || audioRef.current !== audio || document.hidden) return;
            if (phaseRef.current === "setup") await audio.preview();
            if (!mounted.current || audioRequest.current !== request || audioRef.current !== audio) return;
            setAudioStatus("ready");
            setMessage("");
        } catch (error: unknown) {
            if (mounted.current && audioRequest.current === request && audioRef.current === audio) audioFailed(error);
        }
    }

    function beginCountdown(): void {
        audioRef.current?.stop();
        previousCount.current = 3;
        setCountdown(3);
        countdownEndMs.current = performance.now() + 3000;
        setPhase("countdown");
        setMessage("");
        audioRef.current?.countdown();
    }

    function begin(): void {
        if (phaseRef.current !== "setup" || audioStatusRef.current !== "ready" || !isInputReady() || document.hidden) return;
        if (!audioRef.current?.isRunning()) { setAudioStatus("error"); setMessage("音声を接続し直してください。"); return; }
        recenter();
        beginCountdown();
    }

    async function resume(): Promise<void> {
        if (phaseRef.current !== "paused" || audioStatusRef.current === "loading" || document.hidden) return;
        if (!isInputReady()) { setMessage("方向入力を接続してください。スマホを少し動かすか、センサーを再接続できます。"); return; }
        if (!audioRef.current || audioStatusRef.current !== "ready") { setMessage("先に音声を接続し直してください。"); return; }
        const audio = audioRef.current;
        const request = ++audioRequest.current;
        setAudioStatus("loading");
        try {
            await audio.resume();
            if (!mounted.current || request !== audioRequest.current || phaseRef.current !== "paused" || document.hidden) return;
            setAudioStatus("ready");
            if (engine.snapshot().status === "ready") beginCountdown();
            else {
                engine.resume();
                lastTickMs.current = performance.now();
                setPhase("playing");
                setMessage("");
                audio.sync(engine.snapshot(), playerYawRef.current);
                publish();
            }
        } catch (error: unknown) {
            if (mounted.current && request === audioRequest.current) audioFailed(error);
        }
    }

    function attack(): void {
        if (phaseRef.current !== "playing" || !audioRef.current?.isRunning() || !isInputReady()) return;
        const now = performance.now();
        if (now - lastTickMs.current > 1500) { pause("処理が中断されたため一時停止しました。", false); return; }
        advance(now);
        engine.attack(playerYawRef.current);
        consumeEvents();
        audioRef.current?.sync(engine.snapshot(), playerYawRef.current);
        publish();
    }

    function changeYaw(yaw: number): void {
        if (inputStatusRef.current !== "pc" || !Number.isFinite(yaw)) return;
        applyYaw(Math.max(-180, Math.min(180, yaw)));
        setPlayerYaw(playerYawRef.current);
    }

    function changeSettings(next: GameSettings): void {
        settingsRef.current = next;
        setSettings(next);
        audioRef.current?.setVolume(next.volume);
        saveSettings(next);
    }

    const updateFrame = useEffectEvent((now: number): void => {
            if (!mounted.current) return;
            const frameGapMs = now - lastAnimationMs.current;
            lastAnimationMs.current = now;
            const currentPhase = phaseRef.current;
            if ((inputStatusRef.current === "waiting" || inputStatusRef.current === "sensor")
                && now - lastSensorMs.current > 5000) {
                sensorRef.current?.dispose();
                sensorRef.current = null;
                setInputStatus("error");
                setSensorError("向きのデータを5秒間受信できませんでした。センサーを再接続してください。");
                pause("方向入力が途切れたため一時停止しました。", false);
            }
            if ((currentPhase === "playing" || currentPhase === "countdown") && !document.hidden) {
                if (!audioRef.current?.isRunning()) pause("音声が停止したため一時停止しました。再開を押してください。", false);
                else if (frameGapMs > 1500 || (currentPhase === "playing" && now - lastTickMs.current > 1500)) pause("処理が中断されたため一時停止しました。", false);
                else if (phaseRef.current === "countdown") {
                    const left = Math.max(0, Math.ceil((countdownEndMs.current - now) / 1000));
                    if (left !== previousCount.current && left > 0) {
                        previousCount.current = left;
                        setCountdown(left);
                        audioRef.current?.countdown();
                    }
                    if (left === 0) {
                        engine.start();
                        setPhase("playing");
                        lastTickMs.current = now;
                        consumeEvents();
                    }
                } else advance(now);
                if (now - lastViewMs.current >= 33) { publish(); lastViewMs.current = now; }
            } else if (currentPhase === "setup" || currentPhase === "paused") {
                if (now - lastViewMs.current >= 33) { setPlayerYaw(playerYawRef.current); lastViewMs.current = now; }
            }
            if (feedbackRef.current && now >= feedbackRef.current.until) {
                feedbackRef.current = null;
                setFeedback(null);
            }
            if (hauntingRef.current && now >= hauntingRef.current.until) {
                hauntingRef.current = null;
                setHaunting(null);
            }
            if (phaseRef.current === "finished" && finishAtMs.current !== null
                && now - finishAtMs.current >= 1500 && !finishDelivered.current) {
                const result = engine.snapshot().result;
                if (result) { finishDelivered.current = true; onFinishRef.current(result); }
            }
    });

    const hideSession = useEffectEvent((): void => {
            if (!document.hidden) return;
            if (phaseRef.current === "setup") {
                audioRequest.current++;
                void audioRef.current?.pause().catch(() => {});
                setAudioStatus("idle");
            } else if (phaseRef.current === "finished") audioRef.current?.stop();
            else pause("画面が閉じられたため一時停止しました。", false);
    });

    const hidePage = useEffectEvent((): void => {
        pause("一時停止中です。", false);
        audioRef.current?.stop();
    });

    const disposeSession = useEffectEvent((): void => {
        mounted.current = false;
        audioRequest.current++;
        sensorRef.current?.dispose();
        sensorRef.current = null;
        const audio = audioRef.current;
        audioRef.current = null;
        void audio?.dispose().catch(() => {});
    });

    const keyboardInput = useEffectEvent((event: KeyboardEvent): void => {
        if (event.repeat) return;
        if (event.key === "Escape") { pause(); return; }
        const target = event.target;
        const control = target instanceof HTMLElement ? target.closest("button, input, select, textarea, a") : null;
        if (event.code === "Space" && phaseRef.current === "playing" && (!control || control.id === "player-yaw")) {
            event.preventDefault();
            attack();
        }
    });

    useEffect(() => {
        mounted.current = true;
        let frame = 0;
        lastTickMs.current = performance.now();
        lastAnimationMs.current = lastTickMs.current;
        function tick(now: number): void {
            updateFrame(now);
            frame = requestAnimationFrame(tick);
        }
        frame = requestAnimationFrame(tick);
        function onHide(): void { hideSession(); }
        function onPageHide(): void { hidePage(); }
        function onKeyDown(event: KeyboardEvent): void { keyboardInput(event); }
        document.addEventListener("visibilitychange", onHide);
        window.addEventListener("pagehide", onPageHide);
        document.addEventListener("keydown", onKeyDown);
        return () => {
            disposeSession();
            cancelAnimationFrame(frame);
            document.removeEventListener("visibilitychange", onHide);
            window.removeEventListener("pagehide", onPageHide);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [engine, stage]);

    return {
        snapshot, phase, countdown, inputStatus, audioStatus, sensorError, message, feedback, haunting,
        playerYaw, roomOriginYaw, settings, changeSettings, changeYaw, usePc, startSensor,
        prepareAudio, begin, resume, pause: (): void => pause(), recenter, attack,
        inputReady: inputStatus === "pc" || inputStatus === "sensor",
    };
}
