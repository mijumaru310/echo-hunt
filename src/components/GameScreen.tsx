import type { CSSProperties, ReactElement } from "react";
import { useGameSession } from "../game/useGameSession.ts";
import { enemyDefinitions } from "../game/enemies.ts";
import { relativeAngle, isInCaptureRange } from "../game/capture.ts";
import { isDebug } from "../game/config.ts";
import { stageBackgroundStyle } from "./stagePresentation.ts";
import type { GameResult, StageDefinition } from "../game/types.ts";
import type { GameSettings } from "../game/storage.ts";

interface GameScreenProps {
    stage: StageDefinition;
    onFinish: (result: GameResult) => void;
    onTitle: () => void;
}

function AudioSettings({ settings, onChange }: { settings: GameSettings; onChange: (settings: GameSettings) => void }): ReactElement {
    return (
        <div className="audio-settings">
            <label className="volume-control">音量 <input aria-label="ゲーム音量" type="range" min="0.05" max="1" step="0.05"
                value={settings.volume} onChange={(event) => onChange({ ...settings, volume: Number(event.currentTarget.value) })} />
                <span>{Math.round(settings.volume * 100)}%</span>
            </label>
            <label className="haptics-control"><input type="checkbox" checked={settings.haptics}
                onChange={(event) => onChange({ ...settings, haptics: event.currentTarget.checked })} />振動を使う<span>対応端末のみ</span></label>
        </div>
    );
}

export default function GameScreen({ stage, onFinish, onTitle }: GameScreenProps): ReactElement {
    const game = useGameSession(stage, onFinish);
    const { snapshot, phase, feedback } = game;
    const target = snapshot.enemies.find((enemy) => enemy.id === snapshot.targetId);
    const inRange = target && isInCaptureRange(relativeAngle(target.worldYaw, game.playerYaw));
    const progress = target && inRange ? Math.min(1, target.capture.progressMs / target.lockTimeMs) : 0;
    const canAttack = phase === "playing" && progress >= 1;
    const inputLabels = { idle: "未接続", permission: "許可を確認中", waiting: "スマホを少し動かしてください", sensor: "接続済み", pc: "PC操作", error: "再接続してください" };
    const hasInputPending = game.inputStatus === "permission" || game.inputStatus === "waiting";
    const titleText = phase === "countdown" ? "耳を澄ませて" : phase === "finished"
        ? snapshot.result?.reason === "defeated" ? "闇に呑まれた" : "夜を越えた"
        : canAttack ? "タップして撃破" : progress > 0 ? "その方向を捉えて" : "気配を探す";

    const inputControls = (
        <div className="input-controls">
            <button className="connection-button" type="button" disabled={hasInputPending || game.inputStatus === "sensor"}
                onClick={() => { void game.startSensor(); }}>
                <span>スマホのセンサーを接続</span><small>{inputLabels[game.inputStatus]}</small>
            </button>
            {game.sensorError && <p className="inline-error" role="alert">{game.sensorError}</p>}
            <button className="text-button pc-option" type="button" onClick={game.usePc} disabled={game.inputStatus === "pc"}>
                {game.inputStatus === "pc" ? "PC操作を選択中" : "PCのスライダーで試す"}
            </button>
        </div>
    );

    if (phase === "setup") {
        return (
            <main className="echo-game foyer" style={stageBackgroundStyle(stage.background)} aria-label="プレイ準備">
                <button className="text-button back-link" type="button" onClick={onTitle}>← ステージ選択</button>
                <div className="foyer-controls">
                    <p className="eyebrow">BEFORE THE HUNT</p>
                    <h1>音の向こうへ。</h1>
                    <p className="stage-caption">{stage.name}</p>
                    <ol className="setup-instructions">
                        <li>イヤホンをつけ、足音が右から聞こえるか確かめる。</li>
                        <li>スマホを顔の正面に持ち、体ごと向きを変える。</li>
                        <li>ピッと鳴ったら画面をタップ。命中音のあと、敵の気配が消える。</li>
                    </ol>
                    <p className="stage-tip">{stage.hint}</p>
                    <div className="foyer-checks">
                        <button className="connection-button" type="button" onClick={() => { void game.prepareAudio(); }} disabled={game.audioStatus === "loading"}>
                            <span>{game.audioStatus === "ready" ? "右側の足音をもう一度聴く" : "音声を接続して足音を聴く"}</span>
                            <small>{game.audioStatus === "ready" ? "接続済み" : game.audioStatus === "loading" ? "準備中" : "未接続"}</small>
                        </button>
                        {game.audioStatus === "error" && <p className="inline-error" role="alert">音声を再生できませんでした。もう一度接続してください。</p>}
                        {inputControls}
                    </div>
                    <AudioSettings settings={game.settings} onChange={game.changeSettings} />
                    <button className="menu-primary" type="button" onClick={game.begin}
                        disabled={game.audioStatus !== "ready" || !game.inputReady}>この向きを正面にして開始</button>
                    <p className="setup-footnote">3秒の合図のあとに開始します。ライフ {stage.initialLife} ／ {stage.mode === "waves" ? stage.waves.length + "ウェーブ" : (stage.durationMs ?? 0) / 1000 + "秒"}</p>
                    {game.message && <p role="status">{game.message}</p>}
                </div>
            </main>
        );
    }

    return (
        <main className="echo-game hunt-screen" data-paused={phase === "paused"} data-feedback={feedback?.kind ?? "none"}
            style={stageBackgroundStyle(stage.background)}
            tabIndex={-1} aria-label="ECHO HUNT 探索中">
            <div className="mansion-panorama" aria-hidden="true"
                style={{ backgroundPositionX: "calc(50% - var(--room-width) * " + (game.roomOriginYaw + game.playerYaw) / 360 + ")" }} />
            <div className="hunt-shade" aria-hidden="true" />

            <header className="game-hud">
                <div className="hud-stage"><span className="eyebrow">{stage.mode === "waves" ? "WAVE " + (snapshot.waveIndex + 1) + " / " + snapshot.waveCount : "PRACTICE"}</span><span>{stage.mode === "waves" ? snapshot.waveName : stage.name}</span></div>
                <button className="pause-button" type="button" onClick={game.pause} aria-label="一時停止" disabled={phase === "paused" || phase === "finished"}>Ⅱ</button>
                <div className="life-meter" role="img" aria-label={"ライフ " + snapshot.life + " / " + snapshot.maxLife} data-invincible={snapshot.invincibleMs > 0}>
                    <span className="hud-label">LIFE</span>
                    <span className="life-symbols" aria-hidden="true">{Array.from({ length: snapshot.maxLife }, (_, index) => <span key={index} className={index < snapshot.life ? "life is-alive" : "life"}>◆</span>)}</span>
                </div>
                <div className="hud-score"><span className="hud-label">SCORE</span><strong>{snapshot.score.toLocaleString()}</strong></div>
                <div className="hud-progress"><span className="hud-label">{snapshot.remainingMs !== null ? "TIME" : "DEFEATED"}</span><strong>{snapshot.remainingMs !== null ? Math.ceil(snapshot.remainingMs / 1000) + "s" : snapshot.defeated}</strong></div>
            </header>

            {phase !== "paused" && (
                <>
                    <button type="button" className="attack-surface" disabled={!canAttack} onClick={game.attack} aria-label="撃破する"><span className="sr-only">ロックオンした敵を撃破する</span></button>
                    <div className={"hunt-focus " + (canAttack ? "is-locked " : "") + (feedback?.kind === "kill" ? "is-victorious" : "")}>
                        <div className="reticle" aria-hidden="true">
                            <svg viewBox="0 0 100 100"><circle className="reticle-track" cx="50" cy="50" r="40" /><circle className="reticle-progress" cx="50" cy="50" r="40" pathLength="100" strokeDasharray="100" strokeDashoffset={100 - progress * 100} /></svg>
                            <span className="reticle-center">{phase === "countdown" ? game.countdown : feedback?.kind === "kill" ? "✦" : "+"}</span>
                            {feedback?.kind === "kill" && <div className="defeat-burst" key={feedback.id}>{Array.from({ length: 10 }, (_, index) => <i key={index} style={{ "--ray": index * 36 + "deg" } as CSSProperties} />)}</div>}
                        </div>
                        <p className="hunt-focus-title">{titleText}</p>
                        <p className="hunt-focus-caption">{phase === "countdown" ? "スマホを正面に持ってください" : phase === "finished" ? "探索終了" : "LISTEN · TURN · STRIKE"}</p>
                    </div>
                    <div className="combat-feedback" role="status" aria-live="polite" aria-atomic="true">
                        {feedback && <div key={feedback.id} className={"feedback-notice feedback-" + feedback.kind}><strong>{feedback.title}</strong><span>{feedback.detail}</span></div>}
                    </div>
                    {snapshot.combo >= 2 && phase === "playing" && <p className="combo-counter">{snapshot.combo}<span>CHAIN</span></p>}
                    {feedback?.kind === "damage" && <div key={feedback.id} className="damage-vignette" aria-hidden="true" />}
                </>
            )}

            {phase === "paused" && (
                <section className="pause-panel" aria-labelledby="pause-title">
                    <p className="eyebrow">TAKE A BREATH</p><h1 id="pause-title">一時停止中</h1>
                    <p className="pause-hint">音も、敵も、時間も止まっています。</p>
                    {game.message && <p className="pause-message" role="status">{game.message}</p>}
                    {(game.audioStatus === "error" || game.audioStatus === "idle") && <button type="button" className="connection-button" onClick={() => { void game.prepareAudio(); }}><span>音声を再接続</span></button>}
                    {!game.inputReady && inputControls}
                    <AudioSettings settings={game.settings} onChange={game.changeSettings} />
                    <button className="menu-primary" type="button" onClick={() => { void game.resume(); }}
                        disabled={game.audioStatus !== "ready" || !game.inputReady}>{game.audioStatus === "loading" ? "音声を準備中" : "探索を再開"}</button>
                    <div className="pause-secondary"><button className="text-button" type="button" onClick={game.recenter} disabled={!game.inputReady}>今の向きを正面に設定</button><button className="text-button" type="button" onClick={onTitle}>ステージ選択へ</button></div>
                </section>
            )}

            {game.inputStatus === "pc" && phase !== "finished" && phase !== "countdown" && (
                <section className="pc-controls" aria-label="PCでの方向操作">
                    <label htmlFor="player-yaw">向きを変える <output>{Math.round(game.playerYaw)}°</output></label>
                    <input id="player-yaw" type="range" min="-180" max="180" step="1" value={game.playerYaw} onChange={(event) => game.changeYaw(Number(event.currentTarget.value))} />
                    <p>左 ←　正面　→ 右 ／ Spaceで撃破</p>
                </section>
            )}

            {isDebug && <details className="debug-panel"><summary>開発用・敵の状態</summary><p>経過 {(snapshot.elapsedMs / 1000).toFixed(1)}秒 ／ 対象 {snapshot.targetId ?? "なし"}</p>
                {snapshot.enemies.map((enemy) => <p key={enemy.id}>{enemy.id}・{enemyDefinitions[enemy.kind].name}：{enemy.worldYaw.toFixed(1)}° / 距離{enemy.distance.toFixed(2)} / {enemy.phase} / {Math.round(enemy.capture.progressMs)}ms</p>)}
            </details>}
        </main>
    );
}
