import type { ReactElement } from "react";
import { useGameSession } from "../game/useGameSession.ts";
import { enemyDefinitions } from "../game/enemies.ts";
import { isDebug } from "../game/config.ts";
import { stageBackgroundStyle } from "./stagePresentation.ts";
import type { GameDifficulty, GameResult, StageDefinition } from "../game/types.ts";
import type { GameSettings } from "../game/storage.ts";
import { difficultyRules } from "../game/difficulty.ts";
import CombatOverlay from "./CombatOverlay.tsx";

interface GameScreenProps {
    stage: StageDefinition;
    difficulty?: GameDifficulty;
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

export default function GameScreen({ stage, difficulty = "easy", onFinish, onTitle }: GameScreenProps): ReactElement {
    const game = useGameSession(stage, difficulty, onFinish);
    const { snapshot, phase, feedback } = game;
    const boss = snapshot.enemies.find((enemy) => enemyDefinitions[enemy.kind].boss);
    const bossStage = stage.waves.some((wave) => wave.enemies.some((spawn) => enemyDefinitions[spawn.kind].boss));
    const inputLabels = { idle: "未接続", permission: "許可を確認中", waiting: "スマホを少し動かしてください", sensor: "接続済み", pc: "PC操作", error: "再接続してください" };
    const hasInputPending = game.inputStatus === "permission" || game.inputStatus === "waiting";

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
                    <h1>プレイ前の確認</h1>
                    <p className="stage-caption">{stage.name} · {difficultyRules[difficulty].label}</p>
                    <ol className="setup-instructions">
                        <li>イヤホンをつけ、足音が右から聞こえるか確かめる。</li>
                        <li>スマホを顔の正面に持ち、体ごと向きを変える。</li>
                        <li>{difficulty === "easy" ? "ゲージが満ちてピッと鳴ったらタップ。" : "音で方向を判断してタップ。空振り後は約0.65秒、攻撃できません。"}命中音のあと、敵の気配が消える。</li>
                    </ol>
                    <p className="stage-tip">{difficulty === "normal" && stage.id === "mansion" ? "ロックの合図はありません。足音を正面に捉え、自分で攻撃を決めてください。鋭い唸り声は攻撃の前触れ。" : stage.hint}</p>
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
                    <p className="setup-footnote">3秒の合図のあとに開始します。ライフ {stage.initialLife} ／ {bossStage ? "ボス1体" : stage.mode === "waves" ? "全" + stage.waves.length + "波" : (stage.durationMs ?? 0) / 1000 + "秒"}</p>
                    {game.message && <p role="status">{game.message}</p>}
                </div>
            </main>
        );
    }

    return (
        <main className="echo-game hunt-screen" data-paused={phase === "paused"} data-feedback={feedback?.kind ?? "none"}
            data-difficulty={difficulty} data-horror={Boolean(stage.haunting)} data-boss={Boolean(boss)}
            style={stageBackgroundStyle(stage.background)}
            tabIndex={-1} aria-label="ECHO HUNT 探索中">
            <div className="mansion-panorama" aria-hidden="true"
                style={{ backgroundPositionX: "calc(50% - var(--room-width) * " + (game.roomOriginYaw + game.playerYaw) / 360 + ")" }} />
            <div className="hunt-shade" aria-hidden="true" />
            {stage.haunting && <div className="horror-mist" aria-hidden="true" />}
            {game.haunting && phase === "playing" && <div key={game.haunting.id} className="horror-veil" aria-hidden="true"><div className="passing-shadow" /></div>}

            <header className="game-hud">
                <div className="hud-stage"><span className="eyebrow">{difficultyRules[difficulty].label} · {bossStage ? "ボス戦" : stage.mode === "waves" ? "第" + (snapshot.waveIndex + 1) + "波 / 全" + snapshot.waveCount + "波" : "練習"}</span><span>{stage.mode === "waves" ? snapshot.waveName : stage.name}</span></div>
                <button className="pause-button" type="button" onClick={game.pause} aria-label="一時停止" disabled={phase === "paused" || phase === "finished"}>Ⅱ</button>
                <div className="life-meter" role="img" aria-label={"ライフ " + snapshot.life + " / " + snapshot.maxLife} data-invincible={snapshot.invincibleMs > 0}>
                    <span className="hud-label">ライフ</span>
                    <span className="life-symbols" aria-hidden="true">{Array.from({ length: snapshot.maxLife }, (_, index) => <span key={index} className={index < snapshot.life ? "life is-alive" : "life"}>◆</span>)}</span>
                </div>
                <div className="hud-score"><span className="hud-label">得点</span><strong>{snapshot.score.toLocaleString()}</strong></div>
                <div className="hud-progress"><span className="hud-label">{snapshot.remainingMs !== null ? "残り時間" : "撃破"}</span><strong>{snapshot.remainingMs !== null ? Math.ceil(snapshot.remainingMs / 1000) + "秒" : snapshot.defeated}</strong></div>
            </header>
            {boss && phase !== "paused" && <div className="boss-status" role="img" aria-label={`${enemyDefinitions[boss.kind].name} 体力 ${boss.health} / ${boss.maxHealth}`}>
                <span>{enemyDefinitions[boss.kind].name}</span><span className="boss-health" aria-hidden="true">{Array.from({ length: boss.maxHealth }, (_, index) => <i key={index} className={index < boss.health ? "is-alive" : ""} />)}</span>
            </div>}

            {phase !== "paused" && <CombatOverlay snapshot={snapshot} phase={phase} playerYaw={game.playerYaw}
                countdown={game.countdown} feedback={feedback} onAttack={game.attack} />}

            {phase === "paused" && (
                <section className="pause-panel" aria-labelledby="pause-title">
                    <h1 id="pause-title">一時停止中</h1>
                    <p className="pause-hint">敵と時間の進行を止めています。</p>
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
                {snapshot.phantoms.map((phantom) => <p key={phantom.id}>開発用フェイク：{phantom.worldYaw.toFixed(1)}° / 距離{phantom.distance}</p>)}
                {snapshot.enemies.map((enemy) => <p key={enemy.id}>{enemy.id}・{enemyDefinitions[enemy.kind].name}：{enemy.worldYaw.toFixed(1)}° / 距離{enemy.distance.toFixed(2)} / {enemy.phase} / 体力{enemy.health}/{enemy.maxHealth} / {Math.round(enemy.capture.progressMs)}ms</p>)}
            </details>}
        </main>
    );
}
