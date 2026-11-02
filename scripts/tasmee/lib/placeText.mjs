/*
 * Which ayah, and which of its words, a dataset's text is.
 *
 * Datasets name what was recited by its text, not by its place, and spell it
 * their own way - a different alef, a stray space, a mistake planted in it.
 * Compared by consonants and allowed a few edits, a sentence still finds its
 * ayah and the stretch of it that was said.
 */
import { allVerses, skeleton } from "./quranText.mjs";

/* Letters only, without long vowels and hamza seats, which spellings of
   one word disagree on; see `build-sobolev-fixtures.mjs`. */
const consonants = (text) => skeleton(text).replace(/[اويىئ]/g, "");

/** Letters edited, of the text's, before a match is refused. */
const MATCH_EDITS = 0.15;

/**
 * Where `needle` best fits inside `hay`, allowing edits: the start and end
 * of the stretch, and how many edits it took.
 */
function bestFit(needle, hay) {
  const n = needle.length;
  let previous = Array.from({ length: hay.length + 1 }, () => 0);
  const starts = [Array.from({ length: hay.length + 1 }, (_, j) => j)];
  for (let i = 1; i <= n; i += 1) {
    const row = [i];
    const from = [0];
    for (let j = 1; j <= hay.length; j += 1) {
      const same = needle[i - 1] === hay[j - 1] ? 0 : 1;
      const options = [
        [previous[j - 1] + same, starts[i - 1][j - 1]],
        [previous[j] + 1, starts[i - 1][j]],
        [row[j - 1] + 1, from[j - 1]],
      ];
      const [cost, start] = options.reduce((a, b) => (b[0] < a[0] ? b : a));
      row.push(cost);
      from.push(start);
    }
    previous = row;
    starts.push(from);
  }
  let end = 0;
  for (let j = 1; j <= hay.length; j += 1)
    if (previous[j] < previous[end]) end = j;
  return { start: starts[n][end], end, edits: previous[end] };
}

/** Runs of three letters, to find the few ayat worth aligning against. */
const trigrams = (letters) =>
  new Set(
    Array.from({ length: Math.max(0, letters.length - 2) }, (_, i) =>
      letters.slice(i, i + 3),
    ),
  );

/** Ayat aligned in full, of those sharing the most three-letter runs. */
const CANDIDATES = 25;

/**
 * The ayah and words a text from a dataset is, from its letters, and which
 * of those words carries an `@` - where some datasets mark a mistake. Null
 * when nothing fits within `MATCH_EDITS`. Word indices count the model's
 * written words from 0, as `spokenPosition` takes them.
 */
export function placeText(sentence, verses) {
  const at = sentence.indexOf("@");
  const clean = sentence.replace(/@/g, "");
  const needle = consonants(clean);
  const marked = consonants(sentence.slice(0, Math.max(0, at))).length - 1;
  const runs = [...trigrams(needle)];
  const likely = verses
    .map((verse) => ({
      verse,
      shared: runs.filter((run) => verse.trigrams.has(run)).length,
    }))
    .sort((a, b) => b.shared - a.shared)
    .slice(0, CANDIDATES)
    .map(({ verse }) => verse);
  let best = null;
  for (const verse of likely) {
    const fit = bestFit(needle, verse.letters);
    if (!best || fit.edits < best.fit.edits) best = { verse, fit };
  }
  if (!best || best.fit.edits > Math.max(1, needle.length * MATCH_EDITS))
    return null;
  const { verse, fit } = best;
  /* A letter's word, scaled across the stretch to absorb the edits. */
  const span = Math.max(1, needle.length - 1);
  const letterAt = (k) =>
    fit.start + Math.round((k * (fit.end - 1 - fit.start)) / span);
  const wordAt = (letter) =>
    verse.offsets.findIndex((offset, w) => letter < verse.offsets[w + 1]);
  return {
    key: verse.key,
    first: wordAt(fit.start),
    last: wordAt(fit.end - 1),
    target: at >= 0 ? wordAt(letterAt(Math.max(0, marked))) : null,
    edits: fit.edits,
  };
}

/** Every ayah in the model's own written words, ready for `placeText`. */
export async function placingIndex(quran) {
  return (await allVerses()).flatMap((verse) => {
    const key = `${verse.sura_no}:${verse.aya_no}`;
    const ayah = quran[key];
    if (!ayah) return [];
    const words = ayah.aya_text.trim().split(/\s+/);
    const offsets = [0];
    for (const word of words)
      offsets.push(offsets.at(-1) + consonants(word).length);
    const letters = consonants(words.join(""));
    return [{ key, letters, offsets, trigrams: trigrams(letters) }];
  });
}
