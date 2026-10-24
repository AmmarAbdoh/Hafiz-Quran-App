/*
 * A fixture set large enough to choose a threshold from.
 *
 * The curated set beside this one has 32 clips, twelve of them mistakes. One
 * failure is 8.3%, which is too coarse to tell two scoring rules apart -
 * docs/tasmee-improvements.md records four rules that all landed within noise
 * of each other on it.
 *
 * What makes a bigger set possible is that quran.com returns **per-word
 * timestamps** alongside the audio, so a mistake can be cut at the exact
 * boundary of a word rather than at a percentage of the duration. Every
 * mistake below is manufactured, not collected: a word removed, a word
 * replaced with one from another ayah, a recitation stopped mid-verse.
 *
 * The honest caveat, unchanged from the small set: these are professional
 * reciters making synthetic mistakes, which is not a learner making a real
 * one. This set is for choosing between rules and catching regressions. Only
 * your own voice says whether any of it works.
 *
 *   node scripts/tasmee/build-word-fixtures.mjs [--ayat 30] [--reciters husary,alafasy]
 */
import { flag } from "./lib/args.mjs";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  concat,
  cut,
  download,
  ensureDir,
  silence,
  toWav,
} from "./lib/audio.mjs";
import { getExpectedText } from "./lib/quranText.mjs";
import { RECITER_QURAN_COM_IDS } from "../../src/domain/quran/audio/quranComReciters.ts";
import { SURAH_AYAH_COUNTS } from "../../src/domain/quran/audio/reciters.ts";

const API = "https://api.quran.com/api/v4";
const OUT = path.resolve("scripts/tasmee/fixtures-large");
const CLIPS = path.join(OUT, "clips");
const WORK = path.join(OUT, ".work");

/*
 * Every voice whose word timestamps Quran.com publishes - the ids come from
 * the app's own map, so this cannot drift from what the reader supports.
 *
 * Twelve recitations of nine reciters, and the duplicates are the point:
 * murattal and mujawwad of the same voice differ most in **how long the madd
 * is held**, which is the one dimension the phoneme table encodes by
 * repetition and the thing the cursor used to demand exactly. Husary's
 * muallim (teaching) recitation is the slowest and most deliberate in the
 * set, which is the closest any professional gets to a learner's pace.
 */
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

/*
 * The core: every reciter recites all of these, so voices can be compared on
 * identical material. Chosen to spread the thing that matters most at ayah
 * scale - length - because a dropped word is most of a short verse and almost
 * nothing of a long one, and the rules being compared disagree exactly there.
 *
 * They are also the famous passages, which is a bias worth naming. Measured
 * against the whole Quran they are *harder* than average, not easier: median
 * 4 words against 9, and short ayat are where mistakes get missed most. The
 * pool below exists because "harder on two axes" is not the same as
 * representative.
 */
const CORE_AYAT = [
  [1, 2],
  [1, 3],
  [1, 4],
  [1, 5],
  [1, 6],
  [1, 7],
  [112, 1],
  [112, 2],
  [112, 3],
  [112, 4],
  [113, 1],
  [113, 2],
  [113, 3],
  [113, 4],
  [113, 5],
  [114, 1],
  [114, 2],
  [114, 3],
  [114, 4],
  [114, 5],
  [114, 6],
  [108, 1],
  [108, 2],
  [108, 3],
  [103, 1],
  [103, 2],
  [103, 3],
  [2, 255],
  [2, 285],
  [2, 286],
  [2, 284],
  [36, 1],
  [36, 2],
  [36, 3],
  [36, 4],
  [36, 5],
  [55, 1],
  [55, 2],
  [55, 3],
  [55, 4],
  [18, 1],
  [18, 2],
  [18, 10],
  [3, 26],
  [3, 27],
  [59, 22],
  [59, 23],
  [59, 24],
];

/**
 * Ayat from across the whole mushaf, one reciter each.
 *
 * The core gives 45 ayat on every voice. That is enough to compare voices and
 * nowhere near enough to represent the Quran: 0.72% of it, all from twelve
 * surahs, and none of the long flat prose of al-Baqarah or an-Nisa where
 * words repeat within a page and the cursor's resync has the most chances to
 * land in the wrong place.
 *
 * Crossing every voice with every ayah would multiply the download and the
 * model pass by the number of voices for no statistical gain - a false-accept
 * *rate* needs a representative sample of (voice, ayah) pairs, not the full
 * grid. So each pooled ayah goes to one voice, round-robin, which buys the
 * ayah diversity at a fraction of the cost.
 *
 * Evenly spaced over the whole ayah index rather than randomly sampled: it is
 * reproducible without a seed, it covers all 114 surahs, and it naturally
 * weights the long surahs, which is where most of the Quran actually is.
 */
function poolByReciter(reciterKeys, count) {
  const core = new Set(CORE_AYAT.map(([surah, ayah]) => `${surah}:${ayah}`));
  const every = [];
  SURAH_AYAH_COUNTS.forEach((ayat, index) => {
    for (let ayah = 1; ayah <= ayat; ayah += 1) {
      const surah = index + 1;
      if (!core.has(`${surah}:${ayah}`)) every.push([surah, ayah]);
    }
  });

  const pool = new Map(reciterKeys.map((key) => [key, []]));
  if (count <= 0 || reciterKeys.length === 0) return pool;
  const step = every.length / count;
  for (let taken = 0; taken < count; taken += 1) {
    const picked = every[Math.floor(taken * step)];
    if (picked) pool.get(reciterKeys[taken % reciterKeys.length]).push(picked);
  }
  return pool;
}

/** Quran.com sends [index, position, startMs, endMs] or [position, startMs, endMs]. */
function parseSegment(row) {
  if (row.length >= 4)
    return { position: row[1], startMs: row[2], endMs: row[3] };
  if (row.length === 3)
    return { position: row[0], startMs: row[1], endMs: row[2] };
  return null;
}

async function verseAudio(recitationId, surah, ayah) {
  const key = `${surah}:${ayah}`;
  const response = await fetch(
    `${API}/verses/by_key/${key}?words=true&audio=${recitationId}&word_fields=position,char_type_name`,
  );
  if (!response.ok) return null;
  const data = await response.json();
  const audio = data?.verse?.audio;
  if (!audio?.url) return null;

  // Only real words carry recitation; the ayah marker is not spoken.
  const spoken = new Set(
    (data.verse.words ?? [])
      .filter((word) => word.char_type_name !== "end")
      .map((word) => word.position),
  );
  const segments = (audio.segments ?? [])
    .map(parseSegment)
    .filter((segment) => segment && spoken.has(segment.position))
    .sort((a, b) => a.position - b.position);

  // The API returns a protocol-relative mirror for some reciters and a bare
  // path for others, so neither form can simply have a base glued to it.
  const url = audio.url.startsWith("//")
    ? `https:${audio.url}`
    : audio.url.startsWith("http")
      ? audio.url
      : `https://audio.qurancdn.com/${audio.url}`;

  if (segments.length < 2) return null;
  return { url, segments };
}

const clips = [];
const seconds = (ms) => ms / 1000;

function record(
  id,
  destination,
  reciter,
  surah,
  ayah,
  verdict,
  kind,
  note,
  expected,
) {
  clips.push({
    id,
    audio: path.relative(OUT, destination).replaceAll("\\", "/"),
    /* Named, not parsed out of `note`, so results can be read per voice. */
    reciter,
    verseKey: `${surah}:${ayah}`,
    expectedText: expected,
    verdict,
    kind,
    note,
  });
}

async function main() {
  const wanted = Number(flag("ayat", String(CORE_AYAT.length)));
  const poolSize = Number(flag("pool", "255"));
  const reciterKeys = flag("reciters", Object.keys(RECITERS).join(",")).split(
    ",",
  );
  await ensureDir(CLIPS);
  await ensureDir(WORK);

  const core = CORE_AYAT.slice(0, wanted);
  const pool = poolByReciter(reciterKeys, poolSize);
  const pooled = [...pool.values()].reduce((sum, list) => sum + list.length, 0);
  console.log(
    `Building ${core.length} core ayat x ${reciterKeys.length} reciters, ` +
      `plus ${pooled} ayat spread across the mushaf one voice each ` +
      `(${core.length + pooled} distinct ayat)…`,
  );

  for (const reciterKey of reciterKeys) {
    const recitationId = RECITER_QURAN_COM_IDS[RECITERS[reciterKey]];
    if (!recitationId) {
      console.log(`  unknown reciter ${reciterKey}, skipping`);
      continue;
    }

    /* The previous ayah, kept so a word can be borrowed from it. */
    let previous = null;

    for (const [surah, ayah] of [...core, ...pool.get(reciterKey)]) {
      let source;
      try {
        source = await verseAudio(recitationId, surah, ayah);
      } catch {
        source = null;
      }
      if (!source) {
        console.log(`  no segments for ${reciterKey} ${surah}:${ayah}`);
        continue;
      }

      const expected = await getExpectedText(surah, ayah);
      const stem = `${reciterKey}-${surah}_${ayah}`;
      const mp3 = path.join(WORK, `${stem}.mp3`);
      const wav = path.join(WORK, `${stem}.wav`);
      try {
        // Reuse what a previous run fetched; adding a voice re-cuts, it does
        // not re-download the ones already here.
        if (!existsSync(wav)) {
          await download(source.url, mp3);
          await toWav(mp3, wav);
        }
      } catch {
        console.log(`  could not fetch audio for ${stem}`);
        continue;
      }

      const words = source.segments;
      const last = words[words.length - 1];
      const middle = Math.floor(words.length / 2);

      /* ---- as recited ---- */
      {
        const id = `w-correct-${stem}`;
        const destination = path.join(CLIPS, `${id}.wav`);
        await cut(wav, destination, 0, seconds(last.endMs));
        record(
          id,
          destination,
          reciterKey,
          surah,
          ayah,
          "correct",
          "as-recited",
          `${reciterKey}, unmodified`,
          expected,
        );
      }

      /* ---- one word gone, cut at its own boundaries ---- */
      if (words.length >= 3) {
        const target = words[middle];
        const head = path.join(WORK, `${stem}-drop-head.wav`);
        const tail = path.join(WORK, `${stem}-drop-tail.wav`);
        await cut(wav, head, 0, seconds(target.startMs));
        await cut(
          wav,
          tail,
          seconds(target.endMs),
          seconds(last.endMs - target.endMs),
        );
        const id = `w-dropped-${stem}`;
        const destination = path.join(CLIPS, `${id}.wav`);
        await concat([head, tail], destination);
        record(
          id,
          destination,
          reciterKey,
          surah,
          ayah,
          "mistake",
          "word-dropped",
          `word ${target.position} removed`,
          expected,
        );
      }

      /* ---- stopped at a word boundary, not a percentage ---- */
      if (words.length >= 4) {
        const stopAt = words[Math.max(1, Math.floor(words.length * 0.6))];
        const id = `w-stopped-${stem}`;
        const destination = path.join(CLIPS, `${id}.wav`);
        await cut(wav, destination, 0, seconds(stopAt.startMs));
        record(
          id,
          destination,
          reciterKey,
          surah,
          ayah,
          "mistake",
          "stopped-early",
          `stops before word ${stopAt.position}`,
          expected,
        );
      }

      /* ---- a word said twice: a stumble, not a mistake ---- */
      if (words.length >= 3) {
        const target = words[middle];
        const head = path.join(WORK, `${stem}-rep-head.wav`);
        const again = path.join(WORK, `${stem}-rep-word.wav`);
        const tail = path.join(WORK, `${stem}-rep-tail.wav`);
        await cut(wav, head, 0, seconds(target.endMs));
        await cut(
          wav,
          again,
          seconds(target.startMs),
          seconds(target.endMs - target.startMs),
        );
        await cut(
          wav,
          tail,
          seconds(target.endMs),
          seconds(last.endMs - target.endMs),
        );
        const id = `w-repeated-${stem}`;
        const destination = path.join(CLIPS, `${id}.wav`);
        await concat([head, again, tail], destination);
        record(
          id,
          destination,
          reciterKey,
          surah,
          ayah,
          "correct",
          "word-repeated",
          `word ${target.position} said twice`,
          expected,
        );
      }

      /* ---- the wrong word in the right place ---- */
      if (words.length >= 3 && previous && previous.words.length >= 2) {
        const target = words[middle];
        const borrowed = previous.words[Math.floor(previous.words.length / 2)];
        const head = path.join(WORK, `${stem}-swap-head.wav`);
        const other = path.join(WORK, `${stem}-swap-word.wav`);
        const tail = path.join(WORK, `${stem}-swap-tail.wav`);
        await cut(wav, head, 0, seconds(target.startMs));
        await cut(
          previous.wav,
          other,
          seconds(borrowed.startMs),
          seconds(borrowed.endMs - borrowed.startMs),
        );
        await cut(
          wav,
          tail,
          seconds(target.endMs),
          seconds(last.endMs - target.endMs),
        );
        const id = `w-swapped-${stem}`;
        const destination = path.join(CLIPS, `${id}.wav`);
        await concat([head, other, tail], destination);
        record(
          id,
          destination,
          reciterKey,
          surah,
          ayah,
          "mistake",
          "word-swapped",
          `word ${target.position} replaced from ${previous.key}`,
          expected,
        );
      }

      /* ---- a long pause mid-verse: also not a mistake ---- */
      if (words.length >= 3) {
        const target = words[middle];
        const head = path.join(WORK, `${stem}-hes-head.wav`);
        const gap = path.join(WORK, `${stem}-hes-gap.wav`);
        const tail = path.join(WORK, `${stem}-hes-tail.wav`);
        await cut(wav, head, 0, seconds(target.startMs));
        await silence(gap, 1.2);
        await cut(
          wav,
          tail,
          seconds(target.startMs),
          seconds(last.endMs - target.startMs),
        );
        const id = `w-hesitation-${stem}`;
        const destination = path.join(CLIPS, `${id}.wav`);
        await concat([head, gap, tail], destination);
        record(
          id,
          destination,
          reciterKey,
          surah,
          ayah,
          "correct",
          "hesitation",
          "1.2s pause before a word",
          expected,
        );
      }

      previous = { wav, words, key: `${surah}:${ayah}` };
      console.log(`  ${stem}: ${words.length} words`);
    }
  }

  await mkdir(OUT, { recursive: true });
  await writeFile(
    path.join(OUT, "manifest.json"),
    `${JSON.stringify({ clips }, null, 2)}\n`,
    "utf8",
  );

  const mistakes = clips.filter((clip) => clip.verdict === "mistake").length;
  console.log(
    `\n${clips.length} clips: ${clips.length - mistakes} correct, ${mistakes} mistakes`,
  );
}

await main();
