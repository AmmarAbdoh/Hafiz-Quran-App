/*
 * How far behind the reciter does the cursor run, over a whole recitation?
 *
 * `cursor.mjs` counts the words the cursor lights on a clip. It cannot say
 * when: its clips have no timings, and they are one ayah or one page, cut
 * clean. `fixtures-qud` (see `build-qud-fixtures.mjs`) is whole recitations
 * with every word's start and end reviewed by hand, so this follows the
 * cursor through them exactly as the app does and compares the moment each
 * word lights with the moment it was said:
 *
 *   lit        the share of recited words the cursor lit at all
 *   lag        seconds from the end of the word to its lighting, median and
 *              90th percentile, for the first time each word was recited
 *   early      words lit before the reciter began them - the cursor jumping
 *              ahead on its own
 *   stumbles   "something else was said here", per minute, while the
 *              reciter was reciting; every one is false, as nothing in this
 *              set is recited wrongly
 *   aside      the same, while nothing of the Quran was being said - the
 *              takbir in prayer, the end of the previous track - where
 *              "something else was said" is true
 *   skips      words the cursor reported going past unsaid and never heard
 *              afterwards, per minute - the app withdraws a report when the
 *              word turns up later, as it does when a reciter goes back;
 *              also all false
 *
 * Timing is the audio's, at the cadence the worker posts phonemes (every
 * 480ms of audio). The model's own look-ahead comes on top in the app.
 *
 *   node scripts/tasmee/cursor-timing.mjs [--fixtures scripts/tasmee/fixtures-qud]
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { flag } from "./lib/args.mjs";
import { readWavAsFloat32 } from "./lib/audio.mjs";
import { spokenPosition } from "./lib/quranText.mjs";
import { createZipformer } from "./lib/zipformer.mjs";
import {
  parseTokenTable,
  toPhonemeUnits,
} from "../../src/features/recitation-practice/model/phonemeTokens.ts";
import {
  createCtcStreamState,
  decodeChunk,
} from "../../src/features/recitation-practice/model/ctcGreedy.ts";
import {
  advanceTracker,
  createPhonemeTracker,
  expectNextPage,
} from "../../src/features/recitation-practice/model/phonemeProgress.ts";

const MODEL_DIR = process.env.TASMEE_ZIPFORMER_DIR ?? ".models/zipformer";
const FIXTURES = path.resolve(flag("fixtures", "scripts/tasmee/fixtures-qud"));
/** The worker posts phonemes every 48 fbank frames at a 10ms shift. */
const POST_SECONDS = 48 * 0.01;
/** Cursor options to compare, as JSON; see `TrackerOptions`. */
const TRACKER_OPTIONS = JSON.parse(process.env.TASMEE_TRACKER ?? "{}");
/**
 * A stumble with no recited word in the last this many seconds came while
 * the reciter was saying something else. Six stray sounds take about this
 * long at a murattal pace.
 */
const ASIDE_SECONDS = 2;
/** Lit this long before the word began is the cursor ahead of the reciter. */
const EARLY_SECONDS = 1;
/**
 * The silence the worker appends when a recitation ends (`FLUSH_SAMPLES`),
 * one more 61-frame window. Without it the last 0.6s is never recognised,
 * and four of these recordings end inside their last word.
 */
const FLUSH_SAMPLES = 61 * 160;

/** The phonemes the app's cursor would see, per clip; cached. */
async function emissions(clips) {
  const cachePath = path.join(FIXTURES, ".cursor-units.json");
  let cache = {};
  try {
    cache = JSON.parse(await readFile(cachePath, "utf8"));
  } catch {
    /* first run */
  }
  const missing = clips.filter((clip) => !cache[clip.id]);
  if (missing.length > 0) {
    const zipformer = await createZipformer({
      modelPath: `${MODEL_DIR}/zipformer_p_arabic_v3.1.int8.onnx`,
      tokensPath: `${MODEL_DIR}/tokens.txt`,
    });
    for (const clip of missing) {
      const started = Date.now();
      const audio = await readWavAsFloat32(path.join(FIXTURES, clip.audio));
      const samples = audio.samples ?? audio;
      const flushed = new Float32Array(samples.length + FLUSH_SAMPLES);
      flushed.set(samples);
      const { logProbs, frames, vocab } = await zipformer.logProbsFor(flushed);
      cache[clip.id] = decodeChunk(
        logProbs,
        frames,
        vocab,
        zipformer.symbols,
        zipformer.blankId,
        createCtcStreamState(),
      );
      /* Written after each, so a long run that stops keeps what it did. */
      await writeFile(cachePath, JSON.stringify(cache), "utf8");
      console.log(
        `  ${clip.id}: ${Math.round(clip.seconds / 60)} min of audio in ${Math.round((Date.now() - started) / 1000)}s`,
      );
    }
  }
  return cache;
}

/** The mushaf page each ayah begins on, from the app's own page layouts. */
async function versePages() {
  const dir = "public/data/quran/v1/layout/pages";
  const pages = new Map();
  for (const file of (await readdir(dir)).sort()) {
    const { lines } = JSON.parse(
      gunzipSync(await readFile(path.join(dir, file))).toString("utf8"),
    );
    for (const word of lines.flatMap((line) => line.words)) {
      if (!pages.has(word.verse_key)) pages.set(word.verse_key, word.page);
    }
  }
  return pages;
}

const percentile = (values, share) => {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(share * sorted.length))];
};

async function main() {
  const { clips } = JSON.parse(
    await readFile(path.join(FIXTURES, "manifest.json"), "utf8"),
  );
  const quran = JSON.parse(
    await readFile(`${MODEL_DIR}/ordered_quran_phonemes.json`, "utf8"),
  );
  const { inventory } = parseTokenTable(
    await readFile(`${MODEL_DIR}/tokens.txt`, "utf8"),
  );
  console.log(
    `Recognising ${clips.length} recordings (cached after the first run)…`,
  );
  const unitsOf = await emissions(clips);

  const pageOf = await versePages();

  const rows = [];
  for (const clip of clips) {
    /*
     * One page at a time, as the app follows a recitation: a fresh cursor
     * on each, the next page once it finishes. A whole surah given to one
     * cursor finds far more places for a run of sounds to fit, and jumps
     * the app could never make. Ayat are kept whole, on the page they begin;
     * and the next page is the next one recited, as the app's search for an
     * ayah begun off the page finds a prayer's surah after Al-Faatihah.
     *
     * Which is as far as prayer goes. Each rak'ah ends partway down a page
     * and the next begins with Al-Faatihah again, neither of which the app
     * follows mid-run, so prayer is totalled apart: it is not what the
     * cursor is for, and its stumbles there would drown the rest.
     */
    const passages = [];
    let page = null;
    for (const key of clip.verseKeys) {
      if (pageOf.get(key) !== page) passages.push([]);
      page = pageOf.get(key);
      for (const [index, word] of (
        quran[key]?.aya_phonemes_list ?? []
      ).entries()) {
        const units = toPhonemeUnits(word, inventory);
        if (units.length > 0)
          passages.at(-1).push({ locations: [`${key}:${index + 1}`], units });
      }
    }

    /*
     * When each word was first said, numbered as the cursor numbers words:
     * as they are spoken. The truth counts the mushaf's words, which the
     * model's text splits the same way in all but four ayat; two written
     * words said as one (112:4's يَكُن لَّهُۥ) share a spoken word.
     */
    const said = new Map();
    for (const word of clip.truth) {
      const [surah, ayah, position] = word.word.split(":");
      const key = `${surah}:${ayah}`;
      const spoken = quran[key]
        ? spokenPosition(quran[key], Number(position) - 1, inventory)
        : null;
      if (!spoken) continue;
      const location = `${key}:${spoken}`;
      if (!said.has(location)) said.set(location, word);
    }

    /* Followed as the worker posts: everything emitted in each 480ms. */
    let onPage = 0;
    const turnTo = (page) => {
      const next = createPhonemeTracker(passages[page], TRACKER_OPTIONS);
      expectNextPage(next, passages[page + 1] ?? []);
      return next;
    };
    let tracker = turnTo(0);
    const lit = new Map();
    let stumbles = 0;
    let aside = 0;
    const reciting = (at) =>
      clip.truth.some(
        (word) => word.start_s < at && word.end_s > at - ASIDE_SECONDS,
      );
    const skipped = new Set();
    let finished = false;
    const follow = (heard, posted) => {
      const progress = advanceTracker(tracker, heard);
      for (const location of progress.skipped) skipped.add(location);
      for (const word of progress.completed) {
        for (const location of word.locations) {
          skipped.delete(location);
          /* The first lighting after it was begun; a repeat lights again. */
          const begun = said.get(location)?.start_s ?? 0;
          if (!lit.has(location) || lit.get(location) < begun - EARLY_SECONDS)
            lit.set(location, posted);
        }
      }
      if (reciting(posted)) stumbles += progress.stumbles.length;
      else aside += progress.stumbles.length;
      if (!progress.finished) return;
      /* What the app does too: everything heard after the page finished,
         the rest of this batch included, goes on to the next page. */
      if (onPage === passages.length - 1) {
        finished = true;
        return;
      }
      onPage += 1;
      tracker = turnTo(onPage);
      if (progress.carriedOver.length > 0) {
        follow(progress.carriedOver, posted);
      }
    };
    const units = unitsOf[clip.id];
    for (let at = 0; at < units.length; ) {
      const window = Math.floor(units[at].seconds / POST_SECONDS);
      const chunk = [];
      while (
        at < units.length &&
        Math.floor(units[at].seconds / POST_SECONDS) === window
      ) {
        chunk.push(units[at]);
        at += 1;
      }
      if (!finished) follow(chunk, (window + 1) * POST_SECONDS);
    }

    const lags = [];
    let early = 0;
    for (const [location, word] of said) {
      const when = lit.get(location);
      if (when === undefined) continue;
      if (when < word.start_s - EARLY_SECONDS) early += 1;
      else lags.push(when - word.end_s);
    }
    const minutes = clip.seconds / 60;
    rows.push({
      id: clip.id,
      kind: clip.kind,
      noisy: clip.noisy,
      repeats: clip.repeats,
      minutes,
      words: said.size,
      lit: lags.length + early,
      early,
      lags,
      stumbles,
      aside,
      skips: skipped.size,
      finished,
    });
  }

  const fmt = (value, digits = 1) =>
    Number.isFinite(value) ? value.toFixed(digits) : "-";
  console.log(
    "\nrecording                     kind      min  words   lit   lag p50  lag p90  early  stumbles/min  skips/min  aside  end",
  );
  console.log("-".repeat(125));
  for (const row of rows.sort((a, b) => a.kind.localeCompare(b.kind))) {
    console.log(
      `${row.id.padEnd(30)}${row.kind.padEnd(9)}${fmt(row.minutes, 0).padStart(4)} ${String(row.words).padStart(6)} ` +
        `${fmt((100 * row.lit) / row.words).padStart(5)}%  ${fmt(percentile(row.lags, 0.5)).padStart(6)}s  ` +
        `${fmt(percentile(row.lags, 0.9)).padStart(6)}s ${String(row.early).padStart(6)}  ` +
        `${fmt(row.stumbles / row.minutes, 2).padStart(12)}  ${fmt(row.skips / row.minutes, 2).padStart(9)}  ${String(row.aside).padStart(5)}  ${row.finished ? "yes" : "no"}` +
        `${row.noisy ? "  noisy" : ""}${row.repeats ? `  ${row.repeats} repeats` : ""}`,
    );
  }
  const total = (label, group) => {
    const all = (pick) => group.reduce((sum, row) => sum + pick(row), 0);
    const lags = group.flatMap((row) => row.lags);
    console.log(
      `${label}: ${fmt((100 * all((r) => r.lit)) / all((r) => r.words))}% of ${all((r) => r.words)} words lit, ` +
        `lag ${fmt(percentile(lags, 0.5))}s median / ${fmt(percentile(lags, 0.9))}s p90, ` +
        `${all((r) => r.early)} lit early, ` +
        `${fmt(all((r) => r.stumbles) / all((r) => r.minutes), 2)} stumbles and ` +
        `${fmt(all((r) => r.skips) / all((r) => r.minutes), 2)} skips a minute, all false.`,
    );
  };
  const recited = rows.filter((row) => row.kind !== "prayer");
  console.log("");
  total(`Recitation, ${recited.length}`, recited);
  total(
    "Prayer",
    rows.filter((row) => row.kind === "prayer"),
  );
}

await main();
