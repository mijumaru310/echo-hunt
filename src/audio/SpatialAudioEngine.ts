
export type PlayEnemyOptions = {
  loop?: boolean;
  volume?: number;
  azimuthDeg?: number;
  elevationDeg?: number;
  distance?: number;
};

type EnemySound = {
  source: AudioBufferSourceNode;
  panner: PannerNode;
  gain: GainNode;
};

const LEGACY_ID = "__legacy_debug_noise__";

export class SpatialAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  // 敵ID -> 再生中の音源
  private sounds = new Map<string, EnemySound>();

  // URL -> 読み込み済み・読み込み中のAudioBuffer
  private bufferCache = new Map<string, Promise<AudioBuffer>>();

  // 非同期読み込み中の停止・再生し直しを管理
  private pending = new Map<string, number>();
  private requestSequence = 0;

  // ① AudioContextを初期化
  async initialize(): Promise<void> {
    if (this.ctx && this.ctx.state !== "closed") {
      await this.ctx.resume();
      return;
    }

    const ctx = new AudioContext({
      latencyHint: "interactive",
    });

    this.ctx = ctx;

    // 最終的な出力音量
    this.masterGain = new GainNode(ctx, {
      gain: 0.2,
    });

    this.masterGain.connect(ctx.destination);

    await ctx.resume();
  }

  // ② WAVなどの音声ファイルを読み込む
  private async loadBuffer(
    url: string,
    ctx: AudioContext
  ): Promise<AudioBuffer> {
    const cached = this.bufferCache.get(url);
    if (cached) return cached;

    const task = (async () => {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          `音声ファイル取得失敗: ${url} (${response.status})`
        );
      }

      const arrayBuffer = await response.arrayBuffer();

      return ctx.decodeAudioData(arrayBuffer);
    })();

    this.bufferCache.set(url, task);

    try {
      return await task;
    } catch (error) {
      // 失敗したファイルは再試行できるようにする
      if (this.bufferCache.get(url) === task) {
        this.bufferCache.delete(url);
      }
      throw error;
    }
  }

  // 音源ごとのノードを作成して再生する
  private createSound(
    id: string,
    buffer: AudioBuffer,
    options: PlayEnemyOptions = {}
  ): void {
    const ctx = this.ctx;
    const masterGain = this.masterGain;

    if (!ctx || !masterGain) {
      throw new Error("AudioContextが未初期化です");
    }

    const source = ctx.createBufferSource();

    source.buffer = buffer;
    source.loop = options.loop ?? true;

    const panner = new PannerNode(ctx, {
      panningModel: "HRTF",

      // 距離による音量減衰を有効化
      distanceModel: "inverse",
      refDistance: 1,
      maxDistance: 30,
      rolloffFactor: 1,
    });

    // 敵ごとの音量
    const gain = new GainNode(ctx, {
      gain: Math.max(0, Math.min(1, options.volume ?? 0.4)),
    });

    // 音源 → 空間音響 → 個別音量 → 全体音量
    source.connect(panner);
    panner.connect(gain);
    gain.connect(masterGain);

    const sound: EnemySound = {
      source,
      panner,
      gain,
    };

    this.sounds.set(id, sound);

    // 最初の位置を設定してから再生
    this.setEnemyPosition(
      id,
      options.azimuthDeg ?? 0,
      options.elevationDeg ?? 0,
      options.distance ?? 2
    );

    // ループしない音が自然終了した場合も後片付け
    source.onended = () => {
      if (this.sounds.get(id) !== sound) return;

      this.sounds.delete(id);
      source.disconnect();
      panner.disconnect();
      gain.disconnect();
    };

    source.start();
  }

  // ③ 敵の音を再生
  async playEnemy(
    id: string,
    soundUrl: string,
    options: PlayEnemyOptions = {}
  ): Promise<void> {
    await this.initialize();

    // 同じIDがあれば既存音源を停止
    this.stopEnemy(id);

    const ctx = this.ctx;
    if (!ctx) {
      throw new Error("AudioContextがありません");
    }

    const requestId = ++this.requestSequence;
    this.pending.set(id, requestId);

    const buffer = await this.loadBuffer(soundUrl, ctx);

    // 読み込み中に停止・破棄された場合は再生しない
    if (
      this.ctx !== ctx ||
      this.pending.get(id) !== requestId
    ) {
      return;
    }

    this.pending.delete(id);

    this.createSound(id, buffer, options);
  }

  // ④ 敵の位置を変更
  // azimuth: 0=正面, +90=右, -90=左
  // elevation: +90=上, -90=下
  // distance: リスナーからの距離
  setEnemyPosition(
    id: string,
    azimuthDeg: number,
    elevationDeg = 0,
    distance = 2
  ): void {
    const sound = this.sounds.get(id);
    if (!sound) return;

    if (
      !Number.isFinite(azimuthDeg) ||
      !Number.isFinite(elevationDeg) ||
      !Number.isFinite(distance)
    ) {
      return;
    }

    const az = azimuthDeg * Math.PI / 180;
    const el = elevationDeg * Math.PI / 180;

    const r = Math.max(0.1, distance);

    // Web Audio APIの座標
    // +X=右, +Y=上, -Z=正面
    const x = r * Math.cos(el) * Math.sin(az);
    const y = r * Math.sin(el);
    const z = -r * Math.cos(el) * Math.cos(az);

    // 低遅延を優先して直接変更
    sound.panner.positionX.value = x;
    sound.panner.positionY.value = y;
    sound.panner.positionZ.value = z;
  }

  // ⑤ 個別の敵の音量を変更
  setEnemyVolume(id: string, volume: number): void {
    const sound = this.sounds.get(id);
    if (!sound || !Number.isFinite(volume)) return;

    sound.gain.gain.value =
      Math.max(0, Math.min(1, volume));
  }

  // ⑥ 敵の音を停止
  stopEnemy(id: string): void {
    // 読み込み中の再生要求も無効化
    this.pending.delete(id);

    const sound = this.sounds.get(id);
    if (!sound) return;

    this.sounds.delete(id);
    sound.source.onended = null;

    try {
      sound.source.stop();
    } catch {
      // 停止済みのときは何もしない
    }

    sound.source.disconnect();
    sound.panner.disconnect();
    sound.gain.disconnect();
  }

  // ⑦ 全体を終了
  async dispose(): Promise<void> {
    this.pending.clear();

    for (const id of [...this.sounds.keys()]) {
      this.stopEnemy(id);
    }

    this.bufferCache.clear();

    const ctx = this.ctx;
    this.ctx = null;

    this.masterGain?.disconnect();
    this.masterGain = null;

    if (ctx && ctx.state !== "closed") {
      await ctx.close();
    }
  }

  // ──────────────────────────
  // 旧デバッグ画面との互換性
  // ──────────────────────────

  async start(): Promise<void> {
    await this.initialize();

    if (this.sounds.has(LEGACY_ID)) return;

    const ctx = this.ctx;
    if (!ctx) return;

    const buffer = ctx.createBuffer(
      1,
      ctx.sampleRate * 2,
      ctx.sampleRate
    );

    const samples = buffer.getChannelData(0);

    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.random() * 2 - 1;
    }

    this.createSound(LEGACY_ID, buffer, {
      volume: 0.4,
      distance: 2,
      loop: true,
    });
  }

  setDirection(
    azimuthDeg: number,
    elevationDeg = 0,
    distance = 2
  ): void {
    this.setEnemyPosition(
      LEGACY_ID,
      azimuthDeg,
      elevationDeg,
      distance
    );
  }

  async stop(): Promise<void> {
    await this.dispose();
  }
}
