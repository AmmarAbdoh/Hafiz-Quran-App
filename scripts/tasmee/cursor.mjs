/*
 * Does the cursor keep up with a recitation?
 *
 * Everything else in here judges the *verdict* - whether a mistake was
 * caught. This measures the other half, which had never been measured at
 * all: the live cursor, the thing a reciter actually watches. It was
 * reported from real use as "I don't always see the words appear", and the
 * cause was exact symbol matching against a table that encodes madd length
 * by repetition, so `ااااا` from the microphone did not satisfy `اااااا` on
 * the page. 26.5% of the Quran's expected units carry a length like that.
 *
 * The emissions are what the app's own worker posts, so this follows the
 * same `advanceTracker` the reader does, on the same audio. Cached after the
 * first run; the model is ten minutes, the sweep is a second.
 *
 *   node scripts/tasmee/cursor.mjs [--fixtures scripts/tasmee/fixtures-large]
 */
import { flag } from "./lib/args.mjs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createZipformer } from "./lib/zipformer.mjs";
import { readWavAsFloat32 } from "./lib/audio.mjs";
import {
  parseTokenTable,
  toPhonemeUnits,
} from "../../src/features/recitation-practice/model/phonemeTokens.ts";
import {
  advanceTracker,
  createPhonemeTracker,
} from "../../src/features/recitation-practice/model/phonemeProgress.ts";

const MODEL_DIR = process.env.TASMEE_ZIPFORMER_DIR ?? ".models/zipformer";
/** Cursor options to compare, as JSON; see `TrackerOptions`. */
const TRACKER_OPTIONS = JSON.parse(process.env.TASMEE_TRACKER ?? "{}");
/** One encoder window, which is how often the worker posts phonemes. */
/**
 * How often the worker posts phonemes: 48 fbank frames at a 10ms shift.
 *
 * 480ms, not the 1.92s this read when it took 48 for encoder frames. The
 * tracker is driven by the order of the phonemes rather than their timing, so
 * the two agree on these fixtures - but only one of them is what the app does.
 */
const CHUNK_SECONDS = 48 * 0.01;

/** Run the model over every clip and keep the phonemes it emitted. */
async function collect(fixtures, cachePath) {
  try {
    return JSON.parse(await readFile(cachePath, "utf8"));
  } catch {
    /* no cache yet */
  }

  const zipformer = await createZipformer({
    modelPath: `${MODEL_DIR}/zipformer_p_arabic_v3.1.int8.onnx`,
    tokensPath: `${MODEL_DIR}/tokens.txt`,
  });
  const manifest = JSON.parse(
    await readFile(path.join(fixtures, "manifest.json"), "utf8"),
  );

  const rows = [];
  let done = 0;
  for (const clip of manifest.clips) {
    const audio = await readWavAsFloat32(path.join(fixtures, clip.audio));
    const { units } = await zipformer.recognise(audio.samples ?? audio);
    rows.push({
      id: clip.id,
      kind: clip.kind,
      verdict: clip.verdict,
      verseKeys: clip.verseKeys ?? [clip.verseKey],
      units: units.map((unit) => [
        unit.symbol,
        Number(unit.confidence.toFixed(3)),
        Number(unit.seconds.toFixed(2)),
      ]),
    });
    done += 1;
    if (done % 50 === 0) console.log(`  recognised ${done}…`);
  }

  await writeFile(cachePath, JSON.stringify(rows), "utf8");
  return rows;
}

/** Feed a clip's phonemes through the tracker as the worker would. */
function follow(expected, units) {
  const tracker = createPhonemeTracker(expected, TRACKER_OPTIONS);
  let wrongAttempts = 0;
  let skipped = 0;
  let finished = false;
  let completed = 0;

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
    wrongAttempts += progress.stumbles.length;
    skipped += progress.skipped.length;
    completed += progress.completed.length;
    if (progress.finished) finished = true;
  }

  return { wrongAttempts, skipped, finished, completed };
}

async function main() {
  const fixtures = path.resolve(
    flag("fixtures", "scripts/tasmee/fixtures-large"),
  );
  const cachePath = path.join(fixtures, ".emissions.json");

  console.log("Recognising clips (cached after the first run)…");
  const rows = await collect(fixtures, cachePath);
  const quran = JSON.parse(
    await readFile(`${MODEL_DIR}/ordered_quran_phonemes.json`, "utf8"),
  );
  const { inventory } = parseTokenTable(
    await readFile(`${MODEL_DIR}/tokens.txt`, "utf8"),
  );

  const byKind = new Map();
  for (const row of rows) {
    /* One ayah or a whole passage; the resync searches all of it. */
    const keys = row.verseKeys ?? [row.verseKey];
    const expected = [];
    for (const key of keys) {
      const ayah = quran[key];
      if (!ayah) continue;
      for (const [index, word] of ayah.aya_phonemes_list.entries()) {
        const units = toPhonemeUnits(word, inventory);
        if (units.length > 0) {
          expected.push({ locations: [`${key}:${index + 1}`], units });
        }
      }
    }
    if (expected.length === 0) continue;

    const result = follow(expected, row.units);
    const group = byKind.get(row.kind) ?? {
      clips: 0,
      reached: 0,
      words: 0,
      completed: 0,
      /*
       * The same count with each clip's last word left out of both sides.
       *
       * The clips are cut at the word timestamps quran.com publishes, and
       * those run short: on `w-correct-husary-1_7` the audio stops two
       * phonemes into the final word, which therefore cannot be recited in
       * full however well the cursor follows. Reporting only the raw figure
       * would charge the tracker for the fixtures' own edges.
       */
      inner: 0,
      innerWords: 0,
      wrongAttempts: 0,
      skipped: 0,
      /* Clips where the reciter would have been stopped at least once. */
      stoppedClips: 0,
    };
    group.clips += 1;
    group.reached += result.finished ? 1 : 0;
    group.words += expected.length;
    group.completed += Math.min(result.completed, expected.length);
    group.innerWords += expected.length - 1;
    group.inner += Math.min(result.completed, expected.length - 1);
    group.wrongAttempts += result.wrongAttempts;
    group.stoppedClips += result.wrongAttempts > 0 ? 1 : 0;
    group.skipped += result.skipped;
    byKind.set(row.kind, group);
  }

  console.log(`\n${rows.length} clips\n`);
  console.log(
    "kind            clips   words lit   all but last   reached end  stalls  skips  stopped",
  );
  console.log("-".repeat(80));
  const order = [...byKind.keys()].sort();
  for (const kind of order) {
    const g = byKind.get(kind);
    console.log(
      `${kind.padEnd(16)}${String(g.clips).padStart(4)}   ` +
        `${((g.completed / g.words) * 100).toFixed(1).padStart(8)}%   ` +
        `${((g.inner / g.innerWords) * 100).toFixed(1).padStart(10)}%   ` +
        `${((g.reached / g.clips) * 100).toFixed(0).padStart(10)}%  ` +
        `${String(g.wrongAttempts).padStart(6)} ${String(g.skipped).padStart(6)}` +
        `${((g.stoppedClips / g.clips) * 100).toFixed(1).padStart(8)}%`,
    );
  }

  /*
   * The number that matters: on a recitation with nothing wrong with it, the
   * cursor should light every word and reach the end.
   */
  const clean = byKind.get("as-recited");
  if (clean) {
    console.log(
      `\nOn correct recitations the cursor lit ` +
        `${((clean.inner / clean.innerWords) * 100).toFixed(1)}% of every word ` +
        `but each clip's last, and ` +
        `${((clean.completed / clean.words) * 100).toFixed(1)}% including it.`,
    );
  }
}

await main();
