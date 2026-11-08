import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// ブラウザ不要の描画スモークテスト。実機の定位・レイアウト確認は別途行う。
test("タイトル・準備・リザルトが描画でき、通常画面に敵の正確な位置を出さない", async () => {
    const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: "custom" });
    try {
        const { default: Title } = await server.ssrLoadModule("/src/components/TitleScreen.tsx");
        const { default: Game } = await server.ssrLoadModule("/src/components/GameScreen.tsx");
        const { default: Result } = await server.ssrLoadModule("/src/components/ResultScreen.tsx");
        const { default: Overlay } = await server.ssrLoadModule("/src/components/CombatOverlay.tsx");
        const { GameEngine } = await server.ssrLoadModule("/src/game/GameEngine.ts");
        const { getStage } = await server.ssrLoadModule("/src/game/stages.ts");
        const noop = () => {};
        const title = renderToStaticMarkup(React.createElement(Title, { initialStageId: "mansion", onStart: noop }));
        assert.match(title, /第一夜・洋館/);
        assert.match(title, /練習・近づく足音/);
        assert.match(title, /第二夜・閉ざされた廊下/);
        assert.match(title, /ノーマル/);
        assert.match(title, /第三夜・開かずの間/);
        const titleOptions = (markup) => [...markup.matchAll(/<button\b([^>]*data-stage-id="[^"]+"[^>]*)>([\s\S]*?)<\/button>/g)]
            .map((match) => ({ attrs: match[1], text: match[2] }));
        const initialOptions = titleOptions(title);
        for (const id of ["sealed-hall", "boss-room"]) {
            assert.match(initialOptions.find((option) => option.attrs.includes(`data-stage-id="${id}"`)).attrs, /disabled/);
        }
        for (const id of ["mansion", "stationary", "moving", "approaching"]) {
            assert.doesNotMatch(initialOptions.find((option) => option.attrs.includes(`data-stage-id="${id}"`)).attrs, /disabled/);
        }
        const lockedInitial = renderToStaticMarkup(React.createElement(Title, { initialStageId: "boss-room", onStart: noop }));
        assert.match(titleOptions(lockedInitial).find((option) => option.attrs.includes('data-stage-id="mansion"')).attrs, /aria-pressed="true"/);
        const unlockedTitle = renderToStaticMarkup(React.createElement(Title, {
            initialStageId: "sealed-hall", unlockedStageIds: ["mansion", "sealed-hall", "stationary", "moving", "approaching"], onStart: noop,
        }));
        assert.match(titleOptions(unlockedTitle).find((option) => option.attrs.includes('data-stage-id="sealed-hall"')).attrs, /aria-pressed="true"/);
        assert.doesNotMatch(title, /A HORROR EXPERIENCE|WAVES|THE LISTENING DARK/);
        const setup = renderToStaticMarkup(React.createElement(Game, { stage: getStage("mansion"), onFinish: noop, onTitle: noop }));
        assert.doesNotMatch(setup, /PCのスライダーで試す/);
        assert.match(setup, /プレイ前の確認/);
        assert.match(setup, /ゲーム開始/);
        assert.doesNotMatch(setup, /BEFORE THE HUNT|音の向こうへ/);
        assert.doesNotMatch(setup, /worldYaw|enemy-1|敵の方向|開発用・敵の状態/);
        const normalSetup = renderToStaticMarkup(React.createElement(Game, { stage: getStage("mansion"), difficulty: "normal", onFinish: noop, onTitle: noop }));
        assert.match(normalSetup, /空振り後は約0.65秒/);
        assert.doesNotMatch(normalSetup, /ピッと鳴ったら|合図が鳴ったら/);

        const normal = new GameEngine(getStage("stationary"), () => 0.5, "normal");
        normal.start(); normal.update(600, 0);
        const snapshot = normal.snapshot();
        const overlay = (view) => renderToStaticMarkup(React.createElement(Overlay, {
            snapshot: view, phase: "playing", playerYaw: 0, countdown: 3, feedback: null, onAttack: noop,
        }));
        const blind = overlay(snapshot);
        assert.doesNotMatch(blind, /<svg|reticle-progress|is-locked|disabled/);
        assert.doesNotMatch(blind, /LISTEN|TURN|STRIKE/);
        for (const yaw of [-90, 0, 90, 180]) {
            const moved = structuredClone(snapshot);
            moved.enemies[0].worldYaw = yaw;
            moved.enemies[0].capture.progressMs = 700;
            moved.targetId = moved.enemies[0].id;
            assert.equal(overlay(moved), blind);
        }
        assert.equal(overlay({ ...snapshot, enemies: [], targetId: null }), blind);
        const easy = new GameEngine(getStage("stationary"), () => 0.5);
        easy.start(); easy.update(1300, 0);
        assert.match(overlay(easy.snapshot()), /reticle-progress/);
        assert.match(overlay(easy.snapshot()), /is-locked/);
        assert.match(overlay(easy.snapshot()), /画面のどこでもタップ/);
        assert.doesNotMatch(overlay(easy.snapshot()), /disabled/);
        for (const reason of ["cleared", "defeated", "time"]) {
            const result = renderToStaticMarkup(React.createElement(Result, {
                result: { stageId: "mansion", difficulty: "normal", shots: 10, misses: 1, stageName: "第一夜・洋館", reason, score: 1000, bestScore: 1000, isNewRecord: true,
                    defeated: 9, maxCombo: 9, life: 3, maxLife: 3, elapsedMs: 20000, waveCount: 3, wavesCleared: 3 },
                onRestart: noop, onTitle: noop, onNextStage: noop,
            }));
            assert.match(result, /自己ベスト更新/);
            assert.doesNotMatch(result, /THE NIGHT IS OVER|LOST IN THE DARK|闇を覚えた/);
            assert.match(result, /最大連続撃破/);
            assert.match(result, /命中率 90%/);
            if (reason === "cleared") assert.match(result, /次のステージへ/);
            else assert.doesNotMatch(result, /次のステージへ/);
        }
    } finally { await server.close(); }
});

test("PC確認用の入力は開発用URLだけで選択できる", async () => {
    const originalWindow = globalThis.window;
    try {
        for (const [search, available] of [["", false], ["?debug=0", false], ["?debug=1", true]]) {
            globalThis.window = { location: { search } };
            const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: "custom" });
            try {
                const { default: Game } = await server.ssrLoadModule("/src/components/GameScreen.tsx");
                const { getStage } = await server.ssrLoadModule("/src/game/stages.ts");
                const markup = renderToStaticMarkup(React.createElement(Game, {
                    stage: getStage("mansion"), onFinish: () => {}, onTitle: () => {},
                }));
                assert.equal(markup.includes("PCのスライダーで試す"), available);
                assert.match(markup, /スマホのセンサーを接続/);
                assert.match(markup, /disabled=""[^>]*>ゲーム開始/);
            } finally { await server.close(); }
        }
    } finally {
        if (originalWindow === undefined) delete globalThis.window;
        else globalThis.window = originalWindow;
    }
});
