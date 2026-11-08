/** Original 24-second horror miniature. All tones and texture are synthesized. */
export function createMenuMusic(sampleRate: number): Float32Array {
    const duration = 24;
    const samples = new Float32Array(Math.round(duration * sampleRate));
    const notes = [
        [1.2, 293.665], [4.4, 311.127], [7.8, 220], [10.1, 207.652],
        [13.6, 293.665], [16.9, 349.228], [19.4, 311.127], [21.2, 146.832],
    ];
    let noiseState = 0x4543484f;
    let air = 0;
    for (let i = 0; i < samples.length; i++) {
        const t = i / sampleRate;
        const tau = Math.PI * 2;
        noiseState = (Math.imul(noiseState, 1664525) + 1013904223) >>> 0;
        air += ((noiseState / 0x100000000 * 2 - 1) - air) * 0.018;
        const swell = 0.6 + 0.4 * Math.sin(Math.PI * t / duration) ** 2;
        // A bowed low D, a detuned harmonic, and a faint semitone tension.
        let value = (Math.sin(tau * 73.416 * t + 0.3 * Math.sin(tau * t / 8)) * 0.18
            + Math.sin(tau * 146.61 * t) * 0.075
            + Math.sin(tau * 155.56 * t + Math.sin(tau * t / 12) * 0.15) * 0.045) * swell;
        value += air * 0.12 * (0.55 + 0.45 * Math.sin(tau * t / 6) ** 2);
        for (const [start, hz] of notes) {
            const local = t - start;
            if (local < 0) continue;
            const bow = (1 - Math.exp(-local * 8)) * Math.exp(-local * 0.85);
            value += (Math.sin(tau * hz * local) + Math.sin(tau * hz * 2.013 * local) * 0.24
                + Math.sin(tau * hz * 3.97 * local) * 0.09) * bow * 0.12;
        }
        samples[i] = value;
    }
    // Quiet room reflections, without external impulse responses or samples.
    const dry = samples.slice();
    for (const [delay, gain] of [[0.213, 0.22], [0.431, 0.14], [0.827, 0.09]]) {
        const offset = Math.round(delay * sampleRate);
        for (let i = offset; i < samples.length; i++) samples[i] += dry[i - offset] * gain;
    }
    for (let i = 0; i < samples.length; i++) {
        const fade = Math.min(1, i / (sampleRate * 0.8), (samples.length - 1 - i) / (sampleRate * 1.2));
        samples[i] = Math.tanh(samples[i] * 1.3) * fade;
    }
    return samples;
}
