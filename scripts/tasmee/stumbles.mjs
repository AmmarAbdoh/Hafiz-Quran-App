/*
 * What the cursor's stumble is worth, to the reciter and to the verdict.
 *
 * The one mistake no pass over the audio can find: a word said wrongly and
 * then said correctly is in the recording twice, the alignment is monotonic
 * and places each label once, so it places the word on the attempt that
 * supports it - and the word scores well. The evidence is not in the audio,
 * it is in the order the audio arrived in, and only the live cursor was there
 * for it, for the 480ms it took to notice.
 *
 * So the cursor reports it and the summary lists it. This measures the two
 * things that decision turns on: how often it fires on a recitation with
 * nothing wrong with it, and whether listing it also catches mistakes the
 * marking rule misses. Replays both caches; no model pass.
 *
 *   node scripts/tasmee/stumbles.mjs [--fixtures DIR]
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
  stoppedShort,
} from "../../src/features/recitation-practice/model/practiceVerdict.ts";

const FIXTURES = path.resolve(
  flag("fixtures", "scripts/tasmee/fixtures-large"),
);
const MODEL_DIR = process.env.TASMEE_ZIPFORMER_DIR ?? ".models/zipformer";
/** Cursor options to compare, as JSON; see `TrackerOptions`. */
const TRACKER_OPTIONS = JSON.parse(process.env.TASMEE_TRACKER ?? "{}");
/** How often the worker posts phonemes: 48 fbank frames at a 10ms shift. */
const CHUNK_SECONDS = 48 * 0.01;

/** The adopted aggregation; see aggregate.mjs. */
const lowerQuartile = (supports) =>
  supports[Math.floor((supports.length - 1) * 0.25)] ?? 0;

/** Replay a clip through the tracker the reader uses. */
function follow(expected, units) {
  const tracker = createPhonemeTracker(expected, TRACKER_OPTIONS);
  const skipped = new Set();
  const stumbled = new Set();
  let fires = 0;

  for (let at = 0; at < units.length; ) {
    const until = units[at][2] + CHUNK_SECONDS;
    const chunk = [];
    while (at < units.length && units[at][2] < until) {
      const [symbol, confidence, seconds, alternatives] = units[at];
      chunk.push({
        id: 0,
        symbol,
        confidence,
        seconds,
        alternatives: alternatives?.map(([other, probability]) => ({
          symbol: other,
          probability,
        })),
      });
      at += 1;
    }
    const progress = advanceTracker(tracker, chunk);
    for (const location of progress.skipped) skipped.add(location);
    /* Said after all: the cursor went past them and the reciter came back. */
    for (const word of progress.completed) {
      for (const location of word.locations) skipped.delete(location);
    }
    for (const stumble of progress.stumbles) {
      fires += 1;
      for (const location of stumble.locations) stumbled.add(location);
    }
  }

  return { skipped, stumbled, fires };
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
    console.log("Needs both caches: run measure.mjs first.");
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
  const totals = { mistakes: 0, corrects: 0 };
  const marked = { fa: 0, fr: 0 };
  const listed = { fa: 0, fr: 0 };

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
    /* The cache scores only the stretch the reciter reached, because that is
       all the app scores. */
    const span = row.span ?? { from: 0, to: expected.length };
    const judged = expected.slice(span.from, span.to);
    if (expected.length === 0 || judged.length !== row.supports.length)
      continue;

    const { skipped, stumbled, fires } = follow(expected, heard.units);

    const words = judged.map((word, index) => ({
      ayah: word.ayah,
      score: lowerQuartile(row.supports[index]),
      skipped: word.locations.some((location) => skipped.has(location)),
    }));

    const short = stoppedShort(expected.length, span);
    const asMarked = short || findMisreadWords(words).length > 0;
    /* What the summary now shows: the words marked, and the stumbles. */
    const asListed = asMarked || fires > 0;

    const group = kinds.get(row.kind) ?? {
      clips: 0,
      stumbling: 0,
      words: 0,
      fires: 0,
      marked: 0,
      listed: 0,
    };
    group.clips += 1;
    if (stumbled.size > 0) group.stumbling += 1;
    group.words += stumbled.size;
    group.fires += fires;
    kinds.set(row.kind, group);

    if (row.verdict === "mistake") {
      totals.mistakes += 1;
      group.marked += asMarked ? 1 : 0;
      group.listed += asListed ? 1 : 0;
      if (!asMarked) marked.fa += 1;
      if (!asListed) listed.fa += 1;
    } else {
      totals.corrects += 1;
      group.marked += asMarked ? 0 : 1;
      group.listed += asListed ? 0 : 1;
      if (asMarked) marked.fr += 1;
      if (asListed) listed.fr += 1;
    }
  }

  const clips = totals.mistakes + totals.corrects;
  const pct = (part, whole) => `${((part / whole) * 100).toFixed(1)}%`;

  console.log(`${clips} clips\n`);
  console.log("kind              clips   with a stumble   words   fires");
  console.log("-".repeat(58));
  for (const kind of [...kinds.keys()].sort()) {
    const group = kinds.get(kind);
    console.log(
      `  ${kind.padEnd(16)}${String(group.clips).padStart(4)}` +
        `${String(group.stumbling).padStart(10)} (${pct(group.stumbling, group.clips).padStart(5)})` +
        `${String(group.words).padStart(8)}${String(group.fires).padStart(8)}`,
    );
  }

  const line = (label, result) =>
    console.log(
      `${label.padEnd(20)}` +
        `${String(result.fa).padStart(4)}/${totals.mistakes} (${pct(result.fa, totals.mistakes).padStart(5)})` +
        `${String(result.fr).padStart(8)}/${totals.corrects} (${pct(result.fr, totals.corrects).padStart(5)})` +
        `      ${pct(clips - result.fa - result.fr, clips).padStart(5)}`,
    );

  console.log("\nwhat listing the stumbles is worth:");
  console.log(
    "                      missed mistakes   wrongly flagged   overall",
  );
  console.log("-".repeat(66));
  line("words marked", marked);
  line("+ stumbles listed", listed);

  console.log("\nright answers by kind:");
  for (const kind of [...kinds.keys()].sort()) {
    const group = kinds.get(kind);
    console.log(
      `  ${kind.padEnd(16)}${String(group.marked).padStart(4)}/${group.clips}` +
        ` -> ${String(group.listed).padStart(4)}/${group.clips}`,
    );
  }
}

await main();
