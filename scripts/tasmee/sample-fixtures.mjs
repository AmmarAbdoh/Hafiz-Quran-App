/*
 * A smaller fixture set that stands in for a big one.
 *
 * `measure.mjs` runs a worker per core and gets through 18,415 clips in
 * minutes. `evaluate.mjs` is a serial loop by design - it exists to compare
 * whole judging strategies, one of which loads Whisper - and at a few seconds
 * a clip the same set would take a day and a half. So comparisons run on a
 * sample, and this writes one.
 *
 * Systematic rather than random: the clips are ordered by duration and every
 * nth is taken. No seed to record, the same input always gives the same
 * sample, and the result spans short clips and long ones in proportion -
 * which matters here because duration is what a 30-second Whisper window
 * cares about, and because a learner's short ayah and a long one are not the
 * same test.
 *
 * The sample points at the original's audio rather than copying it, so a
 * 5.5GB set costs a few hundred kilobytes to sample.
 *
 *   node scripts/tasmee/sample-fixtures.mjs --from scripts/tasmee/fixtures-learner \
 *     --out scripts/tasmee/fixtures-learner-sample --count 1000
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { flag } from "./lib/args.mjs";

/** Seconds, pulled out of `note` where the builder recorded it. */
function secondsOf(clip) {
  const match = /([0-9]+(?:\.[0-9]+)?)s/.exec(clip.note ?? "");
  return match ? Number(match[1]) : 0;
}

async function main() {
  const from = path.resolve(flag("from", "scripts/tasmee/fixtures-learner"));
  const out = path.resolve(
    flag("out", "scripts/tasmee/fixtures-learner-sample"),
  );
  const count = Number(flag("count", "1000"));

  const manifest = JSON.parse(
    await readFile(path.join(from, "manifest.json"), "utf8"),
  );
  const all = manifest.clips;
  if (all.length === 0) throw new Error(`${from} has no clips`);

  /* Ordered by duration, then by id so equal durations are not left to the
     order the index happened to list them in. */
  const ordered = [...all].sort(
    (a, b) => secondsOf(a) - secondsOf(b) || a.id.localeCompare(b.id),
  );

  const step = ordered.length / Math.min(count, ordered.length);
  const clips = [];
  for (let i = 0; clips.length < Math.min(count, ordered.length); i += 1) {
    const at = Math.floor(i * step);
    if (at >= ordered.length) break;
    const clip = ordered[at];
    clips.push({
      ...clip,
      /* Relative to the sample directory, so the audio is not duplicated. */
      audio: path.posix.join(
        "..",
        path.basename(from),
        clip.audio.split(path.sep).join("/"),
      ),
    });
  }

  await mkdir(out, { recursive: true });
  await writeFile(
    path.join(out, "manifest.json"),
    `${JSON.stringify({ clips }, null, 1)}\n`,
    "utf8",
  );

  const seconds = clips.map(secondsOf);
  const total = seconds.reduce((a, b) => a + b, 0);
  const sorted = [...seconds].sort((a, b) => a - b);
  const verdicts = {};
  for (const clip of clips)
    verdicts[clip.verdict] = (verdicts[clip.verdict] ?? 0) + 1;

  console.log(`${all.length} clips in, ${clips.length} sampled`);
  console.log(`verdicts: ${JSON.stringify(verdicts)}`);
  console.log(
    `duration: min ${sorted[0]?.toFixed(1)}s  median ` +
      `${sorted[Math.floor(sorted.length / 2)]?.toFixed(1)}s  max ` +
      `${sorted.at(-1)?.toFixed(1)}s  total ${(total / 60).toFixed(0)} min`,
  );
  console.log(`distinct ayat: ${new Set(clips.map((c) => c.verseKey)).size}`);
  console.log(
    `distinct surahs: ${new Set(clips.map((c) => c.verseKey.split(":")[0])).size}`,
  );
  console.log(`\nmanifest: ${path.join(out, "manifest.json")}`);
}

await main();
