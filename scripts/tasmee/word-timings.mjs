/*
 * Can our own model timestamp a recitation word by word?
 *
 * Quran.com publishes per-word timestamps for 12 of the 62 reciters the
 * reader offers. Those 12 are the only voices the fixture builder can cut
 * mistakes from, and the only ones the reader can highlight word by word.
 * The other 50 have no timings anywhere.
 *
 * But forced alignment produces exactly this as a by-product. We know the
 * text - it is the Qur'an - so the model never has to recognise anything; it
 * only has to say *when* each expected phoneme was reached, which is a far
 * easier question than what was said. `alignToExpected` already returns a
 * first and last frame per word.
 *
 * Before trusting it on the 50, this measures it against the 12: align the
 * audio, compare our word starts to the published ones, report the error.
 *
 * Two cautions on reading the result:
 *
 *   Quran.com is not ground truth. Its final-word end runs ~0.82s early on
 *   90% of clips, which this project measured while building fixtures. So
 *   the last boundary is reported separately from the interior ones, and a
 *   disagreement there is as likely to be theirs as ours.
 *
 *   CTC is peaky: the path sits in blank between words, so our first
 *   non-blank frame falls *inside* the word. That is a systematic lag, not
 *   noise, so the median bias is reported and removed - a constant offset is
 *   correctable, scatter is not.
 *
 *   node scripts/tasmee/word-timings.mjs [--reciters husary,alafasy] [--ayat 12]
 */
import { flag } from "./lib/args.mjs";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { createZipformer } from "./lib/zipformer.mjs";
import { readWavAsFloat32 } from "./lib/audio.mjs";
import {
  identityClasses,
  toPhonemeUnits,
} from "../../src/features/recitation-practice/model/phonemeTokens.ts";
import { alignToExpected } from "../../src/features/recitation-practice/model/ctcAlign.ts";
import { RECITER_QURAN_COM_IDS } from "../../src/domain/quran/audio/quranComReciters.ts";

const API = "https://api.quran.com/api/v4";
const MODEL_DIR = process.env.TASMEE_ZIPFORMER_DIR ?? ".models/zipformer";
const WORK = path.resolve("scripts/tasmee/fixtures-large/.work");

/** 10ms fbank hop, 4x subsampling in the encoder. */
const FRAME_MS = 40;

/** Short names to app reciter ids, matching build-word-fixtures.mjs. */
const RECITERS = {
  alafasy: "ea-Alafasy_128kbps",
  husary: "ea-Husary_128kbps",
  "husary-muallim": "ea-Husary_Muallim_128kbps",
  minshawi: "ea-Minshawy_Murattal_128kbps",
  "minshawi-mujawwad": "ea-Minshawy_Mujawwad_192kbps",
  abdulbasit: "ea-Abdul_Basit_Murattal_192kbps",
  "abdulbasit-mujawwad": "ea-Abdul_Basit_Mujawwad_128kbps",
  sudais: "ea-Abdurrahmaan_As-Sudais_192kbps",
  shatri: "ea-Abu_Bakr_Ash-Shaatree_128kbps",
  rifai: "ea-Hani_Rifai_192kbps",
  shuraym: "ea-Saood_ash-Shuraym_128kbps",
  tablaway: "ea-Mohammad_al_Tablaway_128kbps",
};

function parseSegment(row) {
  if (row.length >= 4)
    return { position: row[1], startMs: row[2], endMs: row[3] };
  if (row.length === 3)
    return { position: row[0], startMs: row[1], endMs: row[2] };
  return null;
}

async function publishedSegments(recitationId, verseKey) {
  const response = await fetch(
    `${API}/verses/by_key/${verseKey}?words=true&audio=${recitationId}` +
      `&word_fields=position,char_type_name`,
  );
  if (!response.ok) return null;
  const data = await response.json();
  const spoken = new Set(
    (data?.verse?.words ?? [])
      .filter((word) => word.char_type_name !== "end")
      .map((word) => word.position),
  );
  const segments = (data?.verse?.audio?.segments ?? [])
    .map(parseSegment)
    .filter((segment) => segment && spoken.has(segment.position))
    .sort((a, b) => a.position - b.position);
  return segments.length >= 2 ? segments : null;
}

const quantile = (values, at) =>
  values.length === 0
    ? 0
    : values.slice().sort((a, b) => a - b)[
        Math.min(values.length - 1, Math.floor(values.length * at))
      ];

async function main() {
  const quran = JSON.parse(
    await readFile(`${MODEL_DIR}/ordered_quran_phonemes.json`, "utf8"),
  );
  const zipformer = await createZipformer({
    modelPath: `${MODEL_DIR}/zipformer_p_arabic_v3.1.int8.onnx`,
    tokensPath: `${MODEL_DIR}/tokens.txt`,
  });
  const { classOf, classCount } = identityClasses(zipformer.symbols);
  const idOf = new Map();
  zipformer.symbols.forEach((symbol, id) => {
    if (symbol && symbol !== "<blank>") idOf.set(symbol, id);
  });

  const reciters = flag("reciters", Object.keys(RECITERS).join(",")).split(",");
  const wanted = Number(flag("ayat", "45"));

  /* Whatever full-ayah audio the fixture builder has already cached. */
  const available = new Map();
  for (const reciter of reciters) {
    const keys = [];
    for (const key of Object.keys(quran)) {
      const file = path.join(WORK, `${reciter}-${key.replace(":", "_")}.wav`);
      if (existsSync(file)) keys.push(key);
    }
    if (keys.length > 0) available.set(reciter, keys.slice(0, wanted));
  }
  if (available.size === 0) {
    console.log("No cached audio; run build-word-fixtures.mjs first.");
    return;
  }

  const interior = [];
  const finalWord = [];
  const perReciter = new Map();

  for (const [reciter, keys] of available) {
    const recitationId = RECITER_QURAN_COM_IDS[RECITERS[reciter]];
    if (!recitationId) continue;

    for (const verseKey of keys) {
      const published = await publishedSegments(recitationId, verseKey);
      if (!published) continue;

      const words = quran[verseKey].aya_phonemes_list;
      const labels = [];
      const spans = [];
      for (const word of words) {
        const from = labels.length;
        for (const unit of toPhonemeUnits(word, zipformer.inventory)) {
          const id = idOf.get(unit);
          if (id !== undefined) labels.push(id);
        }
        if (labels.length > from) spans.push({ from, to: labels.length });
      }
      // Only a clean one-to-one can be compared position by position.
      if (spans.length !== published.length) continue;

      const file = path.join(
        WORK,
        `${reciter}-${verseKey.replace(":", "_")}.wav`,
      );
      const audio = await readWavAsFloat32(file);
      const samples = audio.samples ?? audio;
      // Tail padding, so the last word is seen at all.
      const padded = new Float32Array(samples.length + 61 * 160);
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

      const errors = perReciter.get(reciter) ?? [];
      scores.forEach((score, index) => {
        if (score.startFrame < 0) return;
        const ours = score.startFrame * FRAME_MS;
        const theirs = published[index].startMs;
        const error = ours - theirs;
        errors.push(error);
        if (index === scores.length - 1) finalWord.push(error);
        else interior.push(error);
      });
      perReciter.set(reciter, errors);
    }
    console.log(
      `  ${reciter}: ${(perReciter.get(reciter) ?? []).length} words`,
    );
  }

  const report = (label, errors) => {
    if (errors.length === 0) {
      console.log(`${label.padEnd(22)} no data`);
      return;
    }
    const bias = quantile(errors, 0.5);
    const corrected = errors.map((error) => Math.abs(error - bias));
    console.log(
      `${label.padEnd(22)}${String(errors.length).padStart(6)} words  ` +
        `bias ${String(Math.round(bias)).padStart(5)}ms  ` +
        `after removing it: median ${String(Math.round(quantile(corrected, 0.5))).padStart(4)}ms  ` +
        `p90 ${String(Math.round(quantile(corrected, 0.9))).padStart(5)}ms`,
    );
  };

  console.log("\nOur word starts against Quran.com's published ones:\n");
  report("interior words", interior);
  report("each ayah's last", finalWord);
  console.log("");
  for (const [reciter, errors] of perReciter) report(reciter, errors);

  console.log(
    "\nA small constant bias is expected and correctable - CTC sits in blank\n" +
      "between words, so our first non-blank frame falls inside the word. What\n" +
      "matters is the spread after removing it.",
  );
}

await main();
