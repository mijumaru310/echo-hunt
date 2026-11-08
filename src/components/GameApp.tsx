import { useCallback, useState } from "react";
import type { ReactElement } from "react";
import type { GameDifficulty, GameResult, StageDefinition } from "../game/types.ts";
import { getStage } from "../game/stages.ts";
import { saveResult } from "../game/storage.ts";
import { getNextStage, getUnlockedStageIds } from "../game/progression.ts";
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
    const [sessionClearedIds, setSessionClearedIds] = useState<readonly string[]>([]);
    const unlockedStageIds: readonly string[] = getUnlockedStageIds(sessionClearedIds);
    const finishGame = useCallback((next: GameResult): void => {
        setResult({ ...next, ...saveResult(next) });
        if (next.reason === "cleared") {
            setSessionClearedIds((previous: readonly string[]): readonly string[] =>
                previous.includes(next.stageId) ? previous : [...previous, next.stageId]);
        }
        setScreen("result");
    }, []);

    function startGame(id: string, nextDifficulty: GameDifficulty): void {
        if (!unlockedStageIds.includes(id)) return;
        setStageId(id); setDifficulty(nextDifficulty); setSessionId((value) => value + 1); setScreen("game");
    }
    if (screen === "title") return <TitleScreen initialStageId={stageId} initialDifficulty={difficulty}
        unlockedStageIds={unlockedStageIds} onStart={startGame} />;
    if (screen === "result" && result) {
        const nextStage: StageDefinition | null = result.reason === "cleared" ? getNextStage(result.stageId) : null;
        return <ResultScreen result={result} onRestart={() => startGame(stageId, difficulty)}
            onTitle={() => setScreen("title")}
            onNextStage={nextStage && unlockedStageIds.includes(nextStage.id)
                ? (): void => startGame(nextStage.id, difficulty) : undefined} />;
    }
    return <GameScreen key={sessionId} stage={getStage(stageId)} difficulty={difficulty} onFinish={finishGame} onTitle={() => setScreen("title")} />;
}
