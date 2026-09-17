import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import path from "node:path";

const CORE_PATH = path.resolve("public/data/quran/v1/core.json.gz");

let corePromise = null;

/**
 * The app's own verse data, read straight off disk.
 *
 * Deliberately not the network. The text a fixture is scored against has to
 * be the same text the app would hand the model, or the harness measures the
 * wrong thing.
 */
async function loadCore() {
  corePromise ??= readFile(CORE_PATH).then((buffer) =>
    JSON.parse(gunzipSync(buffer).toString("utf8")),
  );
  return corePromise;
}

export async function getVerse(surah, ayah) {
  const core = await loadCore();
  const verse = core.mushafVerses.find(
    (candidate) => candidate.sura_no === surah && candidate.aya_no === ayah,
  );
  if (!verse) throw new Error(`No verse ${surah}:${ayah}`);
  return verse;
}

/**
 * The imlaei (standard) orthography, which is what an ASR produces - as
 * opposed to the Uthmani script the mushaf draws. Matching speech against
 * Uthmani is one of the classic ways these systems quietly fail.
 */
export async function getExpectedText(surah, ayah) {
  const verse = await getVerse(surah, ayah);
  return verse.aya_text_emlaey.trim();
}

export async function getExpectedWords(surah, ayah) {
  return (await getExpectedText(surah, ayah)).split(/\s+/).filter(Boolean);
}
