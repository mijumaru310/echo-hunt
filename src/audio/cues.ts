export const cueKinds = ["strike", "collapse", "warning", "damage", "wave", "clear", "game-over", "countdown", "miss", "false-step", "knock", "whisper", "door", "boss-keys", "boss-breath", "boss-hit", "boss-fall", "blocked"] as const;
export type CueKind = (typeof cueKinds)[number];

/** オリジナルの合成SE。外部素材やネットワーク取得を必要としない。 */
export function createCueBuffer(ctx: AudioContext, kind: CueKind): AudioBuffer {
    const durations: Record<CueKind, number> = {
        strike: 0.2, collapse: 0.65, warning: 0.65, damage: 0.4,
        wave: 0.85, clear: 1.25, "game-over": 1.15, countdown: 0.15,
        miss: 0.32, "false-step": 0.22, knock: 0.75, whisper: 1.35, door: 0.9,
        "boss-keys": 0.9, "boss-breath": 1.8, "boss-hit": 0.5, "boss-fall": 1.7, blocked: 0.35,
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
                break;
            case "miss":
                value = (noise - filteredNoise) * Math.sin(Math.PI * t / durations[kind]) * Math.exp(-t * 8) * 0.55;
                break;
            case "false-step":
                value = (Math.sin(2 * Math.PI * 105 * t) * 0.65 + filteredNoise * 1.2) * Math.exp(-t * 27);
                break;
            case "knock":
                value = [0, 0.32].reduce((sum, start) => {
                    const local = t - start;
                    return sum + (local >= 0 ? (Math.sin(2 * Math.PI * 145 * local) * 0.5 + filteredNoise * 0.7) * Math.exp(-local * 32) * Math.min(1, local / 0.004) : 0);
                }, 0);
                break;
            case "whisper":
                value = (noise * 0.2 + filteredNoise * 0.8) * (0.55 + Math.sin(t * 21) * 0.2)
                    * Math.sin(Math.PI * t / durations[kind]) * 0.65;
                break;
            case "door":
                value = (Math.sin(2 * Math.PI * (90 * t + 95 * t * t)) * 0.23 + filteredNoise * 0.8)
                    * Math.exp(-t * 4) * (0.6 + Math.sin(t * 35) * 0.25);
                break;
            case "boss-keys":
                value = [0, 0.18, 0.43, 0.68].reduce((sum, start, index) => {
                    const local = t - start;
                    return sum + (local >= 0 ? (Math.sin(2 * Math.PI * (570 + index * 93) * local) * 0.24
                        + Math.sin(2 * Math.PI * 1170 * local) * 0.11 + noise * 0.09)
                        * Math.exp(-local * 13) * Math.min(1, local / 0.003) : 0);
                }, 0);
                break;
            case "boss-breath":
                value = (filteredNoise * 1.9 + Math.sin(2 * Math.PI * (58 * t + 11 * t * t)) * 0.13)
                    * Math.sin(Math.PI * t / durations[kind]) * (0.65 + Math.sin(t * 9) * 0.15);
                break;
            case "boss-hit":
                value = (Math.sin(2 * Math.PI * (130 * t - 60 * t * t)) * 0.7 + filteredNoise * 1.6) * Math.exp(-t * 12);
                break;
            case "boss-fall":
                value = (Math.sin(2 * Math.PI * (95 * t - 18 * t * t)) * 0.5 + filteredNoise * 2)
                    * Math.exp(-t * 3.5) + Math.sin(2 * Math.PI * 680 * t) * Math.exp(-t * 8) * 0.18;
                break;
            case "blocked":
                value = (Math.sin(2 * Math.PI * 770 * t) * 0.42 + Math.sin(2 * Math.PI * 1120 * t) * 0.2 + noise * 0.2) * Math.exp(-t * 19);
        }
        samples[i] = Math.tanh(value) * attack * end;
    }
    return buffer;
}
