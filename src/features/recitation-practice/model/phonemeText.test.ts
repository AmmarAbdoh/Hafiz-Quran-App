import { describe, expect, it } from "vitest";
import { phonemesAsLetters, whatWasHeard } from "./phonemeText";

/*
 * Every case here is a real word's units, taken from the model's own
 * `ordered_quran_phonemes.json` rather than invented, because the point of
 * this module is that it reads the table's conventions correctly - and the
 * table is the only authority on them.
 */
describe("writing the recogniser's phonemes as letters", () => {
  it("reads a held sound once, however long it was held", () => {
    // صِرَاطَ, whose اا is one alef held for two counts.
    expect(phonemesAsLetters(["صِ", "رَ", "اا", "طَ"])).toBe("صِرَاطَ");
  });

  it("writes a doubled consonant as a shadda, not as two letters", () => {
    /* إيَّاك, whose doubled ي is the difference between "you alone" and
       something else entirely - so it must survive, and as one letter. */
    expect(phonemesAsLetters(["ءِ", "ييَ", "اا", "كَ"])).toBe("ءِيَّاكَ");
  });

  it("gives the table's own letters the letters they sound like", () => {
    /* The long i of نَستَعِين is written ۦ, which is on no keyboard. */
    expect(phonemesAsLetters(["عِ", "ۦۦۦۦ"])).toBe("عِي");
    /* And the long u of مَغضُوب. */
    expect(phonemesAsLetters(["ضُ", "ۥۥ"])).toBe("ضُو");
  });

  it("writes a qalqalah letter at rest with a sukoon", () => {
    // أَحَدْ, the last word of al-Ikhlas.
    expect(phonemesAsLetters(["ءَ", "حَ", "دڇ"])).toBe("ءَحَد\u0652");
  });

  /*
   * The nasals, which were wrong and silently so: the table uses U+06BA and
   * U+06FE, and the mapping was written against U+06BB and U+06BE - RNOON and
   * HEH DOACHASHMEE - so neither matched anything and both reached the reader
   * as the raw glyph. Nothing threw; the line just read as nonsense.
   */
  it("gives the ikhfa' and iqlab nasals their own letters", () => {
    expect(phonemesAsLetters(["عَ", "ںںں"])).toBe("عَن");
    expect(phonemesAsLetters(["۾۾۾"])).toBe("م");
  });

  /* And the marks that qualify a sound rather than being one are dropped,
     including the low stop of an imala. */
  it("drops the marks that are not sounds", () => {
    expect(phonemesAsLetters(["ر۪"])).toBe("ر");
    expect(phonemesAsLetters(["لۜ"])).toBe("ل");
    expect(phonemesAsLetters(["نؙ"])).toBe("ن");
  });

  it("says nothing when there was nothing", () => {
    expect(phonemesAsLetters([])).toBe("");
  });
});

describe("what was heard where a word was expected", () => {
  const WORD = ["ءَ", "حَ", "دڇ"];

  it("calls the word unclear when what was heard was the word", () => {
    expect(whatWasHeard(WORD, WORD)).toEqual({ kind: "unclear" });
  });

  /*
   * The one difference this must not report, and the model's own card is
   * explicit about it: reciters legitimately choose two, four or six harakat
   * where the training labels fixed one, so length belongs to alignment
   * timing rather than to the emitted symbol.
   */
  it("reports no difference when only the length of a madd differed", () => {
    expect(
      whatWasHeard(["صِ", "اااااا", "اا", "طَ"], ["صِ", "اا", "اا", "طَ"]),
    ).toEqual({ kind: "unclear" });
  });

  it("says what was heard when a letter went missing", () => {
    /* أَنعَمتَ recited as أَنعَتَ - the م the recogniser dropped on a real
       microphone, which is what started all of this. */
    const expected = ["ءَ", "ن", "عَ", "م", "تَ"];
    const heard = ["ءَ", "ن", "عَ", "تَ"];

    expect(whatWasHeard(expected, heard)).toEqual({
      kind: "other",
      letters: "ءَنعَتَ",
    });
  });

  /*
   * A word removed from the audio leaves frames that support no sound, which
   * the summary says in its own words rather than leaving the row silent.
   * Measured on the bench's clips: رَبِّ cut out of al-Fatihah 1:2 decodes
   * back as nothing at all, where غَيرِ swapped for a word from the next
   * ayah decodes as that word's sounds.
   */
  it("says nothing was heard when nothing was", () => {
    expect(whatWasHeard(WORD, [])).toEqual({ kind: "nothing" });
  });
});
