/*
 * Build a bench fixture set from the Quran Recitation Alignment Benchmark
 * (QUD-Technologies/quran-alignment-benchmark on Hugging Face, CC BY 4.0).
 *
 * Why this set exists: every other set here is one ayah or one page, cut
 * clean. These are whole recitations as people hear them - sixteen of them,
 * six hours: murattal, mujawwad, hadr and a teacher's muallim, three in
 * prayer with the takbir and the imam's silences, several live and
 * reverberant, with up to seventy passages recited again. Each has every
 * recited word's start and end, reviewed by hand. So it is the one set that
 * can say how far behind the reciter the cursor runs, and whether it keeps
 * up over a whole surah rather than a clip.
 *
 * It is not a set of mistakes: everything in it is recited correctly, and
 * going back over a passage is how people recite, not an error.
 *
 * Cite: QUD Technologies, Quran Recitation Alignment Benchmark v1,
 * https://github.com/QUD-Technologies/quran-alignment-benchmark
 *
 * The audio is gitignored. RAW is what `extract-qud.py` unpacked: an MP3 and
 * a JSON per recording.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { flag } from "./lib/args.mjs";
import { toWav } from "./lib/audio.mjs";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const RAW = flag("raw", "");
const OUT = path.join(ROOT, "scripts/tasmee/fixtures-qud");

async function main() {
  if (!RAW) {
    console.log(
      "usage: node scripts/tasmee/build-qud-fixtures.mjs --raw <dir extract-qud.py wrote>",
    );
    process.exitCode = 1;
    return;
  }
  const clips = [];
  for (const file of (await readdir(RAW)).filter((f) => f.endsWith(".json"))) {
    const recording = JSON.parse(await readFile(path.join(RAW, file), "utf8"));
    const id = `q-${recording.id}`;
    const audio = `clips/${id}.wav`;
    await toWav(path.join(RAW, `${recording.id}.mp3`), path.join(OUT, audio));
    /* Every ayah recited, in the order first reached: a prayer recording
       is Al-Faatihah and then a surah, not one stretch of the mushaf. */
    const verseKeys = [
      ...new Set(
        recording.truth.words.map((w) =>
          w.word.split(":").slice(0, 2).join(":"),
        ),
      ),
    ];
    clips.push({
      id,
      audio,
      verseKeys,
      verseKey: verseKeys[0],
      verdict: "correct",
      kind: recording.content === "prayer" ? "prayer" : recording.style,
      noisy: recording.noisy,
      repeats: recording.repeat_events,
      seconds: recording.duration_s,
      truth: recording.truth.words,
      note: `${recording.reciter}, ${recording.passages}: ${recording.description}`,
    });
    console.log(
      `${id}: ${verseKeys.length} ayat, ${recording.truth.words.length} words`,
    );
  }
  await writeFile(
    path.join(OUT, "manifest.json"),
    `${JSON.stringify({ clips }, null, 1)}\n`,
    "utf8",
  );
  console.log(`\nmanifest: ${path.join(OUT, "manifest.json")}`);
}

await main();
