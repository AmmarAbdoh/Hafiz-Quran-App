/*
 * The whole feature, judged the way a reciter experiences it.
 *
 * `zipformer-aligned.mjs` measures the aligner alone: scores in, verdict
 * out. The app has a second source of evidence that the aligner cannot see -
 * the live cursor, which watches the reciter move through the page and
 * notices when they go past a word without saying it. The verdict rule reads
 * both, so measuring either one by itself measures something nobody uses.
 *
 * The cursor's phonemes are decoded from the same frames the aligner scores,
 * so this costs one model pass, not two. Decoding the run in one call is
 * identical to decoding it chunk by chunk: the only thing carried across a
 * chunk boundary is the previous class, and a single stream state carries it.
 */
import { readFile } from "node:fs/promises";
import { createZipformer } from "../lib/zipformer.mjs";
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
import {
  findMisreadWords,
  stoppedShort,
} from "../../../src/features/recitation-practice/model/practiceVerdict.ts";

const MODEL_DIR = process.env.TASMEE_ZIPFORMER_DIR ?? ".models/zipformer";
const MODEL = `${MODEL_DIR}/zipformer_p_arabic_v3.1.int8.onnx`;
const TOKENS = `${MODEL_DIR}/tokens.txt`;
const PHONEMES = `${MODEL_DIR}/ordered_quran_phonemes.json`;

/**
 * How often the worker posts phonemes: every 48 frames it advances.
 *
 * Those are fbank frames at a 10ms shift, so 480ms - not the 1.92s this used
 * to assume by reading 48 as encoder frames. The tracker is driven by the
 * order of the phonemes rather than their timing, so the two give the same
 * answer on these fixtures, but only one of them is what the app does.
 */
const CHUNK_SECONDS = 48 * 0.01;

export const name = "zipformer_p-arabic-v3.1 int8 (alignment + cursor)";

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

  return async function judge({ audio, verseKey, verseKeys }) {
    /* One ayah or a whole page: the app only ever sees the latter. */
    const keys = verseKeys ?? [verseKey];

    // The expected phonemes, flattened, remembering where each word begins.
    const labels = [];
    const spans = [];
    const expected = [];
    /* Which ayah each expected word belongs to - the tolerance is per ayah,
       so on a passage this is what keeps the budgets separate. */
    const ayahOf = [];
    for (const key of keys) {
      const ayah = quran[key];
      if (!ayah) return { verdict: "skip", detail: `no gold for ${key}` };
      ayah.aya_phonemes_list.forEach((word, index) => {
        const from = labels.length;
        const units = toPhonemeUnits(word, zipformer.inventory);
        for (const unit of units) {
          const id = idOf.get(unit);
          if (id !== undefined) labels.push(id);
        }
        if (labels.length > from) {
          spans.push({ from, to: labels.length });
          expected.push({ locations: [`${key}:${index + 1}`], units });
          ayahOf.push(key);
        }
      });
    }
    if (spans.length === 0) {
      return { verdict: "skip", detail: `no phonemes for ${keys.join(", ")}` };
    }

    const { logProbs, frames, vocab } = await zipformer.logProbsFor(audio);

    /* The same frames, decoded as the live cursor sees them. */
    const units = decodeChunk(
      logProbs,
      frames,
      vocab,
      zipformer.symbols,
      zipformer.blankId,
      createCtcStreamState(),
    );
    const tracker = createPhonemeTracker(expected);
    const skipped = new Set();
    for (let at = 0; at < units.length; ) {
      const until = units[at].seconds + CHUNK_SECONDS;
      const chunk = [];
      while (at < units.length && units[at].seconds < until) {
        chunk.push(units[at]);
        at += 1;
      }
      const progress = advanceTracker(tracker, chunk);
      for (const location of progress.skipped) skipped.add(location);
      /*
       * Said after all: the cursor went past them and the reciter came back.
       * The app withdraws the skip here, and leaving it in made the cursor's
       * evidence look stronger than the reader's copy of it.
       */
      for (const word of progress.completed) {
        for (const location of word.locations) skipped.delete(location);
      }
    }

    /*
     * Only the stretch the reciter actually covered, which is the whole of
     * what the app scores: `requestVerdict` sends `recitedSpan(tracker)`.
     *
     * Aligning the entire passage instead made a reciter who stopped early
     * trivial to catch - the words they never reached hold no frames, so
     * they score nothing and get marked - by a route the app never takes.
     * Stopping early is caught there by the run not finishing.
     */
    const span = recitedSpan(tracker);
    const judged = span ? spans.slice(span.from, span.to) : [];
    if (judged.length === 0) {
      /*
       * No word of the page matched. The app tells these two apart by
       * whether the recogniser emitted anything, and so does this.
       *
       * It emitted something: they recited, and none of it was this page -
       * someone reciting a different verse lands here. `finishPractice`
       * reports that as "no recitation was heard", which is a failure, not a
       * clean page. Nothing emitted at all is nobody speaking, which the app
       * treats as a cancel and there is no verdict to measure.
       */
      if (units.length > 0) {
        return {
          verdict: "mistake",
          detail: `${units.length} phonemes heard, none of this page`,
        };
      }
      return { verdict: "skip", detail: "nothing was recited" };
    }

    /* Rebased onto the slice, the way the worker's `scoreRun` does it. */
    const start = judged[0].from;
    const scores = alignToExpected(
      logProbs,
      frames,
      vocab,
      labels.slice(start, judged.at(-1).to),
      judged.map((word) => ({ from: word.from - start, to: word.to - start })),
      zipformer.blankId,
      classOf,
      classCount,
    );

    const misread = findMisreadWords(
      judged.map((_, index) => {
        const at = span.from + index;
        return {
          ayah: ayahOf[at],
          score: scores[index].score,
          skipped: expected[at].locations.some((location) =>
            skipped.has(location),
          ),
        };
      }),
    );

    /*
     * Not reaching the end is a verdict of its own, and the aligner is not
     * what notices it.
     *
     * Scoring the whole passage used to catch these by accident - unreached
     * words hold no frames, so they score nothing and get marked - which is
     * why removing that made every `stopped-early` clip pass.
     *
     * This read, for a while, that the app could not present an unfinished
     * run as a clean page because the summary counted the page's words. It
     * could: `requestVerdict` replaced the total with the stretch it judged,
     * so three words of a hundred and twenty showed as a complete, clean
     * page, and this runner credited the app with 496 of 501 verdicts it
     * never reached. The app now carries `stoppedShort` into the summary,
     * and both sides read the rule from the same place.
     */
    const unreached = expected.length - span.to;
    const short = stoppedShort(expected.length, span);

    return {
      verdict: misread.length > 0 || short ? "mistake" : "correct",
      detail:
        `${misread.length}/${judged.length} words marked across ` +
        `${keys.length} ayah(s), ${skipped.size} skipped by the cursor` +
        (unreached > 0 ? `, ${unreached} never reached` : ""),
    };
  };
}
