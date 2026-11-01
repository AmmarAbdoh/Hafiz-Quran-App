/*
 * Cutting recitations into words with our own forced alignment.
 *
 * Shared by the builders that manufacture word-level mistakes from real
 * audio (`build-learner-mistakes.mjs`, `build-twin-slips.mjs`). Quran.com's
 * published word timestamps run short, so a word cut at them leaves part of
 * itself behind; these boundaries come from aligning the audio to its own
 * ayah instead. `word-timings.mjs` measured that alignment against
 * Quran.com: word starts land 270ms late (CTC sits in blank, then peaks
 * inside the word) with a 60ms median scatter once that is removed.
 */
import { fork } from "node:child_process";
import { readFile } from "node:fs/promises";
import { constants, setPriority } from "node:os";
import { createZipformer } from "./zipformer.mjs";
import { readWavAsFloat32, SAMPLE_RATE } from "./audio.mjs";
import {
  identityClasses,
  toPhonemeUnits,
} from "../../../src/features/recitation-practice/model/phonemeTokens.ts";
import { alignToExpected } from "../../../src/features/recitation-practice/model/ctcAlign.ts";

/** 10ms fbank hop, 4x subsampling in the encoder. */
const FRAME_MS = 40;
/** How late our first aligned frame lands in a word; see word-timings.mjs. */
const START_LAG_MS = 270;
/** Silence appended so the last window is seen, as the clip worker does. */
const TAIL_PAD_SAMPLES = 61 * 160;
/** Fade at every join, so a cut is not heard as a click. */
const FADE_SAMPLES = Math.round(SAMPLE_RATE * 0.005);

/** Small, seeded, and the same on every machine. */
export function random(seed) {
  let state = 0;
  for (const char of seed)
    state = (Math.imul(state, 31) + char.charCodeAt(0)) | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The aligning half of a builder, run in a forked copy of it.
 *
 * Takes `{ job: { id, file, verseKey } }` and answers with each word's
 * phoneme units and aligned frames, or why it could not.
 */
export async function alignWorker(modelDir) {
  const zipformer = await createZipformer({
    modelPath: `${modelDir}/zipformer_p_arabic_v3.1.int8.onnx`,
    tokensPath: `${modelDir}/tokens.txt`,
  });
  const quran = JSON.parse(
    await readFile(`${modelDir}/ordered_quran_phonemes.json`, "utf8"),
  );
  const { classOf, classCount } = identityClasses(zipformer.symbols);
  const idOf = new Map();
  zipformer.symbols.forEach((symbol, id) => {
    if (symbol && symbol !== "<blank>") idOf.set(symbol, id);
  });

  process.on("message", async ({ job }) => {
    if (!job) return process.disconnect();
    try {
      const labels = [];
      const spans = [];
      const units = [];
      for (const word of quran[job.verseKey].aya_phonemes_list) {
        const from = labels.length;
        const wordUnits = toPhonemeUnits(word, zipformer.inventory);
        for (const unit of wordUnits) {
          const id = idOf.get(unit);
          if (id !== undefined) labels.push(id);
        }
        /* A word with nothing to align cannot be cut out cleanly. */
        if (labels.length === from) throw new Error("word without phonemes");
        spans.push({ from, to: labels.length });
        units.push(wordUnits.join(""));
      }
      const samples = await readWavAsFloat32(job.file);
      const padded = new Float32Array(samples.length + TAIL_PAD_SAMPLES);
      padded.set(samples);
      const { logProbs, frames, vocab } = await zipformer.logProbsFor(padded);
      const scores = alignToExpected(
        logProbs,
        frames,
        vocab,
        labels,
        spans,
        zipformer.blankId,
        classOf,
        classCount,
      );
      if (scores.some((score) => score.startFrame < 0)) {
        throw new Error("word without frames");
      }
      process.send({
        id: job.id,
        units,
        frames: scores.map((score) => [score.startFrame, score.endFrame]),
        length: samples.length,
      });
    } catch (error) {
      process.send({ id: job.id, failed: String(error?.message ?? error) });
    }
  });
  process.send({ ready: true });
}

/**
 * Align every job across forked copies of `script`, which must call
 * `alignWorker` when started with `--align-worker`.
 */
export function alignAll(script, jobs, workerCount) {
  return new Promise((resolve) => {
    const results = new Map();
    if (jobs.length === 0) return resolve(results);
    let next = 0;
    let live = workerCount;
    for (let index = 0; index < workerCount; index += 1) {
      const child = fork(script, ["--align-worker"]);
      /* Below normal, as measure.mjs does: this runs on someone's own machine. */
      try {
        setPriority(child.pid, constants.priority.PRIORITY_BELOW_NORMAL);
      } catch {
        /* Not permitted everywhere; the build matters more. */
      }
      const give = () => {
        if (next >= jobs.length) {
          child.send({});
          if (--live === 0) resolve(results);
          return;
        }
        child.send({ job: jobs[next++] });
      };
      child.on("message", (message) => {
        if (!message.ready) {
          results.set(message.id, message);
          if (results.size % 250 === 0) {
            console.log(`  aligned ${results.size}/${jobs.length}`);
          }
        }
        give();
      });
    }
  });
}

/**
 * Sample offsets where each word begins, plus the clip's end.
 *
 * The lag is the model's, not the first phoneme's: every frame reports
 * sound from START_LAG_MS earlier. So a word starts that long before its
 * first aligned frame, and never before the sound of the previous word's
 * last frame - which is the same lag back from that frame, not the frame.
 */
export function boundaries(frames, length) {
  const toSample = (ms) => Math.round((ms / 1000) * SAMPLE_RATE);
  const cuts = [0];
  for (let index = 1; index < frames.length; index += 1) {
    const start = frames[index][0] * FRAME_MS - START_LAG_MS;
    const floor = (frames[index - 1][1] + 1) * FRAME_MS - START_LAG_MS;
    cuts.push(Math.min(length, Math.max(0, toSample(Math.max(floor, start)))));
  }
  cuts.push(length);
  return cuts;
}

/**
 * Join `[samples, from, to]` pieces, fading each join out and in.
 *
 * Pieces may come from different recordings - a twin slip is one ayah's
 * opening and another's ending - so only neighbours from the same one are
 * the same stretch of audio, with no join to fade.
 */
export function join(ranges) {
  const pieces = [];
  for (const [samples, from, to] of ranges) {
    const last = pieces.at(-1);
    if (last && last[0] === samples && last[2] === from) last[2] = to;
    else pieces.push([samples, from, to]);
  }
  const total = pieces.reduce((sum, [, from, to]) => sum + (to - from), 0);
  const out = new Float32Array(total);
  let at = 0;
  pieces.forEach(([samples, from, to], index) => {
    const piece = samples.subarray(from, to);
    out.set(piece, at);
    const fade = Math.min(FADE_SAMPLES, Math.floor(piece.length / 2));
    for (let offset = 0; offset < fade; offset += 1) {
      const gain = offset / fade;
      if (index > 0) out[at + offset] *= gain;
      if (index < pieces.length - 1)
        out[at + piece.length - 1 - offset] *= gain;
    }
    at += piece.length;
  });
  return out;
}

/** 16-bit mono PCM at the model's rate. */
export function wav(samples) {
  const buffer = Buffer.alloc(44 + samples.length * 2);
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + samples.length * 2, 4);
  buffer.write("WAVEfmt ", 8, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((value, index) => {
    const clamped = Math.max(-1, Math.min(1, value));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + index * 2);
  });
  return buffer;
}
