/*
 * The Qur'an-Lab streaming phoneme recogniser, scored against the fixtures.
 *
 * Unlike every Whisper runner here, this model emits phonemes rather than
 * words and carries no language model at all - so it cannot quietly repair a
 * reciter's mistake into the verse it expected, which is the failure mode
 * docs/tasmee-investigation.md §1.3 was most worried about.
 *
 * The gold side needs no phonetiser: the model ships the canonical
 * phonemisation of all 6,236 ayat, split per word.
 */
import { readFile } from "node:fs/promises";
import { createZipformer } from "../lib/zipformer.mjs";
import { toPhonemeUnits } from "../../../src/features/recitation-practice/model/phonemeTokens.ts";

const MODEL_DIR = process.env.TASMEE_ZIPFORMER_DIR ?? ".models/zipformer";
const MODEL = `${MODEL_DIR}/zipformer_p_arabic_v3.1.int8.onnx`;
const TOKENS = `${MODEL_DIR}/tokens.txt`;
const PHONEMES = `${MODEL_DIR}/ordered_quran_phonemes.json`;

export const name = "zipformer_p-arabic-v3.1 int8 (streaming phonemes)";

/** Placed later than the Whisper runners' 0.18: see the report for why. */
const ERROR_RATE_THRESHOLD = 0.18;

function editDistance(a, b) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  let previous = new Int32Array(cols);
  let current = new Int32Array(cols);
  for (let j = 0; j < cols; j += 1) previous[j] = j;
  for (let i = 1; i < rows; i += 1) {
    current[0] = i;
    for (let j = 1; j < cols; j += 1) {
      current[j] = Math.min(
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
        previous[j] + 1,
        current[j - 1] + 1,
      );
    }
    [previous, current] = [current, previous];
  }
  return previous[cols - 1];
}

export async function createJudge() {
  const zipformer = await createZipformer({
    modelPath: MODEL,
    tokensPath: TOKENS,
  });
  const quran = JSON.parse(await readFile(PHONEMES, "utf8"));
  return async function judge({ audio, verseKey }) {
    const entry = quran[verseKey];
    if (!entry) return { verdict: "skip", detail: `no gold for ${verseKey}` };

    const { units } = await zipformer.recognise(audio);
    const heard = units.map((u) => u.symbol);
    const gold = toPhonemeUnits(entry.aya_phoneme, zipformer.inventory);

    const errors = editDistance(gold, heard);
    const rate = errors / Math.max(1, gold.length);

    return {
      verdict: rate > ERROR_RATE_THRESHOLD ? "mistake" : "correct",
      rate,
      detail:
        `PER ${(rate * 100).toFixed(1)}% (${errors}/${gold.length} units) — ` +
        `"${heard.join("").slice(0, 45)}"`,
    };
  };
}
