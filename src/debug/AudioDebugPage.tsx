
import { useEffect, useRef, useState } from "react";
//音のてすと用

type AudioGraph = {
  context: AudioContext;
  oscillator: OscillatorNode;
  panner: PannerNode;
};

export default function AudioDebugPage() {
  const graph = useRef<AudioGraph | null>(null);
  const [angle, setAngle] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");

  // 音源の位置を変更する
  function updatePosition(deg: number, panner?: PannerNode) {
    const node = panner ?? graph.current?.panner;
    if (!node) return;

    const rad = deg * Math.PI / 180;
    const distance = 2;

    node.positionX.value = distance * Math.sin(rad);
    node.positionY.value = 0;
    node.positionZ.value = -distance * Math.cos(rad);
  }

  // 音の再生開始
  async function startAudio() {
    if (graph.current) return;

    setError("");

    try {
      // ① 音響処理全体を管理
      const context = new AudioContext();

      // ② 440Hzの電子音を生成
      const oscillator = context.createOscillator();
      oscillator.type = "triangle";
      oscillator.frequency.value = 440;

      // ③ 3D立体音響を設定
      const panner = context.createPanner();
      panner.panningModel = "HRTF";
      panner.distanceModel = "inverse";
      panner.rolloffFactor = 0;

      // ④ 音量を小さくする
      const gain = context.createGain();
      gain.gain.value = 0.03;

      // ⑤ 音源 → 立体音響 → 音量 → 出力
      oscillator.connect(panner);
      panner.connect(gain);
      gain.connect(context.destination);

      updatePosition(angle, panner);

      graph.current = { context, oscillator, panner };

      await context.resume();
      oscillator.start();
      setPlaying(true);
    } catch (err) {
      setError(String(err));
      const g = graph.current;
      graph.current = null;
      if (g) void g.context.close();
    }
  }

  // 音を停止
  function stopAudio() {
    const g = graph.current;
    if (!g) return;

    g.oscillator.stop();
    void g.context.close();
    graph.current = null;
    setPlaying(false);
  }

  useEffect(() => {
    return () => {
      const g = graph.current;
      if (g) {
        g.oscillator.stop();
        void g.context.close();
        graph.current = null;
      }
    };
  }, []);

  return (
    <main style={{ padding: 24, maxWidth: 600, margin: "auto" }}>
      <h1>ECHO HUNT - Audio Test</h1>

      <p>イヤホンを装着し、小さい音量で開始してください。</p>

      <button onClick={playing ? stopAudio : startAudio}>
        {playing ? "音を停止" : "音を開始"}
      </button>

      <h2>音源の角度：{angle}°</h2>

      <input
        type="range"
        min="-180"
        max="180"
        step="5"
        value={angle}
        onChange={(e) => {
          const next = Number(e.target.value);
          setAngle(next);
          updatePosition(next);
        }}
        style={{ width: "100%" }}
      />

      <p>0°：正面 / 90°：右 / -90°：左 / 180°：後ろ</p>
      {error && <p role="alert">{error}</p>}
    </main>
  );
}
