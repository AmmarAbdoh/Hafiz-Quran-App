/*
 * Scores one runner against the fixture set.
 *
 * Reports false accepts and false rejects, not WER. WER tells you how well a
 * model transcribes; it does not tell you whether an app built on it will
 * tell someone they recited correctly when they did not. That is the number
 * this exists to produce.
 *
 *   node scripts/tasmee/evaluate.mjs --runner baseline
 *   node scripts/tasmee/evaluate.mjs --runner zipformer --json out.json
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { readWavAsFloat32 } from "./lib/audio.mjs";

const FIXTURES = path.resolve("scripts/tasmee/fixtures");

function arg(flag, fallback) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? fallback : process.argv[index + 1];
}

function pct(value, total) {
  return total === 0 ? "n/a" : `${((value / total) * 100).toFixed(1)}%`;
}

async function main() {
  const runnerName = arg("--runner", "baseline");
  const runnerPath = path.join(FIXTURES, "..", "runners", `${runnerName}.mjs`);
  const runner = await import(pathToFileURL(runnerPath).href);

  const manifest = JSON.parse(
    await readFile(path.join(FIXTURES, "manifest.json"), "utf8"),
  );

  console.log(`runner:   ${runner.name}`);
  console.log(`fixtures: ${manifest.clips.length} clips\n`);
  process.stdout.write("loading model… ");
  const judge = await runner.createJudge();
  console.log("ready\n");

  const results = [];
  for (const clip of manifest.clips) {
    const audio = await readWavAsFloat32(path.join(FIXTURES, clip.audio));
    const started = performance.now();
    let outcome;
    try {
      outcome = await judge({
        audio,
        verseKey: clip.verseKey,
        expectedText: clip.expectedText,
        expectedWords: clip.expectedText.split(/\s+/).filter(Boolean),
      });
    } catch (error) {
      outcome = { verdict: "error", detail: String(error).slice(0, 80) };
    }
    const ms = Math.round(performance.now() - started);
    const correct = outcome.verdict === clip.verdict;
    results.push({
      ...clip,
      got: outcome.verdict,
      detail: outcome.detail,
      ms,
      correct,
    });
    process.stdout.write(
      `${correct ? "  ok  " : "  ** "} ${clip.id.padEnd(30)} want=${clip.verdict.padEnd(8)} got=${String(outcome.verdict).padEnd(8)} ${String(ms).padStart(6)}ms\n`,
    );
  }

  /*
   * A false accept is recited-wrong judged correct. It is the one that makes
   * the feature worse than useless, because it teaches the mistake. A false
   * reject is only annoying.
   */
  const mistakes = results.filter((r) => r.verdict === "mistake");
  const corrects = results.filter((r) => r.verdict === "correct");
  const falseAccepts = mistakes.filter((r) => r.got === "correct");
  const falseRejects = corrects.filter((r) => r.got === "mistake");
  const errors = results.filter((r) => r.got === "error");
  const latencies = results.map((r) => r.ms).sort((a, b) => a - b);

  console.log(`\n${"=".repeat(64)}`);
  console.log(
    `FALSE ACCEPTS  ${falseAccepts.length}/${mistakes.length}  (${pct(falseAccepts.length, mistakes.length)})   <- the number that decides it`,
  );
  console.log(
    `false rejects  ${falseRejects.length}/${corrects.length}  (${pct(falseRejects.length, corrects.length)})`,
  );
  console.log(
    `overall        ${results.filter((r) => r.correct).length}/${results.length} correct`,
  );
  if (errors.length) console.log(`errors         ${errors.length}`);
  console.log(
    `latency        median ${latencies[Math.floor(latencies.length / 2)]}ms   worst ${latencies.at(-1)}ms`,
  );

  if (falseAccepts.length) {
    console.log(`\nmistakes it waved through:`);
    for (const r of falseAccepts) {
      console.log(`  ${r.kind.padEnd(16)} ${r.id}`);
      console.log(`      ${r.detail}`);
    }
  }

  const byKind = {};
  for (const r of results) {
    byKind[r.kind] ??= { total: 0, right: 0 };
    byKind[r.kind].total += 1;
    if (r.correct) byKind[r.kind].right += 1;
  }
  console.log(`\nby kind:`);
  for (const [kind, { total, right }] of Object.entries(byKind)) {
    console.log(`  ${kind.padEnd(18)} ${right}/${total}`);
  }

  const jsonOut = arg("--json");
  if (jsonOut) {
    await writeFile(
      jsonOut,
      `${JSON.stringify({ runner: runner.name, results }, null, 2)}\n`,
      "utf8",
    );
    console.log(`\nwrote ${jsonOut}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
