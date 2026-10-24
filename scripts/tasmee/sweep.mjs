/*
 * Choosing the verdict rule from a curve instead of from judgement.
 *
 * The expensive half - running the model and aligning - is done once per
 * clip and cached. Every rule and threshold is then tried against those
 * scores in memory, which is what makes it possible to compare dozens of
 * operating points rather than guessing at one.
 *
 * Reports false accepts against false rejects, because they trade: letting a
 * mistake through and accusing a correct reciter cannot both go to zero, and
 * for a memorization helper the second is the worse failure.
 *
 *   node scripts/tasmee/sweep.mjs [--fixtures scripts/tasmee/fixtures-large]
 */
import { flag } from "./lib/args.mjs";
import { stoppedShort } from "../../src/features/recitation-practice/model/practiceVerdict.ts";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createZipformer } from "./lib/zipformer.mjs";
import { readWavAsFloat32 } from "./lib/audio.mjs";
import {
  identityClasses,
  toPhonemeUnits,
} from "../../src/features/recitation-practice/model/phonemeTokens.ts";
import { alignToExpected } from "../../src/features/recitation-practice/model/ctcAlign.ts";

const MODEL_DIR = process.env.TASMEE_ZIPFORMER_DIR ?? ".models/zipformer";

async function collect(fixtures, cachePath) {
  try {
    return JSON.parse(await readFile(cachePath, "utf8"));
  } catch {
    /* no cache yet */
  }

  const zipformer = await createZipformer({
    modelPath: `${MODEL_DIR}/zipformer_p_arabic_v3.1.int8.onnx`,
    tokensPath: `${MODEL_DIR}/tokens.txt`,
  });
  const quran = JSON.parse(
    await readFile(`${MODEL_DIR}/ordered_quran_phonemes.json`, "utf8"),
  );
  const { classOf, classCount } = identityClasses(zipformer.symbols);
  const idOf = new Map();
  zipformer.symbols.forEach((symbol, id) => {
    if (symbol && symbol !== "<blank>") idOf.set(symbol, id);
  });

  const manifest = JSON.parse(
    await readFile(path.join(fixtures, "manifest.json"), "utf8"),
  );

  const rows = [];
  let done = 0;
  for (const clip of manifest.clips) {
    const ayah = quran[clip.verseKey];
    if (!ayah) continue;

    const labels = [];
    const spans = [];
    for (const word of ayah.aya_phonemes_list) {
      const from = labels.length;
      for (const unit of toPhonemeUnits(word, zipformer.inventory)) {
        const id = idOf.get(unit);
        if (id !== undefined) labels.push(id);
      }
      if (labels.length > from) spans.push({ from, to: labels.length });
    }
    if (spans.length === 0) continue;

    const audio = await readWavAsFloat32(path.join(fixtures, clip.audio));
    const { logProbs, frames, vocab } = await zipformer.logProbsFor(
      audio.samples ?? audio,
    );
    const scores = alignToExpected(
      logProbs,
      frames,
      vocab,
      labels,
      spans,
      zipformer.blankId,
      classOf,
      classCount,
    );

    rows.push({
      id: clip.id,
      kind: clip.kind,
      verdict: clip.verdict,
      scores: scores.map((score) => Number(score.score.toFixed(4))),
      /* Per-phoneme, so how a word's score is reached can be swept too. */
      supports: scores.map((score) =>
        score.supports.map((value) => Number(value.toFixed(4))),
      ),
    });

    done += 1;
    if (done % 50 === 0) console.log(`  scored ${done}…`);
  }

  await writeFile(cachePath, JSON.stringify(rows), "utf8");
  return rows;
}

/**
 * A clip is a mistake when enough of its words fall below `threshold`.
 *
 * Or when the reciter never reached the end, which the scores cannot say:
 * they only cover the stretch that was reached, because that is all the app
 * scores. The last word is allowed, the fixtures being cut at quran.com's
 * word timestamps, which run short - see the note in `cursor.mjs`.
 */
function judge(row, threshold, allowed) {
  const span = row.span ?? { from: 0, to: row.scores.length };
  const total = row.totalWords ?? row.scores.length;
  if (stoppedShort(total, span)) return "mistake";
  const below = row.scores.filter((score) => score < threshold).length;
  return below > allowed ? "mistake" : "correct";
}

function tally(rows, threshold, allowed) {
  let falseAccepts = 0;
  let falseRejects = 0;
  let mistakes = 0;
  let corrects = 0;

  for (const row of rows) {
    const got = judge(row, threshold, allowed);
    if (row.verdict === "mistake") {
      mistakes += 1;
      if (got === "correct") falseAccepts += 1;
    } else {
      corrects += 1;
      if (got === "mistake") falseRejects += 1;
    }
  }
  return { falseAccepts, falseRejects, mistakes, corrects };
}

async function main() {
  const fixtures = path.resolve(
    flag("fixtures", "scripts/tasmee/fixtures-large"),
  );
  const cachePath = path.join(fixtures, ".scores.json");

  console.log("Scoring clips (cached after the first run)…");
  const rows = await collect(fixtures, cachePath);
  console.log(`${rows.length} clips scored\n`);

  console.log("threshold  allowed   false accepts   false rejects");
  console.log("-".repeat(56));

  const best = [];
  for (const threshold of [0.05, 0.1, 0.15, 0.2, 0.3, 0.4, 0.5]) {
    for (const allowed of [0, 1, 2, 3]) {
      const result = tally(rows, threshold, allowed);
      const fa = (result.falseAccepts / result.mistakes) * 100;
      const fr = (result.falseRejects / result.corrects) * 100;
      best.push({ threshold, allowed, fa, fr });
      console.log(
        `   ${threshold.toFixed(2)}      ${allowed}      ` +
          `${String(result.falseAccepts).padStart(3)}/${result.mistakes} (${fa.toFixed(1)}%)` +
          `     ${String(result.falseRejects).padStart(3)}/${result.corrects} (${fr.toFixed(1)}%)`,
      );
    }
  }

  /* The operating point a memorization helper wants: false rejects low. */
  const usable = best
    .filter((point) => point.fr <= 5)
    .sort((a, b) => a.fa - b.fa);
  console.log("\nLowest false accepts while rejecting under 5% of correct:");
  for (const point of usable.slice(0, 5)) {
    console.log(
      `  threshold ${point.threshold} allowing ${point.allowed} weak words  ` +
        `-> ${point.fa.toFixed(1)}% missed, ${point.fr.toFixed(1)}% wrongly flagged`,
    );
  }
  if (usable.length === 0) console.log("  none - widen the search");
}

await main();
