import { useCallback, useState } from "react";
import type { ReactElement } from "react";
import type { GameDifficulty, GameResult } from "../game/types.ts";
import { getStage } from "../game/stages.ts";
import { saveResult } from "../game/storage.ts";
import TitleScreen from "./TitleScreen.tsx";
import GameScreen from "./GameScreen.tsx";
import ResultScreen from "./ResultScreen.tsx";
import type { SavedResult } from "./ResultScreen.tsx";
import "./game.css";

export default function GameApp(): ReactElement {
    const [screen, setScreen] = useState<"title" | "game" | "result">("title");
    const [stageId, setStageId] = useState("mansion");
    const [difficulty, setDifficulty] = useState<GameDifficulty>("easy");
    const [sessionId, setSessionId] = useState(0);
    const [result, setResult] = useState<SavedResult | null>(null);
    const finishGame = useCallback((next: GameResult): void => {
        setResult({ ...next, ...saveResult(next) });
        setScreen("result");
    }, []);

    function startGame(id: string, nextDifficulty: GameDifficulty): void {
        setStageId(id); setDifficulty(nextDifficulty); setSessionId((value) => value + 1); setScreen("game");
    }
    if (screen === "title") return <TitleScreen initialStageId={stageId} initialDifficulty={difficulty} onStart={startGame} />;
    if (screen === "result" && result) return <ResultScreen result={result} onRestart={() => startGame(stageId, difficulty)} onTitle={() => setScreen("title")} />;
    return <GameScreen key={sessionId} stage={getStage(stageId)} difficulty={difficulty} onFinish={finishGame} onTitle={() => setScreen("title")} />;
}
