/*
 * One child of the measuring pool: loads the model once, scores clips on
 * demand.
 *
 * The parent owns the queue and hands out one clip at a time, so a child that
 * draws a three-minute ayah does not hold up the seven short ones behind it.
 *
 * Both outputs come from a single forward pass. The aligner needs the raw
 * frame log-probabilities, and the live cursor's phonemes are a greedy argmax
 * over those same frames - decoding the whole run in one call is identical to
 * decoding it chunk by chunk, because the only thing carried across a chunk
 * boundary is the previously emitted class, and one stream state carries it.
 * So asking for both costs nothing over asking for either.
 */
import path from "node:path";
import { readFile } from "node:fs/promises";
import { createZipformer } from "./zipformer.mjs";
import { readWavAsFloat32 } from "./audio.mjs";
import {
  identityClasses,
  toPhonemeUnits,
} from "../../../src/features/recitation-practice/model/phonemeTokens.ts";
import { alignToExpected } from "../../../src/features/recitation-practice/model/ctcAlign.ts";
import {
  createCtcStreamState,
  decodeChunk,
} from "../../../src/features/recitation-practice/model/ctcGreedy.ts";
import {
  advanceTracker,
  createPhonemeTracker,
  recitedSpan,
} from "../../../src/features/recitation-practice/model/phonemeProgress.ts";

/** How often the worker posts phonemes: 48 fbank frames at a 10ms shift. */
const CHUNK_SECONDS = 48 * 0.01;

const MODEL_DIR = process.env.TASMEE_ZIPFORMER_DIR ?? ".models/zipformer";
/**
 * Cursor options to measure against the app's defaults, as JSON - for
 * example `TASMEE_TRACKER='{"catchUp":false}'`. See `TrackerOptions`.
 */
const TRACKER_OPTIONS = JSON.parse(process.env.TASMEE_TRACKER ?? "{}");

/** Silence appended so the last window is seen; see the worker in src. */
const TAIL_PAD_SAMPLES = 61 * 160;

let zipformer = null;
let quran = null;
let classOf = null;
let classCount = 0;
let idOf = null;

async function load() {
  zipformer = await createZipformer({
    modelPath: `${MODEL_DIR}/zipformer_p_arabic_v3.1.int8.onnx`,
    tokensPath: `${MODEL_DIR}/tokens.txt`,
  });
  quran = JSON.parse(
    await readFile(`${MODEL_DIR}/ordered_quran_phonemes.json`, "utf8"),
  );
  ({ classOf, classCount } = identityClasses(zipformer.symbols));
  idOf = new Map();
  zipformer.symbols.forEach((symbol, id) => {
    if (symbol && symbol !== "<blank>") idOf.set(symbol, id);
  });
}

/** The expected phoneme sequence for a clip, flattened, with word spans. */
function expectedFor(verseKeys) {
  const labels = [];
  const spans = [];
  /** Each word's units and page locations, for replaying the cursor. */
  const words = [];
  for (const key of verseKeys) {
    const ayah = quran[key];
    if (!ayah) return null;
    for (const [index, word] of ayah.aya_phonemes_list.entries()) {
      const from = labels.length;
      const units = toPhonemeUnits(word, zipformer.inventory);
      for (const unit of units) {
        const id = idOf.get(unit);
        if (id !== undefined) labels.push(id);
      }
      if (labels.length > from) {
        spans.push({ from, to: labels.length });
        words.push({ ayah: key, locations: [`${key}:${index + 1}`], units });
      }
    }
  }
  return spans.length === 0 ? null : { labels, spans, words };
}

async function measure(clip, fixtures) {
  const keys = clip.verseKeys ?? [clip.verseKey];
  const expected = expectedFor(keys);
  if (!expected) return { id: clip.id, skipped: "no phonemes" };

  const audio = await readWavAsFloat32(path.join(fixtures, clip.audio));
  const samples = audio.samples ?? audio;
  const padded = new Float32Array(samples.length + TAIL_PAD_SAMPLES);
  padded.set(samples);

  const { logProbs, frames, vocab } = await zipformer.logProbsFor(padded);
  if (frames === 0) return { id: clip.id, skipped: "no frames" };

  const units = decodeChunk(
    logProbs,
    frames,
    vocab,
    zipformer.symbols,
    zipformer.blankId,
    createCtcStreamState(),
  );

  /*
   * The cursor first, because the app scores only what it reached.
   *
   * `requestVerdict` sends `recitedSpan(tracker)`, so aligning the whole
   * passage measures something the reader never asks for: words nobody
   * recited hold no frames, score nothing, and get marked - which caught
   * every stopped-early clip by accident. Replaying the cursor here, in the
   * 480ms batches the worker posts, gives the same span the app would send.
   */
  const tracker = createPhonemeTracker(expected.words, TRACKER_OPTIONS);
  for (let at = 0; at < units.length; ) {
    const until = units[at].seconds + CHUNK_SECONDS;
    const chunk = [];
    while (at < units.length && units[at].seconds < until) {
      chunk.push(units[at]);
      at += 1;
    }
    advanceTracker(tracker, chunk);
  }
  const span = recitedSpan(tracker) ?? { from: 0, to: 0 };
  const judged = expected.spans.slice(span.from, span.to);

  /* Rebased onto the slice, the way the worker's `scoreRun` does it. */
  const start = judged.length > 0 ? judged[0].from : 0;
  const scores =
    judged.length === 0
      ? []
      : alignToExpected(
          logProbs,
          frames,
          vocab,
          expected.labels.slice(start, judged.at(-1).to),
          judged.map((word) => ({
            from: word.from - start,
            to: word.to - start,
          })),
          zipformer.blankId,
          classOf,
          classCount,
        );

  return {
    id: clip.id,
    kind: clip.kind,
    verdict: clip.verdict,
    reciter: clip.reciter,
    verseKeys: keys,
    /* [symbol, confidence, seconds, runner-ups?] - the runner-ups only
       when the frame had any, as [symbol, probability] pairs. */
    units: units.map((unit) => {
      const row = [
        unit.symbol,
        Number(unit.confidence.toFixed(3)),
        Number(unit.seconds.toFixed(2)),
      ];
      if (unit.alternatives) {
        row.push(
          unit.alternatives.map((alternative) => [
            alternative.symbol,
            Number(alternative.probability.toFixed(3)),
          ]),
        );
      }
      return row;
    }),
    /* Which words these scores are for, and how many the page had. */
    span: { from: span.from, to: span.to },
    totalWords: expected.words.length,
    scores: scores.map((score) => Number(score.score.toFixed(4))),
    supports: scores.map((score) =>
      score.supports.map((value) => Number(value.toFixed(4))),
    ),
  };
}

process.on("message", async (message) => {
  try {
    if (message.type === "load") {
      await load();
      process.send({ type: "ready" });
      return;
    }
    if (message.type === "clip") {
      const row = await measure(message.clip, message.fixtures);
      process.send({ type: "row", row });
    }
  } catch (error) {
    process.send({
      type: "row",
      row: {
        id: message.clip?.id ?? "?",
        failed: String(error?.message ?? error).slice(0, 160),
      },
    });
  }
});
