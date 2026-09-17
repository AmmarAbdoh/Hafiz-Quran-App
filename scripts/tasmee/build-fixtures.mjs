/*
 * Builds a labelled fixture set for تسميع, from real recitation.
 *
 * everyayah serves one file per ayah, which hands us exact verse boundaries
 * for nothing - so a mistake can be constructed without needing word-level
 * alignment we do not have yet.
 *
 * These are synthetic mistakes by a professional reciter, which is not the
 * same as a learner making a real one. They are here so the harness can run
 * today and so a model can be rejected cheaply. A model that passes these
 * still has to be tried on your own voice before it means anything: see
 * "Adding your own voice" in README.md.
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import {
  concat,
  cut,
  download,
  ffprobeDuration,
  silence,
  toWav,
} from "./lib/audio.mjs";
import { getExpectedText } from "./lib/quranText.mjs";

const OUT = path.resolve("scripts/tasmee/fixtures");
const CLIPS = path.join(OUT, "clips");
const WORK = path.join(OUT, ".work");

/** Folder names as everyayah publishes them. */
const RECITERS = {
  husary: "Husary_128kbps",
  alafasy: "Alafasy_128kbps",
  minshawi: "Minshawy_Murattal_128kbps",
};

/*
 * Verses chosen for what they exercise, not at random:
 * - 2:255 is long, and the one everybody knows by heart
 * - 112:1-4 is short, so a dropped word is a large part of the whole
 * - 2:284/285/286 are the classic mutashabihat trap: long, similar, adjacent
 * - 1:2-4 is short and familiar
 */
const VERSES = [
  [2, 255],
  [112, 1],
  [112, 2],
  [112, 3],
  [112, 4],
  [1, 2],
  [1, 3],
  [1, 4],
  [2, 285],
  [2, 286],
  [2, 284],
];

function url(reciterFolder, surah, ayah) {
  const s = String(surah).padStart(3, "0");
  const a = String(ayah).padStart(3, "0");
  return `https://everyayah.com/data/${reciterFolder}/${s}${a}.mp3`;
}

async function source(reciterKey, surah, ayah) {
  const folder = RECITERS[reciterKey];
  const mp3 = path.join(WORK, `${reciterKey}-${surah}-${ayah}.mp3`);
  const wav = path.join(WORK, `${reciterKey}-${surah}-${ayah}.wav`);
  await download(url(folder, surah, ayah), mp3);
  await toWav(mp3, wav);
  return wav;
}

const clips = [];

function record(clip) {
  clips.push(clip);
  return clip;
}

async function main() {
  console.log("Fetching recitation…");

  /* ---- correct, three voices, so "correct" is not one reciter's accent ---- */
  for (const [reciterKey, verses] of [
    ["husary", VERSES],
    [
      "alafasy",
      [
        [2, 255],
        [112, 1],
        [1, 2],
        [2, 285],
      ],
    ],
    [
      "minshawi",
      [
        [2, 255],
        [112, 3],
        [1, 4],
      ],
    ],
  ]) {
    for (const [surah, ayah] of verses) {
      const wav = await source(reciterKey, surah, ayah);
      const id = `correct-${reciterKey}-${surah}_${ayah}`;
      const destination = path.join(CLIPS, `${id}.wav`);
      await cut(wav, destination, 0);
      record({
        id,
        audio: path.relative(OUT, destination).replaceAll("\\", "/"),
        verseKey: `${surah}:${ayah}`,
        expectedText: await getExpectedText(surah, ayah),
        verdict: "correct",
        kind: "as-recited",
        note: `${reciterKey}, unmodified`,
      });
    }
  }

  /* ---- stopped partway: the reciter dries up mid-verse ---- */
  for (const [surah, ayah, keep] of [
    [2, 255, 0.55],
    [2, 286, 0.4],
    [1, 2, 0.5],
  ]) {
    const wav = await source("husary", surah, ayah);
    const duration = await ffprobeDuration(wav);
    const id = `stopped-${surah}_${ayah}`;
    const destination = path.join(CLIPS, `${id}.wav`);
    await cut(wav, destination, 0, duration * keep);
    record({
      id,
      audio: path.relative(OUT, destination).replaceAll("\\", "/"),
      verseKey: `${surah}:${ayah}`,
      expectedText: await getExpectedText(surah, ayah),
      verdict: "mistake",
      kind: "stopped-early",
      note: `first ${Math.round(keep * 100)}% only`,
    });
  }

  /* ---- a chunk missing from the middle: skipped words ---- */
  for (const [surah, ayah] of [
    [2, 255],
    [2, 285],
    [2, 286],
  ]) {
    const wav = await source("husary", surah, ayah);
    const duration = await ffprobeDuration(wav);
    const head = path.join(WORK, `skip-head-${surah}-${ayah}.wav`);
    const tail = path.join(WORK, `skip-tail-${surah}-${ayah}.wav`);
    await cut(wav, head, 0, duration * 0.35);
    await cut(wav, tail, duration * 0.6);
    const id = `skipped-${surah}_${ayah}`;
    const destination = path.join(CLIPS, `${id}.wav`);
    await concat([head, tail], destination);
    record({
      id,
      audio: path.relative(OUT, destination).replaceAll("\\", "/"),
      verseKey: `${surah}:${ayah}`,
      expectedText: await getExpectedText(surah, ayah),
      verdict: "mistake",
      kind: "skipped-middle",
      note: "25% cut out of the middle",
    });
  }

  /*
   * Wrong ending. The classic memorization failure: two long, adjacent,
   * similar verses, and the reciter slides from one into the other. If a
   * model only catches one kind of mistake, this is the one that matters.
   */
  for (const [surah, ayah, otherAyah] of [
    [2, 285, 286],
    [2, 286, 285],
    [112, 1, 2],
  ]) {
    const own = await source("husary", surah, ayah);
    const other = await source("husary", surah, otherAyah);
    const ownDuration = await ffprobeDuration(own);
    const otherDuration = await ffprobeDuration(other);
    const head = path.join(WORK, `end-head-${surah}-${ayah}.wav`);
    const tail = path.join(WORK, `end-tail-${surah}-${otherAyah}.wav`);
    await cut(own, head, 0, ownDuration * 0.65);
    await cut(other, tail, otherDuration * 0.6);
    const id = `wrong-ending-${surah}_${ayah}`;
    const destination = path.join(CLIPS, `${id}.wav`);
    await concat([head, tail], destination);
    record({
      id,
      audio: path.relative(OUT, destination).replaceAll("\\", "/"),
      verseKey: `${surah}:${ayah}`,
      expectedText: await getExpectedText(surah, ayah),
      verdict: "mistake",
      kind: "wrong-ending",
      note: `ends with ${surah}:${otherAyah} instead`,
    });
  }

  /* ---- an entirely different verse than the one on the page ---- */
  for (const [surah, ayah, spokenAyah] of [
    [112, 2, 3],
    [1, 3, 4],
    [2, 285, 286],
  ]) {
    const spoken = await source("husary", surah, spokenAyah);
    const id = `wrong-verse-${surah}_${ayah}`;
    const destination = path.join(CLIPS, `${id}.wav`);
    await cut(spoken, destination, 0);
    record({
      id,
      audio: path.relative(OUT, destination).replaceAll("\\", "/"),
      verseKey: `${surah}:${ayah}`,
      expectedText: await getExpectedText(surah, ayah),
      verdict: "mistake",
      kind: "wrong-verse",
      note: `recited ${surah}:${spokenAyah}`,
    });
  }

  /*
   * A long hesitation in the middle, and nothing else wrong. This is the one
   * that separates a good system from a crude one: the words are all correct
   * and in order, so it must NOT be called a mistake - but the app should
   * still be able to see the pause. Labelled correct on purpose.
   */
  for (const [surah, ayah] of [
    [2, 255],
    [1, 2],
  ]) {
    const wav = await source("husary", surah, ayah);
    const duration = await ffprobeDuration(wav);
    const head = path.join(WORK, `hes-head-${surah}-${ayah}.wav`);
    const gap = path.join(WORK, `hes-gap-${surah}-${ayah}.wav`);
    const tail = path.join(WORK, `hes-tail-${surah}-${ayah}.wav`);
    await cut(wav, head, 0, duration * 0.5);
    await silence(gap, 2.5);
    await cut(wav, tail, duration * 0.5);
    const id = `hesitation-${surah}_${ayah}`;
    const destination = path.join(CLIPS, `${id}.wav`);
    await concat([head, gap, tail], destination);
    record({
      id,
      audio: path.relative(OUT, destination).replaceAll("\\", "/"),
      verseKey: `${surah}:${ayah}`,
      expectedText: await getExpectedText(surah, ayah),
      verdict: "correct",
      kind: "hesitation",
      note: "2.5s pause mid-verse, words all correct",
    });
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    source: "everyayah.com, spliced",
    warning:
      "Synthetic mistakes by professional reciters. A model that passes here still has to be tried on a learner's own voice.",
    clips,
  };
  await writeFile(
    path.join(OUT, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );

  const byVerdict = clips.reduce((counts, clip) => {
    counts[clip.verdict] = (counts[clip.verdict] ?? 0) + 1;
    return counts;
  }, {});
  console.log(
    `\n${clips.length} clips written to scripts/tasmee/fixtures/`,
    `\n  correct: ${byVerdict.correct ?? 0}   mistake: ${byVerdict.mistake ?? 0}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
