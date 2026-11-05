import type {ReactElement} from "react";
import {useState} from "react";
import type { EnemyMode } from "../game/types.ts";
import TitleScreen from "./TitleScreen.tsx";
import GameScreen from "./GameScreen.tsx";
import ResultScreen from "./ResultScreen.tsx";
import "./game.css";
type Screen = "title" | "game" | "result";

export default function GameApp(): ReactElement {
    const [screen, setScreen] = useState<Screen>("title");
    const [ResultScore, setResultScore] = useState<number>(0);
    const [enemyMode, setEnemyMode] = useState<EnemyMode>("stationary");

    function startGame(nextMode: EnemyMode): void {
        setEnemyMode(nextMode);
        setScreen("game");
    }

    function restartGame(): void {
        setScreen("game");
    }

    function finishGame(score: number): void {
        setResultScore(score);
        setScreen("result");
    }

    function showTitle(): void {
        setScreen("title");
    }       
    
    if (screen === "title") {
        return <TitleScreen onStart={startGame} />;
    }

    if (screen === "result") {
        return (
            <ResultScreen 
                score={ResultScore} 
                onRestart={restartGame} 
                onTitle={showTitle}
            />
        );
    }

    return <GameScreen onFinish={finishGame} enemyMode={enemyMode} />;
}
