/*
 * Word-level mistakes in ordinary people's voices.
 *
 * Every word-labelled mistake the bench had was a professional reciter's
 * audio cut at Quran.com's published word timestamps (`fixtures-large`), and
 * always at the middle word. The learner set has the voices the app is for,
 * but only correct recitation in them, so it measures false accusations and
 * nothing else. Neither can say what matters most to a reader: when a word
 * is marked, is it the word they got wrong?
 *
 * This builds that set from the learner clips. Learner audio has no
 * published timings, so the word boundaries come from our own forced
 * alignment - `word-timings.mjs` measured it against Quran.com: word starts
 * land 270ms late (CTC sits in blank, then peaks inside the word) with a
 * 60ms median scatter once that is removed. So a word begins 270ms before
 * its first aligned frame, and never before the previous word's last one.
 *
 * Five clips per source, the target word drawn at random rather than the
 * middle (see the position leak `fixture-set-leaks-word-position` recorded):
 *
 *   as-recited      the clip itself, unchanged            correct
 *   word-repeated   the target said twice                 correct
 *   word-dropped    the target removed                    mistake at target
 *   word-swapped    the target replaced by another word   mistake at target
 *                   of the same clip, so the voice and the
 *                   microphone do not change mid-word
 *   word-corrected  that other word, then the target      corrected at target
 *
 * The last is the case only the cursor can see - the alignment uses the good
 * attempt, so the word scores well - and the reason stumbles are listed. It
 * is its own verdict because whether it should be marked is a choice about
 * the feature, not a fact about the recitation.
 *
 * One source clip per ayah, ayat evenly spaced over the mushaf, and each
 * clip tagged `split: tune | test` by ayah, so rules tuned on one half can
 * be checked on the other.
 *
 * The honest caveat: these are manufactured mistakes in real voices, not a
 * learner's real ones - a forgotten word, not a misremembered one. RetaSy's
 * labelled clips stay the check on real mistakes.
 *
 *   node scripts/tasmee/build-learner-mistakes.mjs [--sources 3000] [--workers 8]
 */
import { flag } from "./lib/args.mjs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { availableParallelism } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readWavAsFloat32, SAMPLE_RATE } from "./lib/audio.mjs";
import {
  alignAll,
  alignWorker,
  boundaries,
  join,
  random,
  wav,
} from "./lib/wordCuts.mjs";

const SOURCE = path.resolve("scripts/tasmee/fixtures-learner");
const OUT = path.resolve("scripts/tasmee/fixtures-learner-mistakes");
const CLIPS = path.join(OUT, "clips");
const MODEL_DIR = process.env.TASMEE_ZIPFORMER_DIR ?? ".models/zipformer";

/** Ayat alternate between halves in mushaf order, so both span the Quran. */
const splitOf = (index) => (index % 2 === 0 ? "tune" : "test");

async function main() {
  const wanted = Number(flag("sources", "3000"));
  const workerCount = Number(
    flag(
      "workers",
      String(Math.max(1, Math.min(8, availableParallelism() / 2))),
    ),
  );
  const quran = JSON.parse(
    await readFile(`${MODEL_DIR}/ordered_quran_phonemes.json`, "utf8"),
  );
  const { clips: learner } = JSON.parse(
    await readFile(path.join(SOURCE, "manifest.json"), "utf8"),
  );

  /* Ayat with three words or more, in mushaf order: a two-word ayah has no
     word to swap in that is not its neighbour. */
  const byAyah = new Map();
  for (const clip of learner) {
    if ((quran[clip.verseKey]?.aya_phonemes_list.length ?? 0) < 3) continue;
    (
      byAyah.get(clip.verseKey) ??
      byAyah.set(clip.verseKey, []).get(clip.verseKey)
    ).push(clip);
  }
  const order = (key) => key.split(":").map(Number);
  const ayat = [...byAyah.keys()].sort((a, b) => {
    const [sa, aa] = order(a);
    const [sb, ab] = order(b);
    return sa - sb || aa - ab;
  });
  const step = Math.max(1, ayat.length / wanted);
  const sources = [];
  for (
    let taken = 0;
    taken * step < ayat.length && taken < wanted;
    taken += 1
  ) {
    const key = ayat[Math.floor(taken * step)];
    const candidates = byAyah.get(key);
    const pick = candidates[Math.floor(random(key)() * candidates.length)];
    sources.push({ ...pick, split: splitOf(taken) });
  }
  console.log(
    `${sources.length} source clips from ${ayat.length} ayat of 3+ words; ` +
      `aligning across ${workerCount} workers…`,
  );

  const aligned = await alignAll(
    fileURLToPath(import.meta.url),
    sources.map((source) => ({
      id: source.id,
      file: path.join(SOURCE, source.audio),
      verseKey: source.verseKey,
    })),
    workerCount,
  );
  await mkdir(CLIPS, { recursive: true });

  const clips = [];
  const failed = new Map();
  for (const source of sources) {
    const result = aligned.get(source.id);
    if (!result || result.failed) {
      const reason = result?.failed ?? "no result";
      failed.set(reason, (failed.get(reason) ?? 0) + 1);
      continue;
    }
    const samples = await readWavAsFloat32(path.join(SOURCE, source.audio));
    const cuts = boundaries(result.frames, samples.length);
    const words = result.units.length;
    const word = (index) => [samples, cuts[index], cuts[index + 1]];
    const rng = random(source.id);
    const target = Math.floor(rng() * words);
    const location = `${source.verseKey}:${target + 1}`;
    const stem = source.id.replace(/^u-/, "");
    const base = {
      reciter: "user",
      verseKey: source.verseKey,
      expectedText: source.expectedText,
      split: source.split,
      source: source.id,
      /* Where each word of the source was cut, in seconds, for checking. */
      cuts: cuts.map((sample) => Number((sample / SAMPLE_RATE).toFixed(3))),
    };
    const write = async (kind, pieces) => {
      const id = `lm-${kind}-${stem}`;
      const audio = `clips/${id}.wav`;
      await writeFile(path.join(OUT, audio), wav(join(pieces)));
      return { id, audio };
    };
    const position =
      target === 0 ? "first" : target === words - 1 ? "last" : "inner";

    clips.push({
      ...base,
      id: `lm-correct-${stem}`,
      audio: path
        .relative(OUT, path.join(SOURCE, source.audio))
        .replaceAll("\\", "/"),
      verdict: "correct",
      kind: "as-recited",
      note: "learner clip, unmodified",
    });

    const all = Array.from({ length: words }, (_, index) => index);
    const before = all.filter((index) => index < target).map(word);
    const after = all.filter((index) => index > target).map(word);
    clips.push({
      ...base,
      ...(await write("repeated", [
        ...before,
        word(target),
        word(target),
        ...after,
      ])),
      verdict: "correct",
      kind: "word-repeated",
      target: location,
      position,
      note: `word ${target + 1} said twice`,
    });
    clips.push({
      ...base,
      ...(await write("dropped", [...before, ...after])),
      verdict: "mistake",
      kind: "word-dropped",
      target: location,
      position,
      note: `word ${target + 1} removed`,
    });

    /* Another word of the same clip that sounds different, preferring one
       that is not a neighbour - next to the target a swap reads as a
       repeat of the word beside it. */
    const different = all.filter(
      (index) => result.units[index] !== result.units[target],
    );
    const distant = different.filter((index) => Math.abs(index - target) > 1);
    const pool = distant.length > 0 ? distant : different;
    if (pool.length > 0) {
      const other = pool[Math.floor(rng() * pool.length)];
      clips.push({
        ...base,
        ...(await write("swapped", [...before, word(other), ...after])),
        verdict: "mistake",
        kind: "word-swapped",
        target: location,
        position,
        note: `word ${target + 1} replaced by word ${other + 1}`,
      });
      clips.push({
        ...base,
        ...(await write("corrected", [
          ...before,
          word(other),
          word(target),
          ...after,
        ])),
        verdict: "corrected",
        kind: "word-corrected",
        target: location,
        position,
        note: `word ${other + 1} said in place of word ${target + 1}, then word ${target + 1}`,
      });
    }
  }

  await writeFile(
    path.join(OUT, "manifest.json"),
    `${JSON.stringify({ clips }, null, 1)}\n`,
    "utf8",
  );
  const count = (kind) => clips.filter((clip) => clip.kind === kind).length;
  console.log(
    `\n${clips.length} clips: ${count("as-recited")} as recited, ` +
      `${count("word-repeated")} repeated, ${count("word-dropped")} dropped, ` +
      `${count("word-swapped")} swapped, ${count("word-corrected")} corrected.` +
      (failed.size > 0
        ? ` Skipped: ${[...failed].map(([reason, n]) => `${n} ${reason}`).join(", ")}.`
        : ""),
  );
}

if (process.argv.includes("--align-worker")) await alignWorker(MODEL_DIR);
else await main();
