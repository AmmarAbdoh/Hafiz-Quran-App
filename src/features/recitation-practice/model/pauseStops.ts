/*
 * Where a reciter may stop, and what stopping sounds like.
 *
 * The model's phonemes are the ayah recited straight through. Joining words
 * changes how the first one ends - a tanween hides in the next word's sound,
 * a last vowel runs into it - and where the two run together they are one
 * stretch of sound with no boundary in it: مُتَشَٰبِهَٰتٌۖ فَأَمَّا is
 * `مُتَشَاابِهَااتُںںںفَءَممممَ`. But the mushaf marks where stopping is
 * allowed, and a reciter who stops there says مُتَشَابِهَاتْ, breathes, and
 * starts فَأَمَّا afresh. That is correct recitation, and the page's sounds
 * call it wrong: a reciter stopped there was held for 36 seconds, refused
 * every time they said it with the stop, until they said the two joined.
 *
 * So each pause mark is turned into what the cursor needs to let it pass:
 * which of the sounds only joining produces, where the next word begins, and
 * what the stopped ending sounds like. Of 4,272 marks, 739 fall inside a
 * spoken word like that one; the rest end a spoken word, and stopping
 * changes only how it ends.
 *
 * Built from the written words, because the phonemes cannot say which
 * sounds belong to which word. Where the written word and its sounds do not
 * agree on the shape, no stop is made: a reciter stopping there is no worse
 * off than before, and one carrying on is never let through anything.
 */
import { groupWrittenWords, mushafPositions } from "./wordPhonemes.ts";
import { phonemeIdentity, toPhonemeUnits } from "./phonemeTokens.ts";

/**
 * A place in a spoken word where the reciter may stop, in its units.
 *
 * Indices are into the units as the recogniser writes them; the cursor maps
 * them onto its own when it reduces those to identities.
 */
export interface PauseStop {
  /** The first sound that only joining the words produces. */
  from: number;
  /** Where the words part: the next word's first sound, or the word's end. */
  at: number;
  /** The stopped word's last letter as it can be heard on its own. */
  letters: string[];
  /** A fathatan, which stopping lengthens into an alif. */
  alif: boolean;
  /** The next word's first sound said afresh, where joining merged it. */
  opening: string | null;
  /** The next word opens with a hamzat al-wasl, which starting it sounds. */
  hamza: boolean;
}

/** The marks where stopping is allowed. ۜ is a sakt, a breath without one. */
const PAUSE_MARKS = /[ۖۗۘۚۛ]/u;
const FATHATAN = /[ًࣰ]/u;
const OTHER_TANWEEN = /[ٌࣱٍࣲ]/u;
const SHORT_VOWEL = /[َُِ]$/u;
const SHADDA = "ّ";
const HAMZAT_WASL = "ٱ";
const LETTER = /[ء-ي]/u;
const NASAL = new Set(["ں", "۾", "ن"]);
const HAMZA_FORMS = /[أإآؤئء]/u;

/** Whether a written word is followed by a mark where stopping is allowed. */
function hasPauseMark(word: string): boolean {
  return PAUSE_MARKS.test(word);
}

/**
 * Each spoken word's pause stops, in step with `phonologicalWords`.
 *
 * `datasetWords` are the model's written words, which its phonemes were
 * made from; `mushafWords` the mushaf's, which carry the pause marks.
 */
export function pauseStopsOf(
  datasetWords: readonly string[],
  mushafWords: readonly string[],
  phonologicalWords: readonly string[],
  inventory: readonly string[],
): PauseStop[][] {
  const none = phonologicalWords.map((): PauseStop[] => []);
  const groups = groupWrittenWords(datasetWords, phonologicalWords, inventory);
  if (!groups) return none;
  const positions = mushafPositions(datasetWords, mushafWords);
  /* After the last dataset word of a mushaf word that carries a mark. */
  const pauseAfter = datasetWords.map(
    (_, index) =>
      positions[index + 1] !== positions[index] &&
      hasPauseMark(mushafWords[positions[index]! - 1] ?? ""),
  );

  let first = 0;
  return groups.map((take, spoken) => {
    const units = toPhonemeUnits(phonologicalWords[spoken]!, inventory);
    const written = datasetWords.slice(first, first + take);
    const stops: PauseStop[] = [];
    written.forEach((word, inWord) => {
      if (!pauseAfter[first + inWord]) return;
      const next = written[inWord + 1] ?? null;
      const at = next
        ? whereNextBegins(units, written, inWord, next)
        : units.length;
      const stop = at === null ? null : stopAt(units, at, word, next);
      if (stop) stops.push(stop);
    });
    first += take;
    return stops;
  });
}

/** Letters that carry sound, for placing a word among its sounds. */
function lettersIn(word: string): number {
  return [...word].filter((char) => LETTER.test(char)).length;
}

/** The letter the next word's first sound is written with, when joined. */
function openingLetter(word: string): string | null {
  const letters = [...word].filter(
    (char) => LETTER.test(char) || char === HAMZAT_WASL,
  );
  if (letters[0] === HAMZAT_WASL || letters[0] === "ا") {
    /* The article: a sun letter takes the lam's place. */
    if (letters[1] === "ل" && articleSunLetter(word)) {
      return articleSunLetter(word);
    }
    return letters[1] ?? null;
  }
  const opening = letters[0] ?? null;
  return opening && HAMZA_FORMS.test(opening) ? "ء" : opening;
}

/** The sun letter an article assimilates to, or null for a moon letter. */
function articleSunLetter(word: string): string | null {
  const chars = [...word];
  const lam = chars.findIndex((char) => char === "ل");
  if (lam < 0) return null;
  const after = chars.findIndex((char, i) => i > lam && LETTER.test(char));
  if (after < 0) return null;
  const marks = chars.slice(after + 1, after + 3);
  return marks.includes(SHADDA) ? chars[after]! : null;
}

/**
 * Whether the next word opens doubled in its own right, as `ٱلَّذِينَ` and
 * an article before a sun letter do. Nothing else can: a word never begins
 * with a doubled letter, so a shadda on its first letter is the word before
 * merging into it - the mushaf writes the idgham there.
 */
function opensDoubled(word: string): boolean {
  const chars = [...word];
  const first = chars.findIndex(
    (char) => LETTER.test(char) || char === HAMZAT_WASL,
  );
  if (chars[first] !== HAMZAT_WASL) return false;
  if (articleSunLetter(word)) return true;
  const after = chars.findIndex((char, i) => i > first && LETTER.test(char));
  return chars.slice(after + 1, after + 3).includes(SHADDA);
}

/**
 * Where in a joined spoken word the word after `inWord` begins: the sound
 * its first letter is heard in, nearest where the letters say it should be.
 * Only a place a word boundary can look like - after a nasal, a vowel or a
 * bare م or ن, or a sound merged from both - so a letter that merely recurs
 * inside the word is not taken for it.
 */
function whereNextBegins(
  units: readonly string[],
  written: readonly string[],
  inWord: number,
  next: string,
): number | null {
  const letter = openingLetter(next);
  if (!letter) return null;
  const before = written
    .slice(0, inWord + 1)
    .reduce((sum, word) => sum + lettersIn(word), 0);
  const total = written.reduce((sum, word) => sum + lettersIn(word), 0);
  const estimate = (units.length * before) / Math.max(1, total);

  let best: number | null = null;
  for (let at = 1; at < units.length; at += 1) {
    if (!units[at]!.startsWith(letter)) continue;
    const previous = units[at - 1]!;
    const boundary =
      NASAL.has(phonemeIdentity(previous)) ||
      SHORT_VOWEL.test(previous) ||
      previous === "م" ||
      /^(.)\1/u.test(units[at]!);
    if (!boundary) continue;
    if (best === null || Math.abs(at - estimate) < Math.abs(best - estimate)) {
      best = at;
    }
  }
  return best;
}

/** A unit without its closing vowel: `تُ` is `ت`, `ققِ` is `قق`. */
function bare(unit: string): string {
  return unit.replace(SHORT_VOWEL, "");
}

/**
 * The stop before `at`, from how `word` ends; null where the sounds do not
 * have the shape the writing says they should.
 */
function stopAt(
  units: readonly string[],
  at: number,
  word: string,
  next: string | null,
): PauseStop | null {
  const before = units[at - 1];
  if (before === undefined) return null;
  const nasal = NASAL.has(phonemeIdentity(before));
  /* The last of the word's own letters, voweled in joining. */
  const voweled = nasal ? at - 2 : at - 1;
  const letterUnit = units[voweled];
  const marbuta = /ة/u.test(word);
  const following = units[at] ?? "";
  const merged =
    next !== null && !nasal && /^(.)\1/u.test(following) && !opensDoubled(next);
  /* `وووَ` said afresh is `وَ`: the letter once, with its vowel. */
  const opening = merged
    ? phonemeIdentity(following.slice(0, 1) + following.slice(-1))
    : null;
  const hamza =
    next !== null &&
    [...next].find((char) => LETTER.test(char) || char === HAMZAT_WASL) ===
      HAMZAT_WASL;
  const make = (from: number, letters: string[], alif: boolean) =>
    from < 0 || from > at
      ? null
      : { from, at, letters: [...new Set(letters)], alif, opening, hamza };

  if (FATHATAN.test(word) && !marbuta) {
    if (!letterUnit || !SHORT_VOWEL.test(letterUnit)) return null;
    return make(nasal ? at - 1 : at, [], true);
  }
  if (FATHATAN.test(word) || OTHER_TANWEEN.test(word)) {
    if (!letterUnit || !SHORT_VOWEL.test(letterUnit)) return null;
    const letter = bare(letterUnit);
    return make(
      voweled,
      marbuta ? [letter, "ه"] : [letter, letter.slice(0, 1)],
      false,
    );
  }
  const last = [...word].filter((char) => LETTER.test(char)).at(-1);
  if ((last === "م" || last === "ن") && nasal) {
    return make(at - 1, [last], false);
  }
  if ((last === "م" || last === "ن") && merged) {
    return make(at, [last], false);
  }
  /* A pronoun's ه, lengthened only by joining: بِهِۦ stopped is بِهْ. */
  const held = phonemeIdentity(before);
  if ((held === "ۦ" || held === "ۥ") && /^ه[ُِ]$/u.test(units[at - 2] ?? "")) {
    return make(at - 2, ["ه"], false);
  }
  /* A last letter voweled only by joining. */
  if (SHORT_VOWEL.test(before) && !nasal) {
    const letter = bare(before);
    return make(
      at - 1,
      marbuta ? [letter, "ه"] : [letter, letter.slice(0, 1)],
      false,
    );
  }
  return null;
}
