import { useCallback, useEffect, useRef, useState } from "react";
import { loadSettings, saveSettings } from "../game/storage.ts";

/** Menu music starts on a gesture and stops before setup/combat, or on tab hide. */
export function useMenuMusic(active: boolean) {
    const [enabled, setEnabled] = useState(() => loadSettings().music);
    const [blocked, setBlocked] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const unlocked = useRef(false);
    const request = useRef(0);

    const updatePlayback = useCallback(() => {
        const generation = ++request.current;
        if (!active || !enabled || !unlocked.current || document.hidden) {
            audioRef.current?.pause();
            return;
        }
        const audio = audioRef.current ?? new Audio("/sounds/original/mansion-theme.wav");
        audioRef.current = audio;
        audio.loop = true;
        audio.volume = loadSettings().volume * 0.25;
        if (!audio.paused) return;
        void audio.play().then(() => {
            if (generation === request.current) setBlocked(false);
        }).catch((error: unknown) => {
            // Switching screens while loading aborts play normally. Music must
            // never block sensor setup or the game's essential directional audio.
            if (generation === request.current && !(error instanceof DOMException && error.name === "AbortError")) setBlocked(true);
        });
    }, [active, enabled]);

    useEffect(() => {
        updatePlayback();
        function unlock(event: Event): void {
            if (event instanceof KeyboardEvent && !["Enter", " "].includes(event.key)) return;
            unlocked.current = true;
            updatePlayback();
        }
        function visibility(): void { updatePlayback(); }
        window.addEventListener("pointerdown", unlock, true);
        window.addEventListener("keydown", unlock, true);
        document.addEventListener("visibilitychange", visibility);
        function stop(): void { ++request.current; audioRef.current?.pause(); }
        window.addEventListener("pagehide", stop);
        return () => {
            window.removeEventListener("pointerdown", unlock, true);
            window.removeEventListener("keydown", unlock, true);
            document.removeEventListener("visibilitychange", visibility);
            window.removeEventListener("pagehide", stop);
        };
    }, [updatePlayback]);
    useEffect(() => () => {
        ++request.current;
        audioRef.current?.pause();
        audioRef.current?.removeAttribute("src");
        audioRef.current?.load();
        audioRef.current = null;
    }, []);

    function toggle(): void {
        unlocked.current = true;
        if (enabled && blocked) { updatePlayback(); return; }
        const music = !enabled;
        saveSettings({ ...loadSettings(), music });
        setEnabled(music);
    }
    return { enabled, blocked, toggle };
}
