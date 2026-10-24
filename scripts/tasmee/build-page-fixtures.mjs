/*
 * Passages, because the app practises a page and the bench judged one ayah.
 *
 * Every clip in `fixtures-large` is a single ayah, and two things the reader
 * does on every run are invisible at that size:
 *
 *   The cursor's resync searches the **whole passage** for a three-phoneme
 *   match. On one ayah that is a handful of places to go wrong; on a mushaf
 *   page it is ten times as many, so a false match - a jump to the wrong
 *   place, which is what "it seem I can skip" was - gets likelier the longer
 *   the passage, and a set of single ayat cannot see it at all.
 *
 *   The one-weak-word tolerance is applied **per ayah**. On a page that is a
 *   budget spent fifteen times over, and whether a real mistake in the ninth
 *   ayah still stands out has never been measured.
 *
 * So these are multi-ayah passages, with each mistake placed inside one ayah
 * of several. Some are exact mushaf pages - 1:2-7 is page 1, 2:284-286 is
 * page 49 - and the rest are consecutive runs, which exercise the same two
 * things.
 *
 * Passages are grown from a starting ayah until they reach a real page's
 * worth of words, rather than stopping at whatever consecutive audio happened
 * to be cached. That matters because the ambiguity being tested scales with
 * length: measured over the whole Quran, a three-unit phoneme run is unique
 * within a single ayah (0.0% repeat) but repeats somewhere in the same page
 * 11% of the time. A 27-word passage is a third of a page and sits most of
 * the way down that curve.
 *
 * Per-ayah audio is reused from what `build-word-fixtures.mjs` cached, and
 * anything missing is fetched.
 *
 *   node scripts/tasmee/build-page-fixtures.mjs [--words 80]
 */
import { flag } from "./lib/args.mjs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import {
  concat,
  cut,
  download,
  ensureDir,
  silence,
  toWav,
} from "./lib/audio.mjs";
import { existsSync } from "node:fs";
import { getExpectedText } from "./lib/quranText.mjs";

const API = "https://api.quran.com/api/v4";
const OUT = path.resolve("scripts/tasmee/fixtures-page");
const CLIPS = path.join(OUT, "clips");
const WORK = path.join(OUT, ".work");
/** Where build-word-fixtures.mjs left the per-ayah audio. */
const SOURCE = path.resolve("scripts/tasmee/fixtures-large/.work");

const RECITERS = { husary: 6, alafasy: 7, minshawi: 9 };

/** The pause a reciter leaves at an ayah end, so the joins are not abrupt. */
const AYAH_GAP_SECONDS = 0.3;

/** A mushaf page runs to roughly this many words. */
const DEFAULT_PAGE_WORDS = 80;

/*
 * Where each passage starts. It then grows forward until it holds a page's
 * worth of words, so the number of ayat is whatever that takes - six for
 * al-Fatihah, three for the end of al-Baqarah, sixteen for ar-Rahman.
 *
 * Spread across the mushaf on purpose, and deliberately including the long
 * flat prose of al-Baqarah and an-Nisa, where words repeat within a page and
 * the resync has the most chances to land somewhere wrong.
 */
const STARTS = [
  { surah: 1, from: 1, note: "al-Fatihah, mushaf page 1" },
  { surah: 2, from: 1, note: "opening of al-Baqarah" },
  { surah: 2, from: 255, note: "Ayat al-Kursi onwards" },
  { surah: 2, from: 284, note: "end of al-Baqarah, mushaf page 49" },
  { surah: 3, from: 26, note: "Aal Imran, long prose" },
  { surah: 4, from: 11, note: "an-Nisa, the inheritance verses" },
  { surah: 18, from: 1, note: "opening of al-Kahf" },
  { surah: 36, from: 1, note: "opening of Yaseen" },
  { surah: 55, from: 1, note: "ar-Rahman, short rhyming ayat" },
  { surah: 59, from: 21, note: "end of al-Hashr" },
  { surah: 67, from: 1, note: "opening of al-Mulk" },
  { surah: 112, from: 1, note: "the last page: Ikhlas, Falaq, Nas" },
];

/** Quran.com sends [index, position, startMs, endMs] or [position, startMs, endMs]. */
function parseSegment(row) {
  if (row.length >= 4)
    return { position: row[1], startMs: row[2], endMs: row[3] };
  if (row.length === 3)
    return { position: row[0], startMs: row[1], endMs: row[2] };
  return null;
}

async function verse(recitationId, surah, ayah) {
  const response = await fetch(
    `${API}/verses/by_key/${surah}:${ayah}?words=true&audio=${recitationId}` +
      `&word_fields=position,char_type_name`,
  );
  if (!response.ok) return null;
  const data = await response.json();
  const audio = data?.verse?.audio;
  // The API returns a protocol-relative mirror for some reciters and a bare
  // path for others, so neither form can simply have a base glued to it.
  const url = !audio?.url
    ? null
    : audio.url.startsWith("//")
      ? `https:${audio.url}`
      : audio.url.startsWith("http")
        ? audio.url
        : `https://audio.qurancdn.com/${audio.url}`;
  // Only real words carry recitation; the ayah marker is not spoken.
  const spoken = new Set(
    (data?.verse?.words ?? [])
      .filter((word) => word.char_type_name !== "end")
      .map((word) => word.position),
  );
  const segments = (audio?.segments ?? [])
    .map(parseSegment)
    .filter((segment) => segment && spoken.has(segment.position))
    .sort((a, b) => a.position - b.position);
  return { url, words: spoken.size, segments };
}

/** The per-ayah wav, from the cache or fetched. */
async function ayahAudio(reciter, recitationId, surah, ayah) {
  const stem = `${reciter}-${surah}_${ayah}`;
  const wav = path.join(SOURCE, `${stem}.wav`);
  const info = await verse(recitationId, surah, ayah);
  if (!info) return null;
  if (!existsSync(wav)) {
    if (!info.url) return null;
    try {
      await download(info.url, path.join(WORK, `${stem}.mp3`));
      await toWav(path.join(WORK, `${stem}.mp3`), wav);
    } catch {
      return null;
    }
  }
  return { wav, words: info.words, segments: info.segments };
}

/**
 * Grow a passage forward from its start until it holds `target` words.
 *
 * Stops at the end of the surah rather than running into the next one, which
 * is what a mushaf page does at a surah boundary - except the final page,
 * where three short surahs genuinely share one.
 */
async function grow(reciter, recitationId, start, target) {
  const ayat = [];
  let words = 0;
  let surah = start.surah;
  let ayah = start.from;

  while (words < target) {
    const got = await ayahAudio(reciter, recitationId, surah, ayah);
    if (!got) {
      // End of the surah: carry on into the next only for the last page.
      if (ayah > 1 && surah >= 112 && surah < 114) {
        surah += 1;
        ayah = 1;
        continue;
      }
      break;
    }
    ayat.push({ key: `${surah}:${ayah}`, ...got });
    words += got.words;
    ayah += 1;
  }
  return ayat;
}

const clips = [];
const seconds = (ms) => ms / 1000;

function record(id, destination, verseKeys, verdict, kind, note, expected) {
  clips.push({
    id,
    audio: path.relative(OUT, destination).replaceAll("\\", "/"),
    verseKeys,
    // Kept so anything reading a single key still has a sensible one.
    verseKey: verseKeys[0],
    expectedText: expected,
    verdict,
    kind,
    note,
  });
}

async function main() {
  await ensureDir(CLIPS);
  await ensureDir(WORK);

  const gap = path.join(WORK, "gap.wav");
  await silence(gap, AYAH_GAP_SECONDS);

  const target = Number(flag("words", String(DEFAULT_PAGE_WORDS)));
  console.log(
    `Building ${STARTS.length} passages x ${Object.keys(RECITERS).length} ` +
      `reciters, grown to ~${target} words each...`,
  );

  for (const [reciter, recitationId] of Object.entries(RECITERS)) {
    for (const start of STARTS) {
      const grown = await grow(reciter, recitationId, start, target);
      if (grown.length < 2) {
        console.log(
          `  ${reciter} ${start.surah}:${start.from}: too little audio`,
        );
        continue;
      }
      const passage = {
        ...start,
        words: grown.reduce((n, a) => n + a.words, 0),
      };
      const keys = grown.map((item) => item.key);
      const parts = grown.map((item) => item.wav);

      const texts = [];
      for (const key of keys) {
        const [s, a] = key.split(":").map(Number);
        texts.push(await getExpectedText(s, a));
      }
      const expected = texts.join(" ");
      const stem = `${reciter}-${start.surah}_${start.from}+${grown.length}`;
      /** The ayah a mistake goes in: a middle one, never an edge. */
      const middle = Math.floor(grown.length / 2);

      /** Interleave the ayah parts with the pause. */
      const withGaps = (files) =>
        files.flatMap((file, index) => (index === 0 ? [file] : [gap, file]));

      /* ---- the whole passage, as recited ---- */
      {
        const id = `p-correct-${stem}`;
        const destination = path.join(CLIPS, `${id}.wav`);
        await concat(withGaps(parts), destination);
        record(
          id,
          destination,
          keys,
          "correct",
          "as-recited",
          `${reciter}, ${passage.note}, ${grown.length} ayat`,
          expected,
        );
      }

      /* ---- an entire ayah missing: the page-scale mistake ---- */
      if (parts.length >= 3) {
        const id = `p-ayah-dropped-${stem}`;
        const destination = path.join(CLIPS, `${id}.wav`);
        await concat(
          withGaps(parts.filter((_, index) => index !== middle)),
          destination,
        );
        record(
          id,
          destination,
          keys,
          "mistake",
          "ayah-dropped",
          `${keys[middle]} left out entirely`,
          expected,
        );
      }

      /* ---- an ayah recited twice: a stumble, and it must pass ---- */
      if (parts.length >= 2) {
        const id = `p-ayah-repeated-${stem}`;
        const destination = path.join(CLIPS, `${id}.wav`);
        const doubled = parts.flatMap((file, index) =>
          index === middle ? [file, file] : [file],
        );
        await concat(withGaps(doubled), destination);
        record(
          id,
          destination,
          keys,
          "correct",
          "ayah-repeated",
          `${keys[middle]} recited twice`,
          expected,
        );
      }

      /* ---- dried up partway down the page ---- */
      if (parts.length >= 2) {
        const keep = Math.max(1, Math.ceil(parts.length * 0.5));
        const id = `p-stopped-${stem}`;
        const destination = path.join(CLIPS, `${id}.wav`);
        await concat(withGaps(parts.slice(0, keep)), destination);
        record(
          id,
          destination,
          keys,
          "mistake",
          "stopped-early",
          `stops after ${keys[keep - 1]}`,
          expected,
        );
      }

      /* ---- one word gone, from one ayah among several ---- */
      const segments = grown[middle].segments;
      if (segments && segments.length >= 2) {
        const source = parts[middle];
        const target = segments[Math.floor(segments.length / 2)];
        const last = segments[segments.length - 1];
        const head = path.join(WORK, `${stem}-drop-head.wav`);
        const tail = path.join(WORK, `${stem}-drop-tail.wav`);
        await cut(source, head, 0, seconds(target.startMs));
        await cut(
          source,
          tail,
          seconds(target.endMs),
          seconds(last.endMs - target.endMs),
        );
        const trimmed = path.join(WORK, `${stem}-drop.wav`);
        await concat([head, tail], trimmed);

        const id = `p-word-dropped-${stem}`;
        const destination = path.join(CLIPS, `${id}.wav`);
        await concat(
          withGaps(
            parts.map((file, index) => (index === middle ? trimmed : file)),
          ),
          destination,
        );
        record(
          id,
          destination,
          keys,
          "mistake",
          "word-dropped",
          `word ${target.position} of ${keys[middle]} removed`,
          expected,
        );
      }

      console.log(
        `  ${stem}: ${grown.length} ayat, ${passage.words} words ` +
          `(${passage.note})`,
      );
    }
  }

  await writeFile(
    path.join(OUT, "manifest.json"),
    `${JSON.stringify({ clips }, null, 2)}\n`,
    "utf8",
  );
  const mistakes = clips.filter((clip) => clip.verdict === "mistake").length;
  console.log(
    `\n${clips.length} clips: ${clips.length - mistakes} should pass, ` +
      `${mistakes} should not.`,
  );
}

await main();
