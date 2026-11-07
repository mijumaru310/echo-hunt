export type CueKind = "strike" | "collapse" | "warning" | "damage" | "wave" | "clear" | "game-over" | "countdown";

/** オリジナルの合成SE。外部素材やネットワーク取得を必要としない。 */
export function createCueBuffer(ctx: AudioContext, kind: CueKind): AudioBuffer {
    const durations: Record<CueKind, number> = {
        strike: 0.2, collapse: 0.65, warning: 0.65, damage: 0.4,
        wave: 0.85, clear: 1.25, "game-over": 1.15, countdown: 0.15,
    };
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * durations[kind]), ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    let filteredNoise = 0;
    for (let i = 0; i < samples.length; i++) {
        const t = i / ctx.sampleRate;
        const attack = Math.min(1, t / 0.006);
        const end = Math.min(1, (samples.length - i) / (ctx.sampleRate * 0.03));
        const noise = Math.random() * 2 - 1;
        filteredNoise = filteredNoise * 0.86 + noise * 0.14;
        let value = 0;
        switch (kind) {
            case "strike":
                value = (noise * 0.5 + Math.sin(2 * Math.PI * (160 * t - 210 * t * t)) * 0.7) * Math.exp(-t * 28);
                break;
            case "collapse":
                value = (filteredNoise * 1.6 + Math.sin(2 * Math.PI * (210 * t - 100 * t * t)) * 0.22) * Math.exp(-t * 6)
                    + Math.sin(2 * Math.PI * 920 * t) * Math.exp(-t * 13) * 0.12;
                break;
            case "warning":
                value = (Math.sin(2 * Math.PI * (100 * t + 95 * t * t)) * 0.45 + filteredNoise * 0.8)
                    * Math.sin(Math.PI * t / durations[kind]) * (0.65 + Math.sin(t * 47) * 0.2);
                break;
            case "damage":
                value = (Math.sin(2 * Math.PI * 65 * t) * 0.8 + filteredNoise) * Math.exp(-t * 11);
                break;
            case "wave":
                value = [330, 440].reduce((sum, hz, index) => {
                    const local = t - index * 0.18;
                    return sum + (local >= 0 ? Math.sin(2 * Math.PI * hz * local) * Math.exp(-local * 7) * 0.32 : 0);
                }, 0);
                break;
            case "clear":
                value = [440, 554, 660, 880].reduce((sum, hz, index) => {
                    const local = t - index * 0.14;
                    return sum + (local >= 0 ? Math.sin(2 * Math.PI * hz * local) * Math.exp(-local * 5) * 0.28 : 0);
                }, 0);
                break;
            case "game-over":
                value = (Math.sin(2 * Math.PI * (180 * t - 55 * t * t)) * 0.5 + filteredNoise * 0.4) * Math.exp(-t * 3);
                break;
            case "countdown":
                value = Math.sin(2 * Math.PI * 550 * t) * Math.exp(-t * 25) * 0.35;
        }
        samples[i] = Math.tanh(value) * attack * end;
    }
    return buffer;
}
