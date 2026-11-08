export const cueKinds = ["strike", "collapse", "warning", "damage", "wave", "clear", "game-over", "countdown", "lock-ready", "miss", "false-step", "knock", "whisper", "door", "boss-keys", "boss-breath", "boss-hit", "boss-fall", "blocked"] as const;
export type CueKind = (typeof cueKinds)[number];

/** オリジナルの合成SE。外部素材やネットワーク取得を必要としない。 */
export function createCueBuffer(ctx: AudioContext, kind: CueKind): AudioBuffer {
    const durations: Record<CueKind, number> = {
        strike: 0.24, collapse: 0.75, warning: 0.8, damage: 0.55,
        wave: 1.1, clear: 1.45, "game-over": 1.4, countdown: 0.2, "lock-ready": 0.3,
        miss: 0.32, "false-step": 0.22, knock: 0.75, whisper: 1.35, door: 0.9,
        "boss-keys": 0.9, "boss-breath": 1.8, "boss-hit": 0.5, "boss-fall": 1.7, blocked: 0.35,
    };
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * durations[kind]), ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    let filteredNoise = 0;
    let lowNoise = 0;
    let noiseState = 0x4543484f + cueKinds.indexOf(kind);
    for (let i = 0; i < samples.length; i++) {
        const t = i / ctx.sampleRate;
        const attack = Math.min(1, t / 0.006);
        const end = Math.min(1, (samples.length - i) / (ctx.sampleRate * 0.03));
        noiseState = (Math.imul(noiseState, 1664525) + 1013904223) >>> 0;
        const noise = noiseState / 0x100000000 * 2 - 1;
        // Sample-rate independent texture: a breath layer and a lower rumble.
        filteredNoise += (noise - filteredNoise) * (1 - Math.exp(-2 * Math.PI * 1100 / ctx.sampleRate));
        lowNoise += (noise - lowNoise) * (1 - Math.exp(-2 * Math.PI * 160 / ctx.sampleRate));
        let value = 0;
        switch (kind) {
            case "strike":
                value = (filteredNoise * 1.2 + Math.sin(2 * Math.PI * (180 * t - 260 * t * t)) * 0.8) * Math.exp(-t * 25)
                    + Math.sin(2 * Math.PI * 1490 * t) * Math.exp(-t * 38) * 0.16;
                break;
            case "collapse":
                // A falling, breathy apparition, followed by a short room tail.
                value = (filteredNoise * 1.3 * (0.6 + Math.sin(t * 37) * 0.25)
                    + Math.sin(2 * Math.PI * (240 * t - 110 * t * t) + Math.sin(t * 42) * 0.6) * 0.3) * Math.exp(-t * 5.5)
                    + lowNoise * Math.sin(Math.PI * t / durations[kind]) * 0.8;
                break;
            case "warning":
                // Uneven vocal-fold pulses and rough breath; no sampled voice.
                value = (Math.sin(2 * Math.PI * (72 * t + 48 * t * t) + Math.sin(t * 53) * 1.4) * 0.55
                    + Math.sin(2 * Math.PI * (145 * t + 61 * t * t)) * 0.18 + filteredNoise * 0.75)
                    * Math.sin(Math.PI * t / durations[kind]) * (0.7 + Math.sin(t * 39) * 0.2);
                break;
            case "damage":
                value = (Math.sin(2 * Math.PI * (90 * t - 48 * t * t)) * 0.8 + filteredNoise * 1.1) * Math.exp(-t * 12)
                    + Math.sin(2 * Math.PI * 47 * t) * Math.exp(-t * 7) * 0.3;
                break;
            case "wave":
                // An inharmonic iron bell and a distant door resonance.
                value = [146.832, 302.4, 419.1, 619.2].reduce((sum, hz, index) =>
                    sum + Math.sin(2 * Math.PI * hz * t) * Math.exp(-t * (3.8 + index * 1.6)) * 0.25 / (1 + index * 0.6), 0)
                    + lowNoise * Math.exp(-t * 7) * 1.2;
                break;
            case "clear":
                value = [146.832, 220, 293.665].reduce((sum, hz, index) => {
                    const local = t - index * 0.23;
                    return sum + (local >= 0 ? (Math.sin(2 * Math.PI * hz * local) + Math.sin(2 * Math.PI * hz * 2.007 * local) * 0.18)
                        * (1 - Math.exp(-local * 24)) * Math.exp(-local * 3) * 0.27 : 0);
                }, 0) + lowNoise * Math.exp(-t * 5) * 0.3;
                break;
            case "game-over":
                value = (Math.sin(2 * Math.PI * (130 * t - 26 * t * t)) * 0.45
                    + Math.sin(2 * Math.PI * (137 * t - 25 * t * t)) * 0.25 + lowNoise * 1.1) * Math.exp(-t * 3.3);
                break;
            case "countdown":
                value = (Math.sin(2 * Math.PI * 195 * t) * 0.42 + filteredNoise * 0.45) * Math.exp(-t * 30);
                break;
            case "lock-ready":
                // A clear, brief glass chime stays distinct from hostile noises.
                value = (Math.sin(2 * Math.PI * 880 * t) * 0.38 + Math.sin(2 * Math.PI * 1327 * t) * 0.17)
                    * Math.exp(-t * 15);
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
    // Sparse, quiet reflections on dramatic cues only. Position-finding signals
    // (steps, lock, boss keys/breath) stay dry and precise.
    if (["collapse", "wave", "clear", "game-over", "door", "boss-fall"].includes(kind)) {
        const dry = samples.slice();
        for (const [seconds, gain] of [[0.047, 0.15], [0.089, 0.08]]) {
            const delay = Math.round(ctx.sampleRate * seconds);
            for (let i = delay; i < samples.length; i++) samples[i] += dry[i - delay] * gain;
        }
        for (let i = 0; i < samples.length; i++) {
            samples[i] = Math.max(-0.95, Math.min(0.95, samples[i]))
                * Math.min(1, (samples.length - 1 - i) / (ctx.sampleRate * 0.04));
        }
    }
    return buffer;
}
