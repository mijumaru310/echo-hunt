
import { useEffect, useRef, useState } from "react";
import { SpatialAudio } from "./audio/SpatialAudioEngine";

function App() {
  const audio = useRef<SpatialAudio | null>(null);
  const [angle, setAngle] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    return () => {
      void audio.current?.stop();
      audio.current = null;
    };
  }, []);

  async function startAudio() {
    try {
      setError("");
      const engine = new SpatialAudio();
      audio.current = engine;
      await engine.start();
      engine.setDirection(angle);
      setPlaying(true);
    } catch (err) {
      setError(String(err));
    }
  }

  async function stopAudio() {
    await audio.current?.stop();
    audio.current = null;
    setPlaying(false);
  }

  function changeAngle(value: number) {
    setAngle(value);
    audio.current?.setDirection(value);
  }

  return (
    <main style={{ padding: 24 }}>
      <h1>ECHO HUNT - Audio Test</h1>
      <p>イヤホンを装着し、小さい音量から開始してください。</p>

      <button
        onClick={playing ? stopAudio : startAudio}
      >
        {playing ? "音を停止" : "音を開始"}
      </button>

      <h2>音源角度: {angle}°</h2>

      <input
        type="range"
        min="-180"
        max="180"
        step="5"
        value={angle}
        onChange={(e) =>
          changeAngle(Number(e.target.value))
        }
        style={{ width: "100%" }}
      />

      <p>0° 正面 / 90° 右 / ±180° 後方 / -90° 左</p>
      {error && <p role="alert">{error}</p>}
    </main>
  );
}

export default App;
