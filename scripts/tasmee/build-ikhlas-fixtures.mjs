/*
 * Build a bench fixture set from the Surah Al-Ikhlas error detection dataset
 * (Umm Al-Qura University, Mendeley Data, CC BY 4.0).
 *
 * Why this set exists: 1,506 recordings of Al-Ikhlas, ayah by ayah, by 384
 * ordinary people, each checked by five Qur'an experts. Almost every mistake
 * they found is tajweed - 800 of the 851 a qalqala on the final دال - and
 * the app does not judge tajweed, it judges the words. So nearly the whole
 * set is a recitation whose words are right, said by people who are not
 * professional reciters: the one question it answers well is how often a
 * correct word is marked red for someone ordinary.
 *
 * The experts also marked vowel mistakes (حركات), mostly the damma of
 * كُفُوًا. Those can change a word, so those clips are kept apart as
 * mistakes, with the word the experts named as the target.
 *
 * Cite in anything published built on it:
 *   Maghraby, A., Alsaedi, M., Mahjoob, A., Al-Otaibi, A., Alsaedi, W., &
 *   Alsaedi, A. (2024). Surah Al-Ikhlas of the Holy Qur'an Error Detection
 *   Dataset. Mendeley Data, V1. https://doi.org/10.17632/sxtmmr6mvk.1
 *
 * The audio is people's voices and 1GB, so the whole set is gitignored.
 *
 * RAW is the unpacked `Dataset and Sounds` folder with `rows.json` beside its
 * spreadsheet - `Dataset.xlsx` exported as JSON by `extract-ikhlas.py`,
 * since Node reads no xlsx: one object per row with the file, the ayah, and
 * the experts' error types, words and notes as lists in matching order.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { flag } from "./lib/args.mjs";
import { toWav } from "./lib/audio.mjs";
import { onlyIndexOf, spokenPosition } from "./lib/quranText.mjs";
import { parseTokenTable } from "../../src/features/recitation-practice/model/phonemeTokens.ts";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const RAW = flag("raw", "");
const OUT = path.join(ROOT, "scripts/tasmee/fixtures-ikhlas");
const MODEL_DIR =
  process.env.TASMEE_ZIPFORMER_DIR ?? path.join(ROOT, ".models/zipformer");
const SURAH = 112;

/** A vowel mistake can change the word; the rest of the experts' list is tajweed. */
const isVowelMistake = (type) => type.includes("حركات");

async function main() {
  if (!RAW) {
    console.log(
      "usage: node scripts/tasmee/build-ikhlas-fixtures.mjs --raw <dir with rows.json and Sound recordings/>",
    );
    process.exitCode = 1;
    return;
  }
  const quran = JSON.parse(
    await readFile(path.join(MODEL_DIR, "ordered_quran_phonemes.json"), "utf8"),
  );
  const rows = JSON.parse(await readFile(path.join(RAW, "rows.json"), "utf8"));
  const { inventory } = parseTokenTable(
    await readFile(path.join(MODEL_DIR, "tokens.txt"), "utf8"),
  );

  /*
   * Six files are named by two rows each, and six others by none - ID42V2T
   * twice where ID43V2T is missing, and so on. Which row belongs to which
   * file is a guess, so every row naming a shared file is left out rather
   * than one of them labelling the wrong recording.
   */
  const named = new Map();
  for (const row of rows) named.set(row.file, (named.get(row.file) ?? 0) + 1);
  const shared = [...named].filter(([, times]) => times > 1).map(([f]) => f);

  const clips = [];
  const untargeted = [];
  for (const row of rows) {
    if (named.get(row.file) > 1) continue;
    const verseKey = `${SURAH}:${row.ayah}`;
    const words = quran[verseKey].aya_text.split(/\s+/).filter(Boolean);
    /*
     * Which word the experts named for a vowel mistake, by its skeleton,
     * numbered as the bench numbers words: as they are said. 112:4 says
     * يَكُن لَّهُۥ as one, so its fifth written word is its fourth spoken.
     */
    const vowel = row.errorTypes.findIndex(isVowelMistake);
    let target = null;
    if (vowel !== -1) {
      const spoken = spokenPosition(
        quran[verseKey],
        onlyIndexOf(words, row.errorWords[vowel] ?? ""),
        inventory,
      );
      if (spoken) target = `${verseKey}:${spoken}`;
      else untargeted.push(`${row.file}: ${row.errorWords[vowel]}`);
    }
    const kind = !row.hasError
      ? "as-recited"
      : vowel !== -1
        ? "vowel-mistake"
        : "tajweed-only";

    const id = `i-${path.basename(row.file, ".wav")}`;
    const audio = `clips/${id}.wav`;
    await toWav(
      path.join(RAW, "Sound recordings", row.file),
      path.join(OUT, audio),
    );
    clips.push({
      id,
      audio,
      reciter: /^ID(\d+)V/.exec(row.file)?.[1] ?? null,
      verseKey,
      expectedText: quran[verseKey].aya_text,
      /* Tajweed is not what the app checks: those words were said. */
      verdict: kind === "vowel-mistake" ? "mistake" : "correct",
      kind,
      ...(target ? { target } : {}),
      note: row.hasError
        ? `experts: ${row.errorNotes.join("; ")}`
        : "experts: correct",
    });
  }

  await writeFile(
    path.join(OUT, "manifest.json"),
    `${JSON.stringify({ clips }, null, 1)}\n`,
    "utf8",
  );
  const count = (kind) => clips.filter((c) => c.kind === kind).length;
  console.log(
    `${clips.length} clips: ${count("as-recited")} correct, ${count("tajweed-only")} tajweed only, ${count("vowel-mistake")} vowel mistakes`,
  );
  console.log(
    `distinct reciters: ${new Set(clips.map((c) => c.reciter)).size}`,
  );
  if (shared.length > 0) {
    console.log(
      `left out: ${shared.length} files named by more than one row (${shared.join(", ")})`,
    );
  }
  if (untargeted.length > 0) {
    console.log(
      `\nvowel mistakes on a word not found once in the ayah (${untargeted.length}):`,
    );
    for (const line of untargeted.slice(0, 10)) console.log(`  ${line}`);
  }
  console.log(`\nmanifest: ${path.join(OUT, "manifest.json")}`);
}

await main();
