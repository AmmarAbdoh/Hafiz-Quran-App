/*
 * Which words the summary marks, against which words were wrong.
 *
 * Every other reader here asks a clip-level question - was this recitation
 * called right or wrong - and counts a mistake as caught when *any* word is
 * marked. The reader is shown words, not a verdict: a dropped word that
 * leaves it clean and marks its neighbour red is a correct word accused and
 * a mistake missed, and the clip-level count calls it a catch. This counts
 * words.
 *
 * What is marked is what `judgeRecitedPage` lists: the words the score rule
 * calls weak, and the words the cursor saw a stumble on (less the ones
 * `wasTheCursors` puts down to the cursor). Both are replayed
 * from the caches `measure.mjs` writes, with the app's own functions, so
 * this needs no model pass and runs in seconds.
 *
 * A clip's wrong word is its manifest `target` (`build-learner-mistakes.mjs`)
 * or, for the professional set, read from its note ("word 3 removed"). A
 * `corrected` clip - wrong, then right - has one too, counted apart from the
 * mistakes: whether it should be listed is the feature's choice.
 *
 *   node scripts/tasmee/word-marks.mjs [--fixtures DIR] [--split tune|test]
 *
 * The rule's settings can be varied without editing the app, as JSON:
 * TASMEE_RULE='{"threshold":0.15,"tolerated":1,"skipBelow":0.02,"stumbles":true}'
 */
import { flag } from "./lib/args.mjs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  parseTokenTable,
  toPhonemeUnits,
} from "../../src/features/recitation-practice/model/phonemeTokens.ts";
import {
  advanceTracker,
  createPhonemeTracker,
} from "../../src/features/recitation-practice/model/phonemeProgress.ts";
import {
  findMisreadWords,
  SKIP_CONFIRMS_BELOW,
  stoppedShort,
  wasTheCursors,
  WEAK_WORDS_TOLERATED,
} from "../../src/features/recitation-practice/model/practiceVerdict.ts";
import { WORD_SAID_THRESHOLD } from "../../src/features/recitation-practice/model/ctcAlign.ts";

const FIXTURES = path.resolve(
  flag("fixtures", "scripts/tasmee/fixtures-learner-mistakes"),
);
const SPLIT = flag("split", "");
const MODEL_DIR = process.env.TASMEE_ZIPFORMER_DIR ?? ".models/zipformer";
const TRACKER_OPTIONS = JSON.parse(process.env.TASMEE_TRACKER ?? "{}");
const RULE = {
  threshold: WORD_SAID_THRESHOLD,
  tolerated: WEAK_WORDS_TOLERATED,
  skipBelow: SKIP_CONFIRMS_BELOW,
  stumbles: true,
  ...JSON.parse(process.env.TASMEE_RULE ?? "{}"),
};
/** How often the worker posts phonemes: 48 fbank frames at a 10ms shift. */
const CHUNK_SECONDS = 48 * 0.01;

/** The cursor, in the 480ms batches the worker posts. */
function follow(expected, units) {
  const tracker = createPhonemeTracker(expected, TRACKER_OPTIONS);
  const skipped = new Set();
  /* As the app keeps them: the first thing heard, and how many times. */
  const stumbled = new Map();
  for (let at = 0; at < units.length; ) {
    const until = units[at][2] + CHUNK_SECONDS;
    const chunk = [];
    while (at < units.length && units[at][2] < until) {
      const [symbol, confidence, seconds, alternatives] = units[at];
      chunk.push({
        id: 0,
        symbol,
        confidence,
        seconds,
        alternatives: alternatives?.map(([other, probability]) => ({
          symbol: other,
          probability,
        })),
      });
      at += 1;
    }
    const progress = advanceTracker(tracker, chunk);
    for (const location of progress.skipped) skipped.add(location);
    for (const word of progress.completed) {
      for (const location of word.locations) skipped.delete(location);
    }
    for (const stumble of progress.stumbles) {
      for (const location of stumble.locations) {
        const before = stumbled.get(location);
        if (before) before.times += 1;
        else stumbled.set(location, { heard: stumble.heard, times: 1 });
      }
    }
  }
  return { skipped, stumbled };
}

/** The wrong word's location, from the manifest or the professional note. */
function targetOf(clip) {
  if (clip.target) return clip.target;
  const word = /^word (\d+) (?:removed|replaced)/.exec(clip.note ?? "");
  return word ? `${clip.verseKey}:${word[1]}` : null;
}

function positionOf(clip, words) {
  if (clip.position) return clip.position;
  const index = Number(targetOf(clip)?.split(":")[2] ?? 0) - 1;
  return index === 0 ? "first" : index === words - 1 ? "last" : "inner";
}

async function main() {
  const manifest = JSON.parse(
    await readFile(path.join(FIXTURES, "manifest.json"), "utf8"),
  );
  let scores;
  let emissions;
  try {
    scores = JSON.parse(
      await readFile(path.join(FIXTURES, ".scores.json"), "utf8"),
    );
    emissions = JSON.parse(
      await readFile(path.join(FIXTURES, ".emissions.json"), "utf8"),
    );
  } catch {
    console.log("Needs both caches: run measure.mjs first.");
    return;
  }
  const quran = JSON.parse(
    await readFile(`${MODEL_DIR}/ordered_quran_phonemes.json`, "utf8"),
  );
  const { inventory } = parseTokenTable(
    await readFile(`${MODEL_DIR}/tokens.txt`, "utf8"),
  );
  const clipOf = new Map(manifest.clips.map((clip) => [clip.id, clip]));
  const heardOf = new Map(emissions.map((row) => [row.id, row]));

  /* Per kind: clips, any word marked, the wrong word marked, other words. */
  const kinds = new Map();
  const positions = new Map();
  const wrongMarks = { rule: 0, stumble: 0 };
  let clipsCounted = 0;

  for (const row of scores) {
    const clip = clipOf.get(row.id);
    const heard = heardOf.get(row.id);
    if (!clip || !heard) continue;
    if (SPLIT && clip.split !== SPLIT) continue;

    const expected = [];
    for (const key of heard.verseKeys ?? [clip.verseKey]) {
      for (const [index, word] of (
        quran[key]?.aya_phonemes_list ?? []
      ).entries()) {
        const units = toPhonemeUnits(word, inventory);
        if (units.length > 0) {
          expected.push({
            ayah: key,
            locations: [`${key}:${index + 1}`],
            units,
          });
        }
      }
    }
    const span = row.span ?? { from: 0, to: expected.length };
    const judged = expected.slice(span.from, span.to);
    if (expected.length === 0 || judged.length !== row.scores.length) continue;

    const { skipped, stumbled } = follow(expected, heard.units);
    /*
     * A different threshold, without a second copy of the rule: scaling the
     * scores by WORD_SAID_THRESHOLD / threshold puts the same words under the
     * app's constant, and the skip cut-off scales with them.
     */
    const scale = WORD_SAID_THRESHOLD / RULE.threshold;
    const words = judged.map((word, index) => ({
      ayah: word.ayah,
      score: row.scores[index] * scale,
      skipped: word.locations.some((location) => skipped.has(location)),
    }));
    const byRule = new Set(
      findMisreadWords(words, RULE.skipBelow * scale, RULE.tolerated).flatMap(
        (index) => judged[index].locations,
      ),
    );
    const byStumble = new Set(
      RULE.stumbles
        ? [...stumbled]
            .filter(
              ([location, stumble]) =>
                !byRule.has(location) &&
                !wasTheCursors({ spoken: expected, span }, location, stumble),
            )
            .map(([location]) => location)
        : [],
    );
    const marked = new Set([...byRule, ...byStumble]);
    const short = stoppedShort(expected.length, span);

    const target = clip.verdict === "correct" ? null : targetOf(clip);
    const group = kinds.get(clip.kind) ?? {
      verdict: clip.verdict,
      clips: 0,
      anyMark: 0,
      onTarget: 0,
      elsewhereOnly: 0,
      short: 0,
      /* Nothing marked, but the run is reported as not finished. */
      shortOnly: 0,
      targeted: 0,
    };
    group.clips += 1;
    clipsCounted += 1;
    if (marked.size > 0) group.anyMark += 1;
    if (short) group.short += 1;
    for (const location of byRule)
      if (location !== target) wrongMarks.rule += 1;
    for (const location of byStumble)
      if (location !== target) wrongMarks.stumble += 1;
    if (target) {
      group.targeted += 1;
      const hit = marked.has(target);
      if (hit) group.onTarget += 1;
      else if (marked.size > 0) group.elsewhereOnly += 1;
      else if (short) group.shortOnly += 1;
      const position = positionOf(clip, expected.length);
      const place = positions.get(position) ?? {
        clips: 0,
        onTarget: 0,
        elsewhereOnly: 0,
      };
      place.clips += 1;
      if (hit) place.onTarget += 1;
      else if (marked.size > 0) place.elsewhereOnly += 1;
      positions.set(position, place);
    }
    kinds.set(clip.kind, group);
  }

  const pct = (part, whole) =>
    whole === 0
      ? "   -  "
      : `${((part / whole) * 100).toFixed(1).padStart(5)}%`;
  const sum = (verdict, field) =>
    [...kinds.values()]
      .filter((group) => group.verdict === verdict)
      .reduce((total, group) => total + group[field], 0);

  console.log(
    `${path.basename(FIXTURES)}${SPLIT ? ` (${SPLIT})` : ""}: ${clipsCounted} clips. ` +
      `Rule: threshold ${RULE.threshold}, tolerated ${RULE.tolerated}, ` +
      `skip below ${RULE.skipBelow}, stumbles ${RULE.stumbles ? "listed" : "not listed"}.\n`,
  );
  const correct = sum("correct", "clips");
  const targeted = sum("mistake", "targeted");
  console.log(
    `Correct recitations with a word marked    ${pct(sum("correct", "anyMark"), correct)}  of ${correct}`,
  );
  console.log(
    `Mistakes marked on the wrong word itself  ${pct(sum("mistake", "onTarget"), targeted)}  of ${targeted}`,
  );
  console.log(
    `Mistakes marked only on other words       ${pct(sum("mistake", "elsewhereOnly"), targeted)}`,
  );
  console.log(
    `Mistakes only reported as not finished    ${pct(sum("mistake", "shortOnly"), targeted)}`,
  );
  const silent =
    targeted -
    sum("mistake", "onTarget") -
    sum("mistake", "elsewhereOnly") -
    sum("mistake", "shortOnly");
  console.log(
    `Mistakes with nothing said at all         ${pct(silent, targeted)}`,
  );
  const corrected = sum("corrected", "targeted");
  if (corrected > 0) {
    console.log(
      `Corrected words listed on the word        ${pct(sum("corrected", "onTarget"), corrected)}  of ${corrected}`,
    );
  }
  console.log(
    `Correct words marked, per 100 clips        ${((100 * (wrongMarks.rule + wrongMarks.stumble)) / clipsCounted).toFixed(1).padStart(5)}` +
      `   (score rule ${((100 * wrongMarks.rule) / clipsCounted).toFixed(1)}, stumbles ${((100 * wrongMarks.stumble) / clipsCounted).toFixed(1)})`,
  );

  console.log(
    "\nkind             clips   any mark   on the word   only elsewhere   stopped short",
  );
  for (const [kind, group] of [...kinds].sort()) {
    const mistake = group.targeted > 0;
    console.log(
      `  ${kind.padEnd(15)}${String(group.clips).padStart(5)}   ${pct(group.anyMark, group.clips)}` +
        `     ${mistake ? pct(group.onTarget, group.targeted) : "   -  "}` +
        `        ${mistake ? pct(group.elsewhereOnly, group.targeted) : "   -  "}` +
        `         ${pct(group.short, group.clips)}`,
    );
  }
  if (positions.size > 0) {
    console.log("\nwrong word at   clips   on the word   only elsewhere");
    for (const position of ["first", "inner", "last"]) {
      const place = positions.get(position);
      if (!place) continue;
      console.log(
        `  ${position.padEnd(12)}${String(place.clips).padStart(6)}     ${pct(place.onTarget, place.clips)}        ${pct(place.elsewhereOnly, place.clips)}`,
      );
    }
  }
}

await main();
