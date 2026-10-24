import { describe, expect, it } from "vitest";
import {
  buildSpokenWords,
  groupWrittenWords,
  mushafPositions,
} from "./wordPhonemes";

/*
 * The real symbol table ships with the model and is not in the repository, so
 * these tests stand each character in for a unit. That keeps the lengths the
 * mapping reasons about proportional to the real ones, which is all it uses.
 */
const charactersOf = (...phonemes: string[]) => [...new Set(phonemes.join(""))];

describe("mapping written words onto the words that are actually spoken", () => {
  it("leaves an ayah alone when nothing runs together", () => {
    // Al-Fatihah 1:2: four written words, four sounds.
    const groups = groupWrittenWords(
      ["ٱلْحَمْدُ", "لِلَّهِ", "رَبِّ", "ٱلْعَـٰلَمِينَ"],
      ["ءَلحَمدُ", "لِللَااهِ", "رَببِ", "لعَاالَمِۦۦۦۦن"],
      charactersOf("ءَلحَمدُ", "لِللَااهِ", "رَببِ", "لعَاالَمِۦۦۦۦن"),
    );

    expect(groups).toEqual([1, 1, 1, 1]);
  });

  /*
   * The case that makes this module necessary. Al-Baqarah 2:5 writes three
   * words where recitation gives one unbroken sound, because the tanween of
   * هُدًۭى assimilates into what follows.
   */
  it("groups words that tajweed joins into one sound", () => {
    const groups = groupWrittenWords(
      ["هُدًۭى", "مِّن", "رَّبِّهِمْ", "وَأُو۟لَـٰٓئِكَ"],
      ["هُدَممممِررَببِهِم", "وَءُلَااااءِكَ"],
      charactersOf("هُدَممممِررَببِهِم", "وَءُلَااااءِكَ"),
    );

    expect(groups).toEqual([3, 1]);
  });

  it("gives up rather than guess when one word becomes several sounds", () => {
    // الم is one written word and two spoken ones; there is no split to find.
    expect(
      groupWrittenWords(
        ["الم"],
        ["ءَلِف", "لَااا"],
        charactersOf("ءَلِف", "لَااا"),
      ),
    ).toBeNull();
  });
});

describe("the units a recitation is followed by", () => {
  it("carries every page word a sound covers", () => {
    const spoken = buildSpokenWords(
      [
        { location: "2:5:3", text: "هُدًۭى" },
        { location: "2:5:4", text: "مِّن" },
        { location: "2:5:5", text: "رَّبِّهِمْ" },
      ],
      ["هُدَممممِررَببِهِم"],
      charactersOf("هُدَممممِررَببِهِم"),
    );

    expect(spoken).toHaveLength(1);
    expect(spoken[0]?.locations).toEqual(["2:5:3", "2:5:4", "2:5:5"]);
    expect(spoken[0]?.units.length).toBeGreaterThan(0);
  });

  /* Rather than pretend to know where inside الم the boundary lies. */
  it("keeps an unsplittable ayah as a single unit", () => {
    const spoken = buildSpokenWords(
      [{ location: "2:1:1", text: "الم" }],
      ["ءَلِف", "لَااا"],
      charactersOf("ءَلِف", "لَااا"),
    );

    expect(spoken).toHaveLength(1);
    expect(spoken[0]?.locations).toEqual(["2:1:1"]);
  });
});

/*
 * The dataset's text against quran.com's words for the same ayah, which is
 * where the page's word positions come from. They differ in exactly these
 * four ayat across the Quran, always by one word written as two.
 */
describe("placing the dataset's words on the mushaf's", () => {
  it("joins إِلْ يَاسِينَ into the one word the mushaf writes", () => {
    expect(
      mushafPositions(
        ["سَلَـٰمٌ", "عَلَىٰٓ", "إِلْ", "يَاسِينَ"],
        ["سَلَـٰمٌ", "عَلَىٰٓ", "إِلْ يَاسِينَ"],
      ),
    ).toEqual([1, 2, 3, 3]);
  });

  it("joins بَعْدَ مَا and leaves a later مَا alone", () => {
    const dataset =
      "وَكَذَٰلِكَ أَنزَلْنَـٰهُ حُكْمًا عَرَبِيًّۭا وَلَئِنِ ٱتَّبَعْتَ أَهْوَآءَهُم بَعْدَ مَا جَآءَكَ مِنَ ٱلْعِلْمِ مَا لَكَ مِنَ ٱللَّهِ مِن وَلِىٍّۢ وَلَا وَاقٍۢ".split(
        " ",
      );
    const mushaf = [
      "وَكَذَٰلِكَ",
      "أَنزَلْنَـٰهُ",
      "حُكْمًا",
      "عَرَبِيًّۭا ۚ",
      "وَلَئِنِ",
      "ٱتَّبَعْتَ",
      "أَهْوَآءَهُم",
      "بَعْدَ مَا",
      "جَآءَكَ",
      "مِنَ",
      "ٱلْعِلْمِ",
      "مَا",
      "لَكَ",
      "مِنَ",
      "ٱللَّهِ",
      "مِن",
      "وَلِىٍّۢ",
      "وَلَا",
      "وَاقٍۢ",
    ];

    expect(mushafPositions(dataset, mushaf)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
    ]);
  });

  it("numbers by position when the two agree", () => {
    expect(
      mushafPositions(
        ["قُلْ", "هُوَ", "ٱللَّهُ", "أَحَدٌ"],
        ["قُلْ", "هُوَ", "ٱللَّهُ", "أَحَدٌ"],
      ),
    ).toEqual([1, 2, 3, 4]);
  });
});
