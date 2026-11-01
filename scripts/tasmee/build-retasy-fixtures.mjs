/*
 * Build a bench fixture set from RetaSy/quranic_audio_dataset (CC BY 4.0).
 *
 * Why this set exists: every mistake the bench has caught so far was one we
 * built - a cut, a splice, a neighbouring ayah - and the builders always
 * break the middle word, so a rule can learn where the mistake is rather
 * than what it sounds like. These are mistakes nobody built: non-Arabic
 * speakers reciting short surahs, each clip labelled `correct` or
 * `in_correct` by crowd annotators. It is the only set here where both
 * verdicts come from people.
 *
 * What it cannot do is say which word was wrong. The label is per clip, so
 * this measures whether the app's verdict agrees with the annotators', never
 * whether the red mark landed in the right place. The annotators themselves
 * are not ground truth either: the paper measures crowd accuracy at 0.77.
 *
 * Cite in anything published built on it:
 *   Salameh, R., Al Mdfaa, M., Askarbekuly, N., & Mazzara, M. (2024).
 *   Quranic Audio Dataset: Crowdsourced and Labeled Recitation from
 *   Non-Arabic Speakers. Procedia Computer Science, 246, 2684-2693.
 *   https://doi.org/10.1016/j.procs.2024.09.404
 *
 * The audio is not ours to redistribute, so the whole set is gitignored.
 *
 * RAW is what `extract_retasy.py` unpacked from the dataset's parquet: the
 * labelled clips' WAVs and a `rows.json` of their metadata. The dataset names
 * each clip's ayah by its text, not its number, so every clip is matched to
 * an ayah of its surah by consonant skeleton. A clip that matches none - the
 * isti'adha filed under Al-Faatihah, Ayat al-Kursi cut into phrases, the
 * adhan and the adhkar - is not one ayah and is dropped and counted.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { flag } from "./lib/args.mjs";
import { toWav } from "./lib/audio.mjs";
import { getExpectedText, skeleton } from "./lib/quranText.mjs";

/* The repository, wherever it is checked out. */
const ROOT = fileURLToPath(new URL("../..", import.meta.url));
/** Where the downloaded dataset was unpacked; machine-specific, so passed in. */
const RAW = flag("raw", "");
const OUT = path.join(ROOT, "scripts/tasmee/fixtures-retasy");
const MODEL_DIR =
  process.env.TASMEE_ZIPFORMER_DIR ?? path.join(ROOT, ".models/zipformer");

/** The dataset's surah names, for the ones that are Quran at all. */
const SURAH = new Map([
  ["Al-Faatihah", 1],
  ["Ayat al-Kursi", 2],
  ["Al-Asr", 103],
  ["Al-Humazah", 104],
  ["Al-Kauthar", 108],
  ["Al-Kafiroon", 109],
  ["An-Nasr", 110],
  ["Al-Masad", 111],
  ["Al-Ikhlas", 112],
  ["Al-Falaq", 113],
  ["An-Nas", 114],
]);

const VERDICT = { correct: "correct", in_correct: "mistake" };

async function main() {
  if (!RAW) {
    console.log(
      "usage: node scripts/tasmee/build-retasy-fixtures.mjs --raw <dir with rows.json>",
    );
    process.exitCode = 1;
    return;
  }
  const quran = JSON.parse(
    await readFile(path.join(MODEL_DIR, "ordered_quran_phonemes.json"), "utf8"),
  );
  const rows = JSON.parse(await readFile(path.join(RAW, "rows.json"), "utf8"));

  /*
   * Every ayah of a surah by skeleton, so a clip's text finds its number.
   *
   * Under both spellings: the dataset writes Al-Faatihah in imlaei and the
   * short surahs in Uthmani, and the two skeletons differ wherever Uthmani
   * leaves an alef to a mark - العالمين against ٱلْعَٰلَمِينَ.
   */
  const bySkeleton = new Map();
  for (const [verseKey, ayah] of Object.entries(quran)) {
    const [surah, number] = verseKey.split(":").map(Number);
    if (![...SURAH.values()].includes(surah)) continue;
    bySkeleton.set(`${surah}|${skeleton(ayah.aya_text)}`, verseKey);
    const imlaei = await getExpectedText(surah, number);
    bySkeleton.set(`${surah}|${skeleton(imlaei)}`, verseKey);
  }

  const clips = [];
  const dropped = { notQuran: 0, notOneAyah: 0 };
  const unmatched = new Map();

  for (const row of rows) {
    const surah = SURAH.get(row.Surah);
    if (surah === undefined) {
      dropped.notQuran += 1;
      continue;
    }
    const verseKey = bySkeleton.get(`${surah}|${skeleton(row.Aya)}`);
    if (verseKey === undefined) {
      dropped.notOneAyah += 1;
      const key = `${row.Surah}: ${row.Aya.trim()}`;
      unmatched.set(key, (unmatched.get(key) ?? 0) + 1);
      continue;
    }

    const id = `r-${path.basename(row.file, ".wav")}`;
    const audio = `clips/${id}.wav`;
    /* Their WAVs vary in rate and channels; the runners take one format. */
    await toWav(path.join(RAW, row.file), path.join(OUT, audio));
    clips.push({
      id,
      audio,
      reciter: row.reciter_id,
      verseKey,
      expectedText: quran[verseKey].aya_text,
      verdict: VERDICT[row.final_label],
      kind: row.final_label === "correct" ? "as-recited" : "learner-mistake",
      age: row.reciter_age,
      gender: row.reciter_gender,
      country: row.reciter_country,
      golden: row.golden,
      judgments: row.judgments_num,
      source: row.source_path,
      note: `RetaSy ${row.final_label}, ${(row.duration_ms / 1000).toFixed(1)}s`,
    });
  }

  await writeFile(
    path.join(OUT, "manifest.json"),
    `${JSON.stringify({ clips }, null, 1)}\n`,
    "utf8",
  );

  const count = (verdict) => clips.filter((c) => c.verdict === verdict).length;
  console.log(`${rows.length} labelled rows`);
  console.log(
    `${clips.length} clips accepted: ${count("correct")} correct, ${count("mistake")} mistake`,
  );
  console.log("dropped:", JSON.stringify(dropped));
  console.log(`distinct ayat: ${new Set(clips.map((c) => c.verseKey)).size}`);
  console.log(
    `distinct reciters: ${new Set(clips.map((c) => c.reciter)).size}`,
  );
  if (unmatched.size > 0) {
    console.log("\nnot one ayah (dropped, not scored):");
    for (const [text, n] of unmatched) console.log(`  ${n}x ${text}`);
  }
  console.log(`\nmanifest: ${path.join(OUT, "manifest.json")}`);
}

await main();
