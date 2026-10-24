/*
 * How a word's score should be reached, measured rather than chosen.
 *
 * `rules.mjs` searched the shapes a verdict can take and found nothing much
 * better than counting weak words: four families, and the simple count still
 * won at 86.6%. That says the limit is not the rule but the number it reads -
 * the single score each word is reduced to.
 *
 * That score is currently the second-weakest phoneme in the word, which was
 * a judgement, not a measurement: the weakest alone rejected 61% of correct
 * recitations because CTC gives a word only a handful of frames and one of
 * them landing badly means nothing. This sweeps the choice properly, over
 * the per-phoneme supports the cache now keeps.
 *
 *   node scripts/tasmee/aggregate.mjs
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

const FIXTURES = path.resolve("scripts/tasmee/fixtures-large");

const mean = (values) =>
  values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length;

/** Each takes a word's phoneme supports, weakest first, and returns a score. */
const AGGREGATIONS = {
  weakest: (supports) => supports[0] ?? 0,
  "2nd weakest": (supports) => supports[Math.min(1, supports.length - 1)] ?? 0,
  "3rd weakest": (supports) => supports[Math.min(2, supports.length - 1)] ?? 0,
  mean: (supports) => mean(supports),
  "mean without the weakest": (supports) =>
    supports.length <= 1 ? (supports[0] ?? 0) : mean(supports.slice(1)),
  "mean without the two weakest": (supports) =>
    supports.length <= 2 ? (supports.at(-1) ?? 0) : mean(supports.slice(2)),
  "lower quartile": (supports) =>
    supports[Math.floor((supports.length - 1) * 0.25)] ?? 0,
  median: (supports) => supports[Math.floor((supports.length - 1) * 0.5)] ?? 0,
  /* How much of the word was contradicted at all, rather than how badly. */
  "share above 0.5": (supports) =>
    supports.length === 0
      ? 0
      : supports.filter((value) => value >= 0.5).length / supports.length,
};

function evaluate(rows, aggregate, threshold, allowed) {
  let falseAccepts = 0;
  let falseRejects = 0;
  let mistakes = 0;
  let corrects = 0;

  for (const row of rows) {
    const weak = row.supports.filter(
      (supports) => aggregate(supports) < threshold,
    ).length;
    const failed = weak > allowed;

    if (row.verdict === "mistake") {
      mistakes += 1;
      if (!failed) falseAccepts += 1;
    } else {
      corrects += 1;
      if (failed) falseRejects += 1;
    }
  }

  return {
    fa: (falseAccepts / Math.max(1, mistakes)) * 100,
    fr: (falseRejects / Math.max(1, corrects)) * 100,
    overall:
      ((mistakes - falseAccepts + corrects - falseRejects) / rows.length) * 100,
  };
}

async function main() {
  const rows = JSON.parse(
    await readFile(path.join(FIXTURES, ".scores.json"), "utf8"),
  );
  if (!rows[0]?.supports) {
    console.log("The cache has no per-phoneme detail; rerun sweep.mjs first.");
    return;
  }
  console.log(`${rows.length} clips cached\n`);

  const results = [];
  for (const [name, aggregate] of Object.entries(AGGREGATIONS)) {
    for (const threshold of [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]) {
      for (const allowed of [0, 1, 2]) {
        results.push({
          name,
          threshold,
          allowed,
          ...evaluate(rows, aggregate, threshold, allowed),
        });
      }
    }
  }

  for (const limit of [2, 5]) {
    console.log(`Best, keeping wrongly-flagged under ${limit}%:`);
    const usable = results
      .filter((result) => result.fr <= limit)
      .sort((a, b) => a.fa - b.fa)
      .slice(0, 6);
    if (usable.length === 0) console.log("  none");
    for (const result of usable) {
      console.log(
        `  ${result.fa.toFixed(1).padStart(5)}% missed  ` +
          `${result.fr.toFixed(1).padStart(5)}% flagged  ` +
          `${result.overall.toFixed(1)}% overall   ` +
          `${result.name} < ${result.threshold}, allow ${result.allowed}`,
      );
    }
    console.log("");
  }

  const best = results.reduce((a, b) => (a.overall > b.overall ? a : b));
  console.log(
    `Highest overall: ${best.overall.toFixed(1)}%  ` +
      `(${best.fa.toFixed(1)}% missed, ${best.fr.toFixed(1)}% flagged)  ` +
      `${best.name} < ${best.threshold}, allow ${best.allowed}`,
  );
}

await main();
