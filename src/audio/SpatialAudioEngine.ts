
export class SpatialAudio {
  private ctx: AudioContext | null = null;
  private panner: PannerNode | null = null;
  private source: AudioBufferSourceNode | null = null;

  async start() {
    if (this.ctx) {
      await this.ctx.resume();
      return;
    }

    const ctx = new AudioContext();

    const panner = new PannerNode(ctx, {
      panningModel: "HRTF",
      distanceModel: "inverse",
      refDistance: 1,
      rolloffFactor: 0,
    });

    const gain = new GainNode(ctx, { gain: 0.035 });

    panner.connect(gain).connect(ctx.destination);

    // テスト用の広帯域ノイズを生成
    const buffer = ctx.createBuffer(
      1, ctx.sampleRate * 2, ctx.sampleRate
    );
    const samples = buffer.getChannelData(0);

    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.random() * 2 - 1;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(panner);
    source.start();

    this.ctx = ctx;
    this.panner = panner;
    this.source = source;

    this.setDirection(0);
    await ctx.resume();
  }

  setDirection(
    azimuthDeg: number,
    elevationDeg = 0,
    distance = 2
  ) {
    if (!this.ctx || !this.panner) return;

    const az = azimuthDeg * Math.PI / 180;
    const el = elevationDeg * Math.PI / 180;

    const x = distance * Math.cos(el) * Math.sin(az);
    const y = distance * Math.sin(el);
    const z = -distance * Math.cos(el) * Math.cos(az);

    const t = this.ctx.currentTime;

    this.panner.positionX.setTargetAtTime(x, t, 0.03);
    this.panner.positionY.setTargetAtTime(y, t, 0.03);
    this.panner.positionZ.setTargetAtTime(z, t, 0.03);
  }

  async stop() {
    this.source?.stop();
    await this.ctx?.close();

    this.source = null;
    this.panner = null;
    this.ctx = null;
  }
}
