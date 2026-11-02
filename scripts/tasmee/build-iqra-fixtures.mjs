/*
 * Build a bench fixture set from IqraEval/Iqra_Extra_IS26 on Hugging Face
 * (gated; access requested by the user, test-only - its one split is named
 * "train", and nothing here trains on it).
 *
 * Why this set exists: it is mispronunciation, judged by a person. 137
 * sentences from the Quran, each with one mistake planted in it - ص for
 * س in وَسَطًا, خ for غ in يُغْشِيكُمُ, a vowel changed - recorded by
 * several people, and every recording annotated with the phonemes actually
 * said. Most said the planted mistake; 348 of 1,330 said the sentence right.
 * So it asks what the other sets cannot: whether a word with one sound wrong
 * in it is marked, and marked on itself.
 *
 * The planted mistake is marked in the sentence with `@` inside the word,
 * and that word is the target. A recording whose annotation matches the
 * reference is correct. So is one that differs only in the last vowel of
 * the clip: that is the reciter stopping where the clip ends, which is
 * right, and which the annotation records as a mistake.
 *
 * The sentences are often part of an ayah, so each clip names the words it
 * covers (`words`, spoken words from 1) and is judged on those alone.
 *
 * The audio is people's voices, so the whole set is gitignored.
 *
 * RAW is the dataset unpacked by `extract-iqra-extra.py`: `rows.json` and
 * one audio file per clip.
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
const OUT = path.join(ROOT, "scripts/tasmee/fixtures-iqra");
const MODEL_DIR =
  process.env.TASMEE_ZIPFORMER_DIR ?? path.join(ROOT, ".models/zipformer");

/** IqraEval's vowels; a mistake in nothing else is a vowel mistake. */
const VOWELS = new Set("a u i aa uu ii A U I AA UU II".split(" "));
/** What a stop at the clip's end leaves off: a short vowel or tanween. */
const STOPPED = new Set([
  "a",
  "u",
  "i",
  "A",
  "U",
  "I",
  "a n",
  "u n",
  "i n",
  "n",
]);

/** What changed between the reference and what was said, as phonemes. */
function difference(reference, said) {
  const ref = reference.trim().split(/\s+/);
  const mis = said.trim().split(/\s+/);
  let head = 0;
  while (head < ref.length && head < mis.length && ref[head] === mis[head])
    head += 1;
  let tail = 0;
  while (
    tail < ref.length - head &&
    tail < mis.length - head &&
    ref[ref.length - 1 - tail] === mis[mis.length - 1 - tail]
  )
    tail += 1;
  return {
    wanted: ref.slice(head, ref.length - tail),
    heard: mis.slice(head, mis.length - tail),
    atEnd: tail === 0,
  };
}

async function main() {
  if (!RAW) {
    console.log(
      "usage: node scripts/tasmee/build-iqra-fixtures.mjs --raw <dir with rows.json>",
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
  const rows = JSON.parse(await readFile(path.join(RAW, "rows.json"), "utf8"));

  const verses = await placingIndex(quran);

  const placed = new Map();
  const clips = [];
  const dropped = { unmatched: 0, noTarget: 0 };
  for (const row of rows) {
    if (!placed.has(row.sentence))
      placed.set(row.sentence, placeText(row.sentence, verses));
    const place = placed.get(row.sentence);
    if (!place) {
      dropped.unmatched += 1;
      continue;
    }
    const ayah = quran[place.key];
    const spoken = (word) => spokenPosition(ayah, word, inventory);
    const words = { from: spoken(place.first), to: spoken(place.last) };
    const target = place.target === null ? null : spoken(place.target);

    const { wanted, heard, atEnd } = difference(
      row.phoneme_ref,
      row.phoneme_mis,
    );
    const changed = wanted.length + heard.length > 0;
    const stopped =
      changed &&
      atEnd &&
      STOPPED.has(wanted.join(" ")) &&
      (heard.length === 0 || heard.join(" ") === "aa");
    const mistake = changed && !stopped;
    if (mistake && !target) {
      dropped.noTarget += 1;
      continue;
    }
    const kind = !changed
      ? "as-recited"
      : stopped
        ? "stopped-ending"
        : [...wanted, ...heard].every((phoneme) => VOWELS.has(phoneme))
          ? "vowel"
          : "letter";

    const id = `iq-${row.id}`;
    const audio = `clips/${id}.wav`;
    await toWav(path.join(RAW, row.audio), path.join(OUT, audio));
    clips.push({
      id,
      audio,
      reciter: row.id.split("_")[0],
      verseKey: place.key,
      words,
      expectedText: ayah.aya_text,
      verdict: mistake ? "mistake" : "correct",
      kind,
      ...(mistake ? { target: `${place.key}:${target}` } : {}),
      note: changed
        ? `said ${heard.join(" ") || "nothing"} for ${wanted.join(" ") || "nothing"}`
        : "said as the reference",
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
  const sentences = [...placed.values()].filter(Boolean);
  console.log(
    `${sentences.length} of ${placed.size} sentences placed, in ${new Set(sentences.map((s) => s.key)).size} ayat; ` +
      `edits ${sentences.filter((s) => s.edits > 0).length} non-zero`,
  );
  console.log(`\nmanifest: ${path.join(OUT, "manifest.json")}`);
}

await main();
