import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import path from "node:path";
import { groupWrittenWords } from "../../../src/features/recitation-practice/model/wordPhonemes.ts";

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

/*
 * Compare two spellings of the same ayah for the letters they share.
 *
 * The dataset's transcripts and ours differ in presentation - a superscript
 * alef written ـٰ against ٰ, a tanween with a small meem against a plain one,
 * tatweel inserted for shaping - none of which changes which ayah it is. So
 * the comparison keeps the consonant skeleton and drops every mark, which is
 * enough to catch a clip filed under the wrong verse and blind to the
 * spelling differences that do not matter.
 *
 * Hamza is dropped too, the standalone letter along with the marks. It was
 * the whole of the first run's 695 rejections: \u0671\u0644\u0652\u0621\u064E\u0627\u064A\u064E\u0670\u062A\u0650 against \u0671\u0644\u0652\u0640\u064E\u0654\u0627\u064A\u064E\u0640\u0670\u062A\u0650
 * is one spelling with hamza as a letter and one with it as a mark over its
 * seat, the same word either way. Dropping it cannot hide a different ayah,
 * because the rest of the skeleton still has to agree.
 *
 * Listed as ranges and tested per code point rather than written as a
 * character class. A class of combining marks is exactly what
 * `no-misleading-character-class` exists to refuse, and it is right to: the
 * marks here combine with whatever precedes them, so the literal is harder
 * to read than the list.
 */
const MARK_RANGES = [
  [0x0610, 0x061a], // honorifics and annotation signs
  [0x0621, 0x0621], // hamza, written as a letter
  [0x0640, 0x0640], // tatweel, inserted only for shaping
  [0x064b, 0x065f], // tanween, harakat, shadda, sukun, hamza above and below
  [0x0670, 0x0670], // superscript alef
  [0x06d6, 0x06ed], // small high and low marks, and the Qur'anic stop signs
  [0x08f0, 0x08ff], // open tanween and the other extended Qur'anic marks
  [0x200b, 0x200f], // zero width and direction marks
];

/** Alef, yeh and heh spellings that differ only in how they are written. */
const SAME_LETTER = new Map([
  [0x0622, "\u0627"],
  [0x0623, "\u0627"],
  [0x0625, "\u0627"],
  [0x0671, "\u0627"],
  [0x0672, "\u0627"],
  [0x0673, "\u0627"],
  [0x0649, "\u064A"],
  [0x06cc, "\u064A"], // Farsi yeh, which some Uthmani fonts use for every yeh
  [0x06c0, "\u0647"],
  [0x06d5, "\u0647"],
]);

export function skeleton(text) {
  let out = "";
  for (const character of text) {
    const code = character.codePointAt(0);
    if (code === undefined) continue;
    if (MARK_RANGES.some(([low, high]) => code >= low && code <= high))
      continue;
    if (/\s/.test(character)) continue;
    out += SAME_LETTER.get(code) ?? character;
  }
  return out;
}

/**
 * Where a named word sits among an ayah's words, compared by skeleton, or -1
 * when it is not there or is there more than once.
 *
 * `spelling` reduces a word to what is compared; the skeleton by default.
 *
 * A word named by its text alone does not say which of two copies was
 * wrong, and taking the first counts a mark on the real one as a mark on the
 * wrong word. Better left untargeted.
 */
export function onlyIndexOf(words, named, spelling = skeleton) {
  const wanted = spelling(named);
  const found = words.flatMap((word, index) =>
    spelling(word) === wanted ? [index] : [],
  );
  return found.length === 1 ? found[0] : -1;
}

/**
 * Which spoken word, counted from 1, holds one of an ayah's written words.
 *
 * The bench numbers words as they are said - `verseKey:n` over the ayah's
 * `aya_phonemes_list` - and that can join two written words into one:
 * 112:4 says يَكُن لَّهُۥ as one, so its fifth written word is its fourth
 * spoken. Grouped the way the app groups them (`groupWrittenWords`).
 *
 * `ayah` is the model's entry for it, and `written` counts its own words
 * (`aya_text`) from 0. Null when the word is not in it, or when the ayah's
 * words cannot be grouped: the app then follows the whole ayah as one
 * sound, and no single word of it can be the target.
 */
export function spokenPosition(ayah, written, inventory) {
  if (written < 0) return null;
  const groups = groupWrittenWords(
    ayah.aya_text.split(/\s+/).filter(Boolean),
    ayah.aya_phonemes_list,
    inventory,
  );
  if (!groups) return null;
  let covered = 0;
  for (const [index, size] of groups.entries()) {
    covered += size;
    if (written < covered) return index + 1;
  }
  return null;
}
