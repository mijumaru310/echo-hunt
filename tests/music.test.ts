import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createMenuMusic } from "../src/audio/menuMusic.ts";

test("BGMは24秒で、ループ境界に無音の余白があり、クリップしない", () => {
    const sampleRate = 24000;
    const samples = createMenuMusic(sampleRate);
    assert.equal(samples.length, sampleRate * 24);
    assert.equal(samples[0], 0);
    assert.equal(samples.at(-1), 0);
    let peak = 0;
    let energy = 0;
    for (let i = 0; i < samples.length; i++) {
        assert.ok(Number.isFinite(samples[i]));
        peak = Math.max(peak, Math.abs(samples[i]));
        energy += samples[i] ** 2;
        if (i > 0) assert.ok(Math.abs(samples[i] - samples[i - 1]) < 0.2, "隣接サンプルにクリックノイズ相当の段差がない");
    }
    assert.ok(peak > 0.15 && peak < 0.95);
    assert.ok(Math.sqrt(energy / samples.length) > 0.05);
});

test("配信するBGMのWAVは生成コードと一致する", async () => {
    const wav = await readFile(new URL("../public/sounds/original/mansion-theme.wav", import.meta.url));
    assert.equal(wav.toString("ascii", 0, 4), "RIFF");
    assert.equal(wav.toString("ascii", 8, 12), "WAVE");
    assert.equal(wav.readUInt16LE(22), 1);
    assert.equal(wav.readUInt32LE(24), 24000);
    assert.equal(wav.readUInt32LE(40), wav.length - 44);
    const samples = createMenuMusic(24000);
    assert.equal(wav.length, 44 + samples.length * 2);
    for (let i = 0; i < samples.length; i++) assert.equal(wav.readInt16LE(44 + i * 2), Math.round(samples[i] * 32767) || 0);
});
