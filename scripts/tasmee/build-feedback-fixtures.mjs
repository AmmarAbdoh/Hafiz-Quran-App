/*
 * Build a bench fixture set from recitations exported out of the app, with
 * the reciter's own word on each verdict.
 *
 * Why this set exists: it is the label nothing else here has. Every other
 * set's mistakes were either cut into someone's audio or judged by a third
 * party; these are judged by the person who recited, against the marks the
 * app actually showed them - "my mistake", "I said it right", and "it missed
 * one". Exported from Settings → Practice recordings, one file per run: the
 * run's metadata, the words it listed, the answers, and the audio, all in one
 * JSON so nothing arrives without the rest.
 *
 * These are people's voices and are given privately, so the whole set is
 * gitignored and never trained on.
 *
 * RAW is a folder of `artqiy-recitation-*.json` files. Fetches the words of
 * each ayah a listed word is in from quran.com, as the app does, since the
 * app numbers words by the mushaf's own split of the ayah.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { flag } from "./lib/args.mjs";
import { ensureDir } from "./lib/audio.mjs";
import { spokenPosition } from "./lib/quranText.mjs";
import { parseTokenTable } from "../../src/features/recitation-practice/model/phonemeTokens.ts";
import { mushafPositions } from "../../src/features/recitation-practice/model/wordPhonemes.ts";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const RAW = flag("raw", "");
const OUT = path.join(ROOT, "scripts/tasmee/fixtures-feedback");
const MODEL_DIR =
  process.env.TASMEE_ZIPFORMER_DIR ?? path.join(ROOT, ".models/zipformer");
const QURAN_COM_API = "https://api.quran.com/api/v4";

const mushafWordsOf = new Map();

/** An ayah's words as the mushaf splits it - the app's `fetchVerseWordTexts`. */
function mushafWords(verseKey) {
  if (!mushafWordsOf.has(verseKey)) {
    mushafWordsOf.set(
      verseKey,
      (async () => {
        const response = await fetch(
          `${QURAN_COM_API}/verses/by_key/${encodeURIComponent(verseKey)}?words=true&word_fields=text_uthmani,position,char_type_name`,
        );
        if (!response.ok)
          throw new Error(`Failed to load words for ${verseKey}`);
        const data = await response.json();
        return (data.verse?.words ?? [])
          .filter((word) => word.char_type_name !== "end")
          .sort((a, b) => a.position - b.position)
          .map((word) => word.text_uthmani);
      })().catch((error) => {
        /* Not kept: the next run in that ayah asks again. */
        mushafWordsOf.delete(verseKey);
        throw error;
      }),
    );
  }
  return mushafWordsOf.get(verseKey);
}

async function main() {
  if (!RAW) {
    console.log(
      "usage: node scripts/tasmee/build-feedback-fixtures.mjs --raw <dir of artqiy-recitation-*.json>",
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
  /* Mushaf order, so a run's ayat are everything from its first to its last. */
  const order = Object.keys(quran);

  /*
   * A word's location as the bench numbers it.
   *
   * The app's locations are the mushaf's - `2:181:3` is the third word on
   * the page - while the bench counts the ayah's words as they are said.
   * The two part where the model's text splits a mushaf word in two (2:181,
   * 8:6, 13:37, 37:130) and where two written words are said as one
   * (112:4's يَكُن لَّهُۥ). Undone the way the app did them: mushaf position
   * to the model's written word (`mushafPositions`), then to its spoken
   * word. Null when it cannot be placed on one spoken word.
   */
  const benchLocation = async (location) => {
    const [surah, ayah, position] = location.split(":");
    const verseKey = `${surah}:${ayah}`;
    const entry = quran[verseKey];
    if (!entry) return null;
    const written = mushafPositions(
      entry.aya_text.trim().split(/\s+/),
      await mushafWords(verseKey),
    ).indexOf(Number(position));
    const spoken = spokenPosition(entry, written, inventory);
    return spoken ? `${verseKey}:${spoken}` : null;
  };

  const clips = [];
  const skipped = [];
  const answers = { mistake: 0, saidRight: 0, unanswered: 0, missed: 0 };
  let unplaced = 0;
  await ensureDir(path.join(OUT, "clips"));

  for (const file of (await readdir(RAW)).filter((f) => f.endsWith(".json"))) {
    const exported = JSON.parse(await readFile(path.join(RAW, file), "utf8"));
    if (exported.format !== "artqiy-recitation" || exported.version !== 1) {
      skipped.push(`${file}: not an exported recitation`);
      continue;
    }
    const run = exported.recitation;
    const from = order.indexOf(run.from);
    const to = order.indexOf(run.to);
    if (from === -1 || to < from) {
      skipped.push(`${file}: ayat ${run.from}–${run.to} not found`);
      continue;
    }
    const verseKeys = order.slice(from, to + 1);

    const feedback = run.feedback ?? { words: {}, missedMistake: false };
    const answered = (value) =>
      run.words.filter((word) => feedback.words[word.location] === value);
    const mistakes = answered("mistake");
    const saidRight = answered("saidRight");
    const unanswered = run.words.length - mistakes.length - saidRight.length;

    /*
     * Only what the reciter said decides it, and saying nothing is not
     * "correct": `missedMistake` is false until they press it, so a run
     * nobody answered looks exactly like one answered "nothing wrong". A
     * mistake when they said there was one; correct only when they cleared
     * every word listed; otherwise unlabelled, and left out.
     *
     * So a run that listed nothing can only ever be a mistake here: the app
     * has no way to say "it was right" about a clean run.
     */
    const saidMistake = mistakes.length > 0 || feedback.missedMistake;
    if (!saidMistake && (run.words.length === 0 || unanswered > 0)) {
      skipped.push(
        `${file}: unlabelled (${unanswered} of ${run.words.length} listed words unanswered)`,
      );
      continue;
    }

    const place = async (words) => {
      const placed = [];
      for (const word of words) {
        const location = await benchLocation(word.location);
        if (location) placed.push(location);
        else unplaced += 1;
      }
      return placed;
    };
    /*
     * One unreachable ayah costs its run, not the set: skipped before its
     * audio is written, so a failed build never leaves a clip the manifest
     * does not list.
     */
    let mistakeAt;
    let saidRightAt;
    try {
      mistakeAt = await place(mistakes);
      saidRightAt = await place(saidRight);
    } catch (error) {
      skipped.push(
        `${file}: ${error instanceof Error ? error.message : error}`,
      );
      continue;
    }
    answers.mistake += mistakes.length;
    answers.saidRight += saidRight.length;
    answers.unanswered += unanswered;
    if (feedback.missedMistake) answers.missed += 1;

    const id = `f-${run.id.replace(/[:.]/g, "-")}`;
    const audio = `clips/${id}.wav`;
    /* The app records at the runners' own 16kHz mono, so this is the file. */
    await writeFile(
      path.join(OUT, audio),
      Buffer.from(exported.audio.base64, "base64"),
    );
    clips.push({
      id,
      audio,
      verseKeys,
      verseKey: verseKeys[0],
      expectedText: verseKeys.map((key) => quran[key].aya_text).join(" "),
      /*
       * Stopping short is the app's finding, not the reciter's answer, so it
       * does not decide the verdict: a run they stopped early and cleared
       * word by word is correct in what was recited, and only the stretch
       * recited is judged. Kept apart by kind, so a set can be read with or
       * without them. The expected text stays the whole of its ayat.
       */
      verdict: saidMistake ? "mistake" : "correct",
      kind: run.stoppedShort ? "reader-stopped-short" : "reader-labelled",
      /* The first the reciter owned, in reading order. */
      ...(mistakeAt[0] ? { target: mistakeAt[0] } : {}),
      labels: {
        mistake: mistakeAt,
        saidRight: saidRightAt,
        missedMistake: feedback.missedMistake,
      },
      note: `listed ${run.words.length}, ${run.seconds.toFixed(0)}s, ${run.stoppedShort ? "stopped short" : "finished"}`,
    });
  }

  await writeFile(
    path.join(OUT, "manifest.json"),
    `${JSON.stringify({ clips }, null, 1)}\n`,
    "utf8",
  );
  console.log(`${clips.length} runs`);
  console.log(
    `listed words: ${answers.mistake} the reciter's mistake, ${answers.saidRight} said right, ${answers.unanswered} unanswered`,
  );
  console.log(`runs where a mistake was missed: ${answers.missed}`);
  if (unplaced > 0)
    console.log(`answered words not placed on one spoken word: ${unplaced}`);
  for (const line of skipped) console.log(`skipped ${line}`);
  console.log(`\nmanifest: ${path.join(OUT, "manifest.json")}`);
}

await main();
