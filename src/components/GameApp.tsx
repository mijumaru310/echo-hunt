import type {ReactElement} from "react";
import {useState} from "react";
import TitleScreen from "./TitleScreen.tsx";
import GameScreen from "./GameScreen.tsx";

type Screen = "title" | "game";

export default function GameApp(): ReactElement {
    const [screen, setScreen] = useState<Screen>("title");

    function startGame(): void {
        setScreen("game");
    }

    if (screen === "title") {
        return <TitleScreen onStart={startGame} />;
    }

    return <GameScreen />;
}