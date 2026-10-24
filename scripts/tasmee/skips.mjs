/*
 * What is the cursor's word worth?
 *
 * `aggregate.mjs` established that the verdict's limit is not the rule but
 * the number it reads: four rule families and nine ways of reducing a word
 * to one score all landed near 22% of mistakes missed. The cache says why,
 * precisely. At the chosen operating point:
 *
 *   as-recited     54 clips with no weak word, 78 with exactly one
 *   word-dropped    0 clips with no weak word, 34 with exactly one
 *   word-swapped    0 clips with no weak word, 34 with exactly one
 *
 * Tolerating one weak word per ayah is what keeps those 78 correct
 * recitations from being accused - and it is the same tolerance that waves
 * through those 68 real mistakes. 68 is exactly the false-accept count. The
 * whole of the remaining error is one rule forgiving one word, and no
 * function of the scores can separate the two groups, because in both of
 * them the scores say the same thing: one word is weak.
 *
 * So the separating evidence has to come from outside the scores. The live
 * cursor has some: it follows the recitation word by word and reports the
 * words it was carried past without hearing. This measures whether that is
 * enough, over both caches at once - no model pass.
 *
 *   node scripts/tasmee/skips.mjs
 */
import { flag } from "./lib/args.mjs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  parseTokenTable,
  toPhonemeUnits,
} from "../../src/features/recitation-practice/model/phonemeTokens.ts";
import {
  advanceTracker,
  createPhonemeTracker,
} from "../../src/features/recitation-practice/model/phonemeProgress.ts";
import {
  findMisreadWords,
  SKIP_CONFIRMS_BELOW,
  stoppedShort,
} from "../../src/features/recitation-practice/model/practiceVerdict.ts";

const FIXTURES = path.resolve(
  flag("fixtures", "scripts/tasmee/fixtures-large"),
);
const MODEL_DIR = process.env.TASMEE_ZIPFORMER_DIR ?? ".models/zipformer";
/** One encoder window, which is how often the worker posts phonemes. */
/**
 * How often the worker posts phonemes: 48 fbank frames at a 10ms shift.
 *
 * 480ms, not the 1.92s this read when it took 48 for encoder frames. The
 * tracker is driven by the order of the phonemes rather than their timing, so
 * the two agree on these fixtures - but only one of them is what the app does.
 */
const CHUNK_SECONDS = 48 * 0.01;

/** The adopted aggregation; see aggregate.mjs. */
const lowerQuartile = (supports) =>
  supports[Math.floor((supports.length - 1) * 0.25)] ?? 0;

/** Replay a clip's phonemes through the tracker the reader uses. */
function skippedWords(expected, units) {
  const tracker = createPhonemeTracker(expected);
  const skipped = new Set();

  for (let at = 0; at < units.length; ) {
    const until = units[at][2] + CHUNK_SECONDS;
    const chunk = [];
    while (at < units.length && units[at][2] < until) {
      const [symbol, confidence, seconds] = units[at];
      chunk.push({ id: 0, symbol, confidence, seconds });
      at += 1;
    }
    const progress = advanceTracker(tracker, chunk);
    for (const location of progress.skipped) skipped.add(location);
    /* Said after all: the cursor went past them and the reciter came back.
       The app withdraws the skip here, and keeping it made the cursor's
       evidence look stronger than the reader's copy of it. */
    for (const word of progress.completed) {
      for (const location of word.locations) skipped.delete(location);
    }
  }

  return skipped;
}

async function main() {
  let scores;
  let emissions;
  try {
    scores = JSON.parse(
      await readFile(path.join(FIXTURES, ".scores.json"), "utf8"),
    );
    emissions = JSON.parse(
      await readFile(path.join(FIXTURES, ".emissions.json"), "utf8"),
    );
  } catch {
    console.log("Needs both caches: run sweep.mjs and cursor.mjs first.");
    return;
  }

  const quran = JSON.parse(
    await readFile(`${MODEL_DIR}/ordered_quran_phonemes.json`, "utf8"),
  );
  const { inventory } = parseTokenTable(
    await readFile(`${MODEL_DIR}/tokens.txt`, "utf8"),
  );
  const byId = new Map(emissions.map((row) => [row.id, row]));

  const kinds = new Map();
  /** Every clip's words, kept so the bound can be swept in memory. */
  const swept = [];
  const totals = { mistakes: 0, corrects: 0 };
  const withSkips = { fa: 0, fr: 0 };
  const without = { fa: 0, fr: 0 };
  let reported = 0;

  for (const row of scores) {
    const heard = byId.get(row.id);
    if (!heard) continue;

    /* One ayah or a whole page, the same shape `measure.mjs` caches. */
    const expected = [];
    for (const key of heard.verseKeys ?? [heard.verseKey]) {
      const ayah = quran[key];
      if (!ayah) continue;
      for (const [index, word] of ayah.aya_phonemes_list.entries()) {
        const units = toPhonemeUnits(word, inventory);
        /* The tolerance is per ayah, so each word carries which one. */
        if (units.length > 0) {
          expected.push({
            ayah: key,
            locations: [`${key}:${index + 1}`],
            units,
          });
        }
      }
    }
    /*
     * The cache scores only the stretch the reciter reached, because that is
     * all the app scores. Everything here is judged over that slice.
     */
    const span = row.span ?? { from: 0, to: expected.length };
    const judged = expected.slice(span.from, span.to);
    // A clip whose two caches disagree would score the wrong words.
    if (expected.length === 0 || judged.length !== row.supports.length)
      continue;

    const skipped = skippedWords(expected, heard.units);
    if (skipped.size > 0) reported += 1;

    const words = judged.map((word, index) => ({
      ayah: word.ayah,
      score: lowerQuartile(row.supports[index]),
      skipped: word.locations.some((location) => skipped.has(location)),
    }));

    /*
     * Not reaching the end is its own answer, and not the aligner's to give.
     * The rule lives beside the marking rule, so the reader and the bench
     * cannot drift apart on it again.
     */
    const short = stoppedShort(expected.length, span);

    const marked = short || findMisreadWords(words).length > 0;
    const blind =
      short ||
      findMisreadWords(words.map((word) => ({ ...word, skipped: false })))
        .length > 0;

    const group = kinds.get(row.kind) ?? { clips: 0, caught: 0, blind: 0 };
    group.clips += 1;
    kinds.set(row.kind, group);

    if (row.verdict === "mistake") {
      totals.mistakes += 1;
      group.caught += marked ? 1 : 0;
      group.blind += blind ? 1 : 0;
      if (!marked) withSkips.fa += 1;
      if (!blind) without.fa += 1;
    } else {
      totals.corrects += 1;
      group.caught += marked ? 0 : 1;
      group.blind += blind ? 0 : 1;
      if (marked) withSkips.fr += 1;
      if (blind) without.fr += 1;
    }

    swept.push({ verdict: row.verdict, words, stoppedShort: short });
  }

  const clips = totals.mistakes + totals.corrects;
  const pct = (part, whole) => `${((part / whole) * 100).toFixed(1)}%`;
  const line = (label, result) =>
    console.log(
      `${label.padEnd(18)}` +
        `${String(result.fa).padStart(4)}/${totals.mistakes} (${pct(result.fa, totals.mistakes).padStart(5)})` +
        `${String(result.fr).padStart(8)}/${totals.corrects} (${pct(result.fr, totals.corrects).padStart(5)})` +
        `      ${pct(clips - result.fa - result.fr, clips).padStart(5)}`,
    );

  console.log(
    `${clips} clips, the cursor reported a skip in ${reported} of them\n`,
  );
  console.log("                  missed mistakes   wrongly flagged   overall");
  console.log("-".repeat(62));
  line("alignment only", without);
  line("+ cursor skips", withSkips);

  /*
   * How far below the threshold a word the cursor skipped has to fall
   * before its report is acted on. 0.2 is the threshold itself, which is
   * the row above; a smaller bound demands a word barely heard at all.
   */
  console.log("\nhow strict to be about a word the cursor skipped:");
  console.log("  below   missed mistakes   wrongly flagged   overall");
  const bounds = [0, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2];
  if (!bounds.includes(SKIP_CONFIRMS_BELOW)) bounds.push(SKIP_CONFIRMS_BELOW);
  for (const bound of bounds.sort((a, b) => a - b)) {
    const result = { fa: 0, fr: 0 };
    for (const clip of swept) {
      const marked =
        clip.stoppedShort || findMisreadWords(clip.words, bound).length > 0;
      if (clip.verdict === "mistake") {
        if (!marked) result.fa += 1;
      } else if (marked) result.fr += 1;
    }
    console.log(
      `  ${String(bound).padEnd(6)}` +
        `${String(result.fa).padStart(5)}/${totals.mistakes} (${pct(result.fa, totals.mistakes).padStart(5)})` +
        `${String(result.fr).padStart(8)}/${totals.corrects} (${pct(result.fr, totals.corrects).padStart(5)})` +
        `      ${pct(clips - result.fa - result.fr, clips).padStart(5)}` +
        `${bound === SKIP_CONFIRMS_BELOW ? "   <- adopted" : ""}`,
    );
  }

  console.log("\nright answers by kind:");
  for (const kind of [...kinds.keys()].sort()) {
    const group = kinds.get(kind);
    console.log(
      `  ${kind.padEnd(16)}${String(group.blind).padStart(4)}/${group.clips}` +
        ` -> ${String(group.caught).padStart(4)}/${group.clips}`,
    );
  }
}

await main();
