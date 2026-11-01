/*
 * Slipping from one ayah into its twin, in the reciter's own voice.
 *
 * The commonest mistake in memorising is not a forgotten word but a wrong
 * turn: two ayat open with the same words, and the reciter carries on with
 * the other one. 2:62 and 5:69 share five words and then part. The word sets
 * beside this one manufacture mistakes from words of the same ayah, which the
 * cursor reasonably reads as a jump or a repeat; this is the mistake it has
 * special handling for (`slippedIntoTwin`), measured at scale.
 *
 * Twins are ayat whose first three or more words are phoneme-for-phoneme the
 * same and which then part, both with at least two words after the parting.
 * One twin per ayah, the one sharing most; ayat spread evenly over the
 * mushaf. Each pair is recited by professional voices from Quran.com's audio
 * (the same source as `build-word-fixtures.mjs`), so both ayat are in one
 * voice, and cut into words by our own alignment (`lib/wordCuts.mjs`).
 *
 *   as-recited      ayah A, unchanged                         correct
 *   twin-corrected  A's shared opening, two words of B,       corrected at
 *                   then A from where it parted               A's parting word
 *   twin-continued  A's shared opening, then B to its end     mistake at
 *                                                             A's parting word
 *
 * Tagged `split: tune | test` by pair, alternating in mushaf order.
 *
 *   node scripts/tasmee/build-twin-slips.mjs [--pairs 300] [--reciters husary,alafasy,minshawi] [--workers 8]
 */
import { flag } from "./lib/args.mjs";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { availableParallelism } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { download, readWavAsFloat32, toWav } from "./lib/audio.mjs";
import { getExpectedText } from "./lib/quranText.mjs";
import {
  alignAll,
  alignWorker,
  boundaries,
  join,
  wav,
} from "./lib/wordCuts.mjs";
import { RECITER_QURAN_COM_IDS } from "../../src/domain/quran/audio/quranComReciters.ts";

const API = "https://api.quran.com/api/v4";
const OUT = path.resolve("scripts/tasmee/fixtures-twins");
const CLIPS = path.join(OUT, "clips");
const WORK = path.join(OUT, ".work");
/* The professional set's downloads, reused rather than fetched twice. */
const LARGE_WORK = path.resolve("scripts/tasmee/fixtures-large/.work");
const MODEL_DIR = process.env.TASMEE_ZIPFORMER_DIR ?? ".models/zipformer";

const RECITERS = {
  husary: "ea-Husary_128kbps",
  alafasy: "ea-Alafasy_128kbps",
  minshawi: "ea-Minshawy_Murattal_128kbps",
};
/* Words that must be shared before a wrong turn is a slip into a twin. */
const SHARED_AT_LEAST = 3;
/* Words of the twin said before the reciter notices. */
const WRONG_WORDS = 2;

/** One twin per ayah: the one sharing the longest opening. */
function findTwins(quran) {
  const keys = Object.keys(quran);
  const words = new Map(
    keys.map((key) => [
      key,
      quran[key].aya_phonemes_list.map((word) => word.replace(/\s/g, "")),
    ]),
  );
  const byOpening = new Map();
  for (const key of keys) {
    const list = words.get(key);
    if (list.length < SHARED_AT_LEAST + 2) continue;
    const opening = list.slice(0, SHARED_AT_LEAST).join("|");
    (byOpening.get(opening) ?? byOpening.set(opening, []).get(opening)).push(
      key,
    );
  }
  const twins = [];
  for (const key of keys) {
    const mine = words.get(key);
    const group = byOpening.get(mine.slice(0, SHARED_AT_LEAST).join("|"));
    let best = null;
    for (const other of group ?? []) {
      if (other === key) continue;
      const theirs = words.get(other);
      let shared = 0;
      while (
        shared < mine.length &&
        shared < theirs.length &&
        mine[shared] === theirs[shared]
      ) {
        shared += 1;
      }
      if (mine.length - shared < 2 || theirs.length - shared < 2) continue;
      if (!best || shared > best.shared) best = { twin: other, shared };
    }
    if (best) twins.push({ ayah: key, ...best });
  }
  return twins;
}

async function audioUrl(recitationId, key) {
  const response = await fetch(
    `${API}/verses/by_key/${key}?audio=${recitationId}`,
  );
  if (!response.ok) throw new Error(`${response.status} for ${key}`);
  const url = (await response.json())?.verse?.audio?.url;
  if (!url) throw new Error(`no audio for ${key}`);
  return url.startsWith("//")
    ? `https:${url}`
    : url.startsWith("http")
      ? url
      : `https://audio.qurancdn.com/${url}`;
}

/** The ayah's audio as a 16kHz wav, fetched once. */
async function fetchAyah(reciter, key) {
  const stem = `${reciter}-${key.replace(":", "_")}`;
  const reused = path.join(LARGE_WORK, `${stem}.wav`);
  if (existsSync(reused)) return { stem, file: reused };
  const file = path.join(WORK, `${stem}.wav`);
  if (!existsSync(file)) {
    const mp3 = path.join(WORK, `${stem}.mp3`);
    await download(
      await audioUrl(RECITER_QURAN_COM_IDS[RECITERS[reciter]], key),
      mp3,
    );
    await toWav(mp3, file);
  }
  return { stem, file };
}

/** Run `task` over `items`, a few at a time: one CDN, politely. */
async function eachLimited(items, limit, task) {
  let next = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < items.length) await task(items[next++]);
    }),
  );
}

async function main() {
  const wanted = Number(flag("pairs", "300"));
  const reciters = flag("reciters", Object.keys(RECITERS).join(",")).split(",");
  const workerCount = Number(
    flag(
      "workers",
      String(Math.max(1, Math.min(8, availableParallelism() / 2))),
    ),
  );
  const quran = JSON.parse(
    await readFile(`${MODEL_DIR}/ordered_quran_phonemes.json`, "utf8"),
  );
  const twins = findTwins(quran);
  const step = Math.max(1, twins.length / wanted);
  const pairs = [];
  for (
    let taken = 0;
    taken * step < twins.length && taken < wanted;
    taken += 1
  ) {
    pairs.push({
      ...twins[Math.floor(taken * step)],
      split: taken % 2 === 0 ? "tune" : "test",
    });
  }
  console.log(
    `${pairs.length} pairs from ${twins.length} ayat with a twin sharing ` +
      `${SHARED_AT_LEAST}+ words, x ${reciters.length} voices; fetching audio…`,
  );

  await mkdir(WORK, { recursive: true });
  await mkdir(CLIPS, { recursive: true });
  const needed = [];
  for (const reciter of reciters) {
    const keys = new Set(pairs.flatMap((pair) => [pair.ayah, pair.twin]));
    for (const key of keys) needed.push({ reciter, key });
  }
  const audio = new Map();
  const failedFetch = [];
  let fetched = 0;
  await eachLimited(needed, 6, async ({ reciter, key }) => {
    try {
      const got = await fetchAyah(reciter, key);
      audio.set(`${reciter} ${key}`, { ...got, key });
    } catch (error) {
      failedFetch.push(`${reciter} ${key}: ${error.message}`);
    }
    fetched += 1;
    if (fetched % 200 === 0) console.log(`  audio ${fetched}/${needed.length}`);
  });
  if (failedFetch.length > 0) {
    console.log(
      `  ${failedFetch.length} could not be fetched, e.g. ${failedFetch[0]}`,
    );
  }

  console.log(`Aligning ${audio.size} ayat across ${workerCount} workers…`);
  const aligned = await alignAll(
    fileURLToPath(import.meta.url),
    [...audio.values()].map(({ stem, file, key }) => ({
      id: stem,
      file,
      verseKey: key,
    })),
    workerCount,
  );

  const clips = [];
  const skipped = new Map();
  const skip = (reason) => skipped.set(reason, (skipped.get(reason) ?? 0) + 1);
  for (const pair of pairs) {
    for (const reciter of reciters) {
      const mine = audio.get(`${reciter} ${pair.ayah}`);
      const theirs = audio.get(`${reciter} ${pair.twin}`);
      const a = mine && aligned.get(mine.stem);
      const b = theirs && aligned.get(theirs.stem);
      if (!a || !b || a.failed || b.failed) {
        skip(a?.failed ?? b?.failed ?? "no audio");
        continue;
      }
      const aSamples = await readWavAsFloat32(mine.file);
      const bSamples = await readWavAsFloat32(theirs.file);
      const aCuts = boundaries(a.frames, aSamples.length);
      const bCuts = boundaries(b.frames, bSamples.length);
      const ofA = (index) => [aSamples, aCuts[index], aCuts[index + 1]];
      const ofB = (index) => [bSamples, bCuts[index], bCuts[index + 1]];
      const range = (from, to) =>
        Array.from(
          { length: Math.max(0, to - from) },
          (_, offset) => from + offset,
        );

      const shared = pair.shared;
      const aWords = a.units.length;
      const bWords = b.units.length;
      const target = `${pair.ayah}:${shared + 1}`;
      const stem = `${reciter}-${pair.ayah.replace(":", "_")}`;
      const pairStem = `${stem}-${pair.twin.replace(":", "_")}`;
      const base = {
        reciter,
        verseKey: pair.ayah,
        expectedText: await getExpectedText(
          ...pair.ayah.split(":").map(Number),
        ),
        split: pair.split,
        twin: pair.twin,
        shared,
      };
      const write = async (id, pieces) => {
        const file = `clips/${id}.wav`;
        await writeFile(path.join(OUT, file), wav(join(pieces)));
        return { id, audio: file };
      };

      clips.push({
        ...base,
        id: `t-correct-${pairStem}`,
        audio: path.relative(OUT, mine.file).replaceAll("\\", "/"),
        verdict: "correct",
        kind: "as-recited",
        note: `${reciter}, unmodified`,
      });
      const wrong = range(shared, Math.min(bWords, shared + WRONG_WORDS)).map(
        ofB,
      );
      clips.push({
        ...base,
        ...(await write(`t-corrected-${pairStem}`, [
          ...range(0, shared).map(ofA),
          ...wrong,
          ...range(shared, aWords).map(ofA),
        ])),
        verdict: "corrected",
        kind: "twin-corrected",
        target,
        position: "inner",
        note: `${shared} shared words, ${wrong.length} of ${pair.twin}, then back to ${pair.ayah}`,
      });
      clips.push({
        ...base,
        ...(await write(`t-continued-${pairStem}`, [
          ...range(0, shared).map(ofA),
          ...range(shared, bWords).map(ofB),
        ])),
        verdict: "mistake",
        kind: "twin-continued",
        target,
        position: "inner",
        note: `${shared} shared words, then ${pair.twin} to its end`,
      });
    }
  }

  await writeFile(
    path.join(OUT, "manifest.json"),
    `${JSON.stringify({ clips }, null, 1)}\n`,
    "utf8",
  );
  console.log(
    `\n${clips.length} clips from ${pairs.length} pairs.` +
      (skipped.size > 0
        ? ` Skipped: ${[...skipped].map(([reason, n]) => `${n} ${reason}`).join(", ")}.`
        : ""),
  );
}

if (process.argv.includes("--align-worker")) await alignWorker(MODEL_DIR);
else await main();
