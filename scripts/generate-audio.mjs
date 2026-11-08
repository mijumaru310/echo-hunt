import { mkdir, writeFile } from "node:fs/promises";
import { createMenuMusic } from "../src/audio/menuMusic.ts";

// Run with Node 24: node --experimental-strip-types scripts/generate-audio.mjs
const sampleRate = 24000;
const samples = createMenuMusic(sampleRate);
const wav = Buffer.alloc(44 + samples.length * 2);
wav.write("RIFF", 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write("WAVEfmt ", 8);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(sampleRate, 24); wav.writeUInt32LE(sampleRate * 2, 28);
wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
wav.write("data", 36); wav.writeUInt32LE(samples.length * 2, 40);
for (let i = 0; i < samples.length; i++) wav.writeInt16LE(Math.round(samples[i] * 32767), 44 + i * 2);
const directory = new URL("../public/sounds/original/", import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(new URL("mansion-theme.wav", directory), wav);
console.log(`Created mansion-theme.wav (${samples.length / sampleRate}s, ${wav.length} bytes)`);
