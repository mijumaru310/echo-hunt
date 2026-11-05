import type {ReactElement} from "react";
import {useState} from "react";
import TitleScreen from "./TitleScreen.tsx";
import GameScreen from "./GameScreen.tsx";
import ResultScreen from "./ResultScreen.tsx";
type Screen = "title" | "game" | "result";

export default function GameApp(): ReactElement {
    const [screen, setScreen] = useState<Screen>("title");
    const [ResultScore, setResultScore] = useState<number>(0);

    function startGame(): void {
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
                onRestart={startGame} 
                onTitle={showTitle}
            />
        );
    }

    return <GameScreen onFinish={finishGame} />;
}