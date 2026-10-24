/*
 * Searching for a better verdict rule, against cached scores.
 *
 * `sweep.mjs` tries one family - "how many words fall below a threshold" -
 * and the best it finds misses 27% of mistakes. The reason is visible in its
 * own curve: tolerating no weak word rejects 61% of correct recitations,
 * tolerating one rejects 3.9%. Almost every clean recitation contains exactly
 * one weak word, so the tolerance that makes it usable is also what lets a
 * single genuinely wrong word through.
 *
 * Beating that means telling a spurious weak word from a real one rather than
 * counting them. The families below are different ways of trying:
 *
 *   count      how many words fall below a threshold (the current rule)
 *   two-tier   one word far below fails outright; otherwise count
 *   relative   judge each word against the median of its own recitation
 *   deficit    add up how far below the threshold the words fall
 *
 * Scoring is cached, so this is seconds rather than ten minutes.
 *
 *   node scripts/tasmee/rules.mjs
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

const FIXTURES = path.resolve("scripts/tasmee/fixtures-large");

const median = (values) => {
  if (values.length === 0) return 1;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0);
};

/** Every rule is a name plus a predicate: did this recitation go wrong? */
function* rules() {
  for (const threshold of [0.2, 0.3, 0.4, 0.5, 0.6]) {
    for (const allowed of [0, 1, 2]) {
      yield {
        family: "count",
        name: `below ${threshold}, allow ${allowed}`,
        failed: (scores) =>
          scores.filter((score) => score < threshold).length > allowed,
      };
    }
  }

  for (const hard of [0.01, 0.02, 0.05, 0.1, 0.15]) {
    for (const soft of [0.4, 0.5, 0.6]) {
      for (const allowed of [1, 2]) {
        yield {
          family: "two-tier",
          name: `any < ${hard}, or ${allowed}+ below ${soft}`,
          failed: (scores) =>
            scores.some((score) => score < hard) ||
            scores.filter((score) => score < soft).length > allowed,
        };
      }
    }
  }

  for (const factor of [0.1, 0.2, 0.3, 0.5]) {
    for (const floor of [0.05, 0.1, 0.2]) {
      yield {
        family: "relative",
        name: `below ${factor}x its own median (floor ${floor})`,
        failed: (scores) => {
          const middle = median(scores);
          const limit = Math.max(floor, middle * factor);
          return scores.some((score) => score < limit);
        },
      };
    }
  }

  for (const threshold of [0.4, 0.5, 0.6]) {
    for (const budget of [0.8, 1.2, 1.6, 2.2, 3]) {
      yield {
        family: "deficit",
        name: `total shortfall below ${threshold} over ${budget}`,
        failed: (scores) =>
          scores.reduce(
            (sum, score) => sum + Math.max(0, threshold - score),
            0,
          ) > budget,
      };
    }
  }
}

function evaluate(rows, rule) {
  let falseAccepts = 0;
  let falseRejects = 0;
  let mistakes = 0;
  let corrects = 0;

  for (const row of rows) {
    const failed = rule.failed(row.scores);
    if (row.verdict === "mistake") {
      mistakes += 1;
      if (!failed) falseAccepts += 1;
    } else {
      corrects += 1;
      if (failed) falseRejects += 1;
    }
  }

  return {
    ...rule,
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
  console.log(`${rows.length} clips cached\n`);

  const results = [...rules()].map((rule) => evaluate(rows, rule));

  for (const limit of [2, 5, 10]) {
    const usable = results
      .filter((result) => result.fr <= limit)
      .sort((a, b) => a.fa - b.fa)
      .slice(0, 4);
    console.log(`Best, keeping wrongly-flagged under ${limit}%:`);
    if (usable.length === 0) console.log("  none\n");
    for (const result of usable) {
      console.log(
        `  ${result.fa.toFixed(1).padStart(5)}% missed  ` +
          `${result.fr.toFixed(1).padStart(5)}% flagged  ` +
          `${result.overall.toFixed(1)}% overall   ` +
          `[${result.family}] ${result.name}`,
      );
    }
    console.log("");
  }

  const best = results.reduce((a, b) => (a.overall > b.overall ? a : b));
  console.log(
    `Highest overall: ${best.overall.toFixed(1)}%  ` +
      `(${best.fa.toFixed(1)}% missed, ${best.fr.toFixed(1)}% flagged)  ` +
      `[${best.family}] ${best.name}`,
  );
}

await main();
