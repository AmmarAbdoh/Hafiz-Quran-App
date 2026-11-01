/*
 * Build a bench fixture set from sobolev210/quran-recitation-errors on
 * Hugging Face (MIT).
 *
 * Why this set exists: it is the only one here where a person named the
 * wrong word. Recordings of short surahs cut ayah by ayah, each reviewed
 * and every mistake filed against the word it was in - "Wording", "Letters",
 * "Tashkeel" or "Tajweed". Small: 451 Hafs ayat from 57 recordings, of
 * which 46 have a mistake, but the marks it checks are marks a reviewer put
 * on real recitation rather than mistakes cut into someone's audio.
 *
 * Tajweed is not what the app checks, so a clip whose only mistakes are
 * tajweed counts as said correctly; the rest are mistakes with the first
 * wrong word in the ayah as the target - none when the word named appears
 * in it twice, since a word named by its text does not say which copy was
 * wrong. The set also has Qaloon, which the
 * app does not read, and those clips are left out.
 *
 * The test copy (sobolev210/quran-recitation-errors-test) has the same
 * metadata byte for byte, so it adds nothing.
 *
 * The audio is people's voices, so the whole set is gitignored.
 *
 * RAW is the downloaded dataset: `metadata.jsonl` and `temp_audio_chunks/`.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { flag } from "./lib/args.mjs";
import { toWav } from "./lib/audio.mjs";
import {
  getExpectedWords,
  onlyIndexOf,
  skeleton,
  spokenPosition,
} from "./lib/quranText.mjs";
import { parseTokenTable } from "../../src/features/recitation-practice/model/phonemeTokens.ts";

/*
 * Text compared without the long vowels and hamza seats, which the dataset
 * spells its own way - السماوات for السموات, أإنا for أئنا - and which
 * cannot make one ayah or word look like another while the rest agree. Used
 * both to check a clip's ayah and to find the word a reviewer named.
 */
const consonants = (text) => skeleton(text).replace(/[اويىئ]/g, "");

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const RAW = flag("raw", "");
const OUT = path.join(ROOT, "scripts/tasmee/fixtures-sobolev");
const MODEL_DIR =
  process.env.TASMEE_ZIPFORMER_DIR ?? path.join(ROOT, ".models/zipformer");

/** The reviewers' mistake types that are about the word, most telling first. */
const WORD_MISTAKES = ["Wording", "Letters", "Tashkeel"];

async function main() {
  if (!RAW) {
    console.log(
      "usage: node scripts/tasmee/build-sobolev-fixtures.mjs --raw <dir with metadata.jsonl>",
    );
    process.exitCode = 1;
    return;
  }
  const quran = JSON.parse(
    await readFile(path.join(MODEL_DIR, "ordered_quran_phonemes.json"), "utf8"),
  );
  const { inventory } = parseTokenTable(
    await readFile(path.join(MODEL_DIR, "tokens.txt"), "utf8"),
  );
  const rows = (await readFile(path.join(RAW, "metadata.jsonl"), "utf8"))
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));

  const clips = [];
  const dropped = { notHafs: 0, notThisAyah: 0 };
  const untargeted = [];

  for (const row of rows) {
    if (row.riwayah !== "Hafs") {
      dropped.notHafs += 1;
      continue;
    }
    const verseKey = `${row.surah}:${row.ayah}`;
    const ayah = quran[verseKey];
    /* An ayah that does not exist is a mislabelled row, not a crash. */
    if (!ayah) {
      dropped.notThisAyah += 1;
      continue;
    }
    const written = await getExpectedWords(Number(row.surah), Number(row.ayah));
    /* A clip filed under the wrong ayah would score as a mistake it is not. */
    if (consonants(row.text) !== consonants(written.join(" "))) {
      dropped.notThisAyah += 1;
      continue;
    }

    const errors = Object.entries(row.errors ?? {});
    const kindOf = (types) =>
      WORD_MISTAKES.find((type) => types.includes(type));
    const wordMistakes = errors.filter(([, types]) => kindOf(types));
    /*
     * The target is the first wrong word in the ayah, not the first the
     * file happens to list, numbered as the bench numbers words: as they
     * are said. Found among the imlaei words, so only where those split the
     * ayah as the model's text does - otherwise the index names another
     * word.
     */
    const sameSplit =
      written.length === ayah.aya_text.split(/\s+/).filter(Boolean).length;
    const [first] = wordMistakes
      .map(([word, types]) => ({
        types,
        spoken: sameSplit
          ? spokenPosition(
              ayah,
              onlyIndexOf(written, word, consonants),
              inventory,
            )
          : null,
      }))
      .filter((mistake) => mistake.spoken)
      .sort((a, b) => a.spoken - b.spoken);
    const target = first ? `${verseKey}:${first.spoken}` : null;
    if (wordMistakes.length > 0 && !first)
      untargeted.push(
        `${verseKey}: ${wordMistakes.map(([word]) => word).join(", ")}`,
      );
    const kind =
      wordMistakes.length > 0
        ? kindOf((first ?? { types: wordMistakes[0][1] }).types).toLowerCase()
        : errors.length > 0
          ? "tajweed-only"
          : "as-recited";

    const id = `s-${row.recording_id.slice(0, 8)}-${path.basename(row.file_name, ".wav")}`;
    const audio = `clips/${id}.wav`;
    await toWav(path.join(RAW, row.file_name), path.join(OUT, audio));
    clips.push({
      id,
      audio,
      reciter: row.recording_id,
      verseKey,
      expectedText: ayah.aya_text,
      verdict: wordMistakes.length > 0 ? "mistake" : "correct",
      kind,
      ...(target ? { target } : {}),
      note:
        errors.length > 0
          ? `reviewer: ${errors.map(([w, t]) => `${w} (${t.join(", ")})`).join("; ")}`
          : "reviewer: correct",
    });
  }

  await writeFile(
    path.join(OUT, "manifest.json"),
    `${JSON.stringify({ clips }, null, 1)}\n`,
    "utf8",
  );
  const kinds = new Map();
  for (const clip of clips)
    kinds.set(clip.kind, (kinds.get(clip.kind) ?? 0) + 1);
  console.log(
    `${rows.length} rows, ${clips.length} clips:`,
    Object.fromEntries(kinds),
  );
  console.log("dropped:", JSON.stringify(dropped));
  console.log(`distinct ayat: ${new Set(clips.map((c) => c.verseKey)).size}`);
  if (untargeted.length > 0) {
    console.log(
      `\nmistakes on no word found once in the ayah (${untargeted.length}):`,
    );
    for (const line of untargeted) console.log(`  ${line}`);
  }
  console.log(`\nmanifest: ${path.join(OUT, "manifest.json")}`);
}

await main();
