/*
 * The recogniser's phonemes, written so a reciter can read them.
 *
 * The symbol table is phonetic rather than orthographic: length is a repeated
 * character, a shadda is a doubled one, and five sounds have letters of their
 * own that no Arabic keyboard has - ۥ and ۦ for a long u and i,
 * ڻ and ھ for the nasals of ikhfa', ڇ for a qalqalah
 * letter at rest. So the raw units of a word come out as `ضضَااااااللِۦۦۦۦن`,
 * which says exactly what was heard and says it to nobody.
 *
 * This writes the same sounds with the letters they are: `ضَّالِّين`.
 * It is an approximation of the word, not the word - the model hears sounds,
 * and `ضَّالِّين` is how `ٱلضَّآلِّينَ` sounds - so nothing should present
 * what comes out of here as the Quran's text. What it is for is the one
 * question a mark on a word leaves unanswered: not "which word was wrong"
 * but "what did I say instead". A dropped letter is then visible as a
 * dropped letter.
 */
/* Relative and extensioned so Node can load this unchanged, like the rest of
   the model directory: the bench reads a recorded run the same way. */
import { isDoubledConsonant } from "./phonemeTokens.ts";

/** Combining shadda, which is what a doubled consonant means here. */
const SHADDA = "\u0651";

/**
 * The symbols that are not the letter they sound like.
 *
 * Everything else in the table already is one - `صِرَاطَ` needs no
 * translating - so only these are listed, and anything unlisted is kept as
 * it is. The three marks that come last are dropped rather than rewritten:
 * they qualify how a sound is made, and there is no letter for them.
 *
 * Every `from` here is checked against `tokens.txt`, because two of them were
 * not and the mistake is invisible: the nasals were written U+06BB and U+06BE
 * - RNOON and HEH DOACHASHMEE - where the table uses U+06BA and U+06FE, so
 * both entries matched nothing and ں and ۾ reached the reader as the raw
 * glyphs they are. The table's whole character set is 42 code points; a
 * `from` that is not one of them is a typo, not a spare rule.
 */
const AS_LETTERS: [string, string][] = [
  ["ۥ", "و"], // a long u
  ["ۦ", "ي"], // a long i
  ["ں", "ن"], // the nasal n of ikhfa'
  ["۾", "م"], // the nasal m of iqlab
  ["ٲ", "أ"], // the table's own alef
  ["ڇ", "\u0652"], // a qalqalah letter at rest
  ["ـ", ""], // the tatweel of an imala
  ["\u06dc", ""], // nasalised, as in a ghunnah
  ["\u0619", ""], // the small waw of an iqlab
  ["\u06ea", ""], // the low stop of an imala
];

/**
 * One phoneme, with its length collapsed and its doubling made a shadda.
 *
 * Both are written by repeating a character and they mean opposite things, so
 * the repeat is read once and `isDoubledConsonant` decides which it was. A
 * madd of six harakat and one of two are the same letter; a doubled consonant
 * is a letter and a shadda.
 *
 * Only the *leading* run is read, which is enough: checked against all 251
 * symbols of the model's own table, none of them repeats a character anywhere
 * but at its start. A unit is a sound and then its vowel or its marker, never
 * two doubled sounds.
 */
function unitAsLetters(unit: string): string {
  const letter = unit.slice(0, 1);
  let at = 1;
  while (unit.startsWith(letter, at)) at += 1;

  const repeated = at > 1 && isDoubledConsonant(unit);
  return letter + (repeated ? SHADDA : "") + unit.slice(at);
}

/**
 * A run of phonemes as Arabic letters, or "" when there were none.
 *
 * Joined without spaces: these are the sounds of one word, or of the few that
 * were said in its place, and spacing them would read as separate words.
 */
export function phonemesAsLetters(units: readonly string[]): string {
  let text = units.map(unitAsLetters).join("");
  for (const [symbol, letter] of AS_LETTERS) {
    text = text.split(symbol).join(letter);
  }
  return text;
}

/**
 * What was heard where a word was expected.
 *
 * Three different things, and a mark on the word says none of them. Measured
 * on real clips, the difference is clean and it is the difference a reciter
 * needs: a word that was removed from the audio leaves its frames supporting
 * no sound at all, a word recited too weakly to accept decodes back to its
 * own letters, and a word swapped for another decodes to the other one's.
 * غَيرِ replaced from the next ayah reads back as `رَاتِ`; رَبِّ cut out
 * altogether reads back as nothing.
 *
 * `stumble` is the fourth reason a word can be listed and the only one this
 * cannot produce: both attempts are in the audio, the alignment uses the
 * good one, and only the live cursor saw the first. See `Stumble`.
 */
export type HeardInstead =
  /** The frames here support no sound: the word was not recited. */
  | { kind: "nothing" }
  /** The word's own sounds, but not firmly enough to accept them. */
  | { kind: "unclear" }
  /** Something else, written as letters. */
  | { kind: "other"; letters: string }
  /** Said wrongly and then said correctly, with the wrong attempt. */
  | { kind: "stumble"; letters: string }
  /**
   * The reader was stopped at it and said they could not say it.
   *
   * The only one of these the reader reports themselves, and the surest:
   * everything else here is inferred from the audio.
   */
  | { kind: "gaveUp" };

/**
 * Read a word's frames against the word that was expected there.
 *
 * Both sides go through `phonemesAsLetters`, so the comparison is on the
 * sounds rather than on the symbols: a madd held for two counts where the
 * label wanted four reads as the same word, which is the one difference the
 * model's own card says not to judge.
 */
export function whatWasHeard(
  expected: readonly string[],
  heard: readonly string[],
): HeardInstead {
  if (heard.length === 0) return { kind: "nothing" };
  const letters = phonemesAsLetters(heard);
  return letters === phonemesAsLetters(expected)
    ? { kind: "unclear" }
    : { kind: "other", letters };
}
