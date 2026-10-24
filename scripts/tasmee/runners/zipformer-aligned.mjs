/*
 * The same recogniser, asked the right question.
 *
 * `zipformer.mjs` decodes freely and then compares the transcript to the
 * expected text with an edit distance. This one never decodes: it forces the
 * audio onto the phonemes the ayah expects and scores each word by how well
 * its own frames support it.
 *
 * The difference shows up on short verses. As an error rate, one wrong
 * phoneme in a ten-unit verse is 10% - under any threshold loose enough to
 * spare a long verse. As a probability, the word simply was not said.
 */
import { readFile } from "node:fs/promises";
import { createZipformer } from "../lib/zipformer.mjs";
import {
  identityClasses,
  toPhonemeUnits,
} from "../../../src/features/recitation-practice/model/phonemeTokens.ts";
import { alignToExpected } from "../../../src/features/recitation-practice/model/ctcAlign.ts";
import {
  findMisreadWords,
  WEAK_WORDS_TOLERATED,
} from "../../../src/features/recitation-practice/model/practiceVerdict.ts";

const MODEL_DIR = process.env.TASMEE_ZIPFORMER_DIR ?? ".models/zipformer";
const MODEL = `${MODEL_DIR}/zipformer_p_arabic_v3.1.int8.onnx`;
const TOKENS = `${MODEL_DIR}/tokens.txt`;
const PHONEMES = `${MODEL_DIR}/ordered_quran_phonemes.json`;

export const name = "zipformer_p-arabic-v3.1 int8 (forced alignment)";

export async function createJudge() {
  const zipformer = await createZipformer({
    modelPath: MODEL,
    tokensPath: TOKENS,
  });
  const quran = JSON.parse(await readFile(PHONEMES, "utf8"));

  const { classOf, classCount } = identityClasses(zipformer.symbols);
  const idOf = new Map();
  zipformer.symbols.forEach((symbol, id) => {
    if (symbol && symbol !== "<blank>") idOf.set(symbol, id);
  });

  return async function judge({ audio, verseKey }) {
    const ayah = quran[verseKey];
    if (!ayah) return { verdict: "skip", detail: `no gold for ${verseKey}` };

    // The expected phonemes, flattened, remembering where each word begins.
    const labels = [];
    const spans = [];
    for (const word of ayah.aya_phonemes_list) {
      const from = labels.length;
      for (const unit of toPhonemeUnits(word, zipformer.inventory)) {
        const id = idOf.get(unit);
        if (id !== undefined) labels.push(id);
      }
      if (labels.length > from) spans.push({ from, to: labels.length });
    }
    if (spans.length === 0) {
      return { verdict: "skip", detail: `no phonemes for ${verseKey}` };
    }

    const { logProbs, frames, vocab } = await zipformer.logProbsFor(audio);
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

    /*
     * The app's own rule, so this measures what a reciter experiences -
     * including the one weak word per ayah it tolerates, because almost
     * every clean recitation contains exactly one. What the app also has and
     * this does not is the live cursor; `zipformer-app.mjs` adds it, and the
     * gap between the two runners is what that evidence is worth.
     */
    const misread = findMisreadWords(
      scores.map((score) => ({
        ayah: verseKey,
        score: score.score,
        skipped: false,
      })),
    );
    const worst = scores.reduce(
      (low, score) => (score.score < low.score ? score : low),
      scores[0],
    );

    return {
      verdict: misread.length > 0 ? "mistake" : "correct",
      detail:
        `${misread.length}/${scores.length} words marked ` +
        `(${WEAK_WORDS_TOLERATED} tolerated), worst ${worst.score.toFixed(2)}`,
    };
  };
}
