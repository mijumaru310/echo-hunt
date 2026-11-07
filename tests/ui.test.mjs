import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// ブラウザ不要の描画スモークテスト。実機の定位・レイアウト確認は別途行う。
test("タイトル・準備・リザルトが描画でき、通常画面に敵の正確な位置を出さない", async () => {
    const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
    try {
        const { default: Title } = await server.ssrLoadModule("/src/components/TitleScreen.tsx");
        const { default: Game } = await server.ssrLoadModule("/src/components/GameScreen.tsx");
        const { default: Result } = await server.ssrLoadModule("/src/components/ResultScreen.tsx");
        const { getStage } = await server.ssrLoadModule("/src/game/stages.ts");
        const noop = () => {};
        const title = renderToStaticMarkup(React.createElement(Title, { initialStageId: "mansion", onStart: noop }));
        assert.match(title, /第一夜・洋館/);
        assert.match(title, /練習・近づく足音/);
        const setup = renderToStaticMarkup(React.createElement(Game, { stage: getStage("mansion"), onFinish: noop, onTitle: noop }));
        assert.match(setup, /PCのスライダーで試す/);
        assert.match(setup, /この向きを正面にして開始/);
        assert.doesNotMatch(setup, /worldYaw|enemy-1|敵の方向|開発用・敵の状態/);
        for (const reason of ["cleared", "defeated", "time"]) {
            const result = renderToStaticMarkup(React.createElement(Result, {
                result: { stageName: "第一夜・洋館", reason, score: 1000, bestScore: 1000, isNewRecord: true,
                    defeated: 9, maxCombo: 9, life: 3, maxLife: 3, elapsedMs: 20000, waveCount: 3, wavesCleared: 3 },
                onRestart: noop, onTitle: noop,
            }));
            assert.match(result, /NEW BEST/);
            assert.match(result, /最大連続撃破/);
        }
    } finally { await server.close(); }
});
