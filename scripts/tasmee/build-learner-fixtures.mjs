/*
 * Build a bench fixture set from the Tarteel.io user half of
 * ashraf-ali/quran-data (CC0).
 *
 * Why this set exists: every threshold in the verdict was measured on
 * professional reciters, and the one number that matters most - how often a
 * correct recitation is accused of a mistake - has never been measured on
 * anyone else. These are 18,419 clips of ordinary people, one ayah each,
 * which the dataset's own index calls "accepted user quality". So they stand
 * in for the reader the app is actually for, and they all carry the same
 * label: correct.
 *
 * What they cannot do is find missed mistakes. There are no wrong
 * recitations here by construction, so this set measures false accusations
 * and nothing else. `fixtures-large` keeps the other half of the trade.
 *
 * Every transcript is checked against this project's own `aya_text` before a
 * clip is accepted: a clip scored against the wrong ayah would read as the
 * reciter's mistake. Clips whose text does not match are dropped and counted.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const ROOT = "C:/Users/USER/My Apps/Quran/Hafiz-Quran-App";
const RAW =
  "C:/Users/USER/AppData/Local/Temp/claude/c--Users-USER-My-Apps-Quran-Hafiz-Quran-App/a9d55912-c621-443a-8ca6-e16d4c1537cf/ashraf-raw";
const OUT = path.join(ROOT, "scripts/tasmee/fixtures-learner");
const MODEL_DIR =
  process.env.TASMEE_ZIPFORMER_DIR ?? path.join(ROOT, ".models/zipformer");

/*
 * Compare two spellings of the same ayah for the letters they share.
 *
 * The dataset's transcripts and ours differ in presentation - a superscript
 * alef written ـٰ against ٰ, a tanween with a small meem against a plain one,
 * tatweel inserted for shaping - none of which changes which ayah it is. So
 * the comparison keeps the consonant skeleton and drops every mark, which is
 * enough to catch a clip filed under the wrong verse and blind to the
 * spelling differences that do not matter.
 *
 * Hamza is dropped too, the standalone letter along with the marks. It was
 * the whole of the first run's 695 rejections: \u0671\u0644\u0652\u0621\u064E\u0627\u064A\u064E\u0670\u062A\u0650 against \u0671\u0644\u0652\u0640\u064E\u0654\u0627\u064A\u064E\u0640\u0670\u062A\u0650
 * is one spelling with hamza as a letter and one with it as a mark over its
 * seat, the same word either way. Dropping it cannot hide a different ayah,
 * because the rest of the skeleton still has to agree.
 *
 * Listed as ranges and tested per code point rather than written as a
 * character class. A class of combining marks is exactly what
 * `no-misleading-character-class` exists to refuse, and it is right to: the
 * marks here combine with whatever precedes them, so the literal is harder
 * to read than the list.
 */
const MARK_RANGES = [
  [0x0610, 0x061a], // honorifics and annotation signs
  [0x0621, 0x0621], // hamza, written as a letter
  [0x0640, 0x0640], // tatweel, inserted only for shaping
  [0x064b, 0x065f], // tanween, harakat, shadda, sukun, hamza above and below
  [0x0670, 0x0670], // superscript alef
  [0x06d6, 0x06ed], // small high and low marks, and the Qur'anic stop signs
  [0x200b, 0x200f], // zero width and direction marks
];

/** Alef, yeh and heh spellings that differ only in how they are written. */
const SAME_LETTER = new Map([
  [0x0622, "\u0627"],
  [0x0623, "\u0627"],
  [0x0625, "\u0627"],
  [0x0671, "\u0627"],
  [0x0672, "\u0627"],
  [0x0673, "\u0627"],
  [0x0649, "\u064A"],
  [0x06c0, "\u0647"],
  [0x06d5, "\u0647"],
]);

function skeleton(text) {
  let out = "";
  for (const character of text) {
    const code = character.codePointAt(0);
    if (code === undefined) continue;
    if (MARK_RANGES.some(([low, high]) => code >= low && code <= high))
      continue;
    if (/\s/.test(character)) continue;
    out += SAME_LETTER.get(code) ?? character;
  }
  return out;
}

/** `100002` is surah 100, ayah 2: the index packs it as surah * 1000 + ayah. */
function verseKeyOf(quranId) {
  const id = Number(quranId);
  if (!Number.isInteger(id) || id <= 0) return null;
  const surah = Math.floor(id / 1000);
  const ayah = id % 1000;
  if (surah < 1 || surah > 114 || ayah < 1) return null;
  return `${surah}:${ayah}`;
}

/*
 * The index is a plain CSV whose transcript field holds Arabic with no
 * commas, so splitting on commas is safe - but check the field count rather
 * than assume it.
 */
function parseRows(csv) {
  const lines = csv.split(/\r?\n/).filter((line) => line.length > 0);
  const header = lines[0].split(",");
  const want = [
    "quran_id",
    "reciter",
    "file_name",
    "transcript",
    "wav_filesize",
    "dataset",
    "duration_in_seconds",
  ];
  if (header.join(",") !== want.join(",")) {
    throw new Error(`unexpected columns: ${header.join(",")}`);
  }
  const rows = [];
  let malformed = 0;
  for (const line of lines.slice(1)) {
    const parts = line.split(",");
    if (parts.length !== want.length) {
      malformed += 1;
      continue;
    }
    rows.push({
      quranId: parts[0],
      file: parts[2],
      transcript: parts[3],
      seconds: Number(parts[6]),
    });
  }
  return { rows, malformed };
}

async function main() {
  const quran = JSON.parse(
    await readFile(path.join(MODEL_DIR, "ordered_quran_phonemes.json"), "utf8"),
  );
  const { rows, malformed } = parseRows(
    await readFile(path.join(RAW, "users_ayahs.csv"), "utf8"),
  );

  const clips = [];
  const dropped = { verseKey: 0, noPhonemes: 0, textMismatch: 0, path: 0 };
  const mismatches = [];

  for (const row of rows) {
    const verseKey = verseKeyOf(row.quranId);
    if (verseKey === null) {
      dropped.verseKey += 1;
      continue;
    }
    const ayah = quran[verseKey];
    if (!ayah?.aya_phonemes_list?.length) {
      dropped.noPhonemes += 1;
      continue;
    }
    /* `data/audio/User/100/100_2_1341966332.wav` -> `clips/100/...`, so the
       manifest stays relative to the fixture directory like the others. */
    const prefix = "data/audio/User/";
    if (!row.file.startsWith(prefix)) {
      dropped.path += 1;
      continue;
    }
    const relative = `clips/${row.file.slice(prefix.length)}`;

    if (skeleton(row.transcript) !== skeleton(ayah.aya_text)) {
      dropped.textMismatch += 1;
      if (mismatches.length < 6)
        mismatches.push({
          verseKey,
          theirs: row.transcript,
          ours: ayah.aya_text,
        });
      continue;
    }

    clips.push({
      id: `u-${path.basename(row.file, ".wav")}`,
      audio: relative,
      reciter: "user",
      verseKey,
      expectedText: ayah.aya_text,
      verdict: "correct",
      kind: "as-recited",
      note: `tarteel.io user, accepted quality, ${row.seconds.toFixed(1)}s`,
    });
  }

  await mkdir(OUT, { recursive: true });
  await writeFile(
    path.join(OUT, "manifest.json"),
    `${JSON.stringify({ clips }, null, 1)}\n`,
    "utf8",
  );

  const seconds =
    clips.length === 0 ? 0 : rows.reduce((a, r) => a + (r.seconds || 0), 0);
  console.log(`${rows.length} rows in the index (${malformed} malformed)`);
  console.log(`${clips.length} clips accepted`);
  console.log("dropped:", JSON.stringify(dropped));
  console.log(`distinct ayat: ${new Set(clips.map((c) => c.verseKey)).size}`);
  console.log(`about ${(seconds / 3600).toFixed(1)} hours of audio indexed`);
  if (mismatches.length > 0) {
    console.log("\nfirst text mismatches (clip dropped, not scored):");
    for (const m of mismatches) {
      console.log(`  ${m.verseKey}`);
      console.log(`    theirs: ${m.theirs}`);
      console.log(`    ours:   ${m.ours}`);
    }
  }
  console.log(`\nmanifest: ${path.join(OUT, "manifest.json")}`);
}

await main();
