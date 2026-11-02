/*
 * Build a bench fixture set from Quran-Lab/quranic-asr-benchmark on Hugging
 * Face (gated, NPL-1.2: for evaluation only, the audio never redistributed
 * nor used for voice cloning).
 *
 * Why this set exists: 600 correct recitations the model was not trained on,
 * by Quran-Lab's own account - 200 studio clips from three EveryAyah reciters,
 * 200 from a QUL reciter, and 200 real phone recordings held out of Tarteel's
 * tlog. The learner set is tlog too, and the model may have heard those
 * recordings in training; these it has not. So the phone clips answer the
 * question that set cannot be trusted on: how often a correct recitation on
 * a phone, never heard before, gets a word marked red.
 *
 * Every clip is correct, and its source is its kind. Clips are named by
 * their text, which is placed on its ayah and the words it covers
 * (`words`), so one cut from inside an ayah is judged on what was said.
 *
 * The audio is people's voices, so the whole set is gitignored.
 *
 * RAW is the downloaded dataset: `benchmark.jsonl` and `audio/`.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { flag } from "./lib/args.mjs";
import { toWav } from "./lib/audio.mjs";
import { spokenPosition } from "./lib/quranText.mjs";
import { placeText, placingIndex } from "./lib/placeText.mjs";
import { parseTokenTable } from "../../src/features/recitation-practice/model/phonemeTokens.ts";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const RAW = flag("raw", "");
const OUT = path.join(ROOT, "scripts/tasmee/fixtures-qlbench");
const MODEL_DIR =
  process.env.TASMEE_ZIPFORMER_DIR ?? path.join(ROOT, ".models/zipformer");

async function main() {
  if (!RAW) {
    console.log(
      "usage: node scripts/tasmee/build-qlbench-fixtures.mjs --raw <dir with benchmark.jsonl>",
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
  const rows = (await readFile(path.join(RAW, "benchmark.jsonl"), "utf8"))
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
  const verses = await placingIndex(quran);

  const clips = [];
  const unplaced = [];
  for (const row of rows) {
    const place = placeText(row.reference_text, verses);
    if (!place) {
      unplaced.push(row.id);
      continue;
    }
    const ayah = quran[place.key];
    const spoken = (word) => spokenPosition(ayah, word, inventory);
    const id = `ql-${row.id.replace(/[^\w-]+/g, "-")}`;
    const audio = `clips/${id}.wav`;
    await toWav(path.join(RAW, row.audio), path.join(OUT, audio));
    clips.push({
      id,
      audio,
      reciter: row.source,
      verseKey: place.key,
      words: { from: spoken(place.first), to: spoken(place.last) },
      expectedText: ayah.aya_text,
      verdict: "correct",
      kind: row.source,
      note: "held out of the model's training, by Quran-Lab's account",
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
  if (unplaced.length > 0)
    console.log(`not placed on an ayah (${unplaced.length}):`, unplaced);
  console.log(`\nmanifest: ${path.join(OUT, "manifest.json")}`);
}

await main();
