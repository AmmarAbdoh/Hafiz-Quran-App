import { describe, expect, it } from "vitest";
import {
  buildAyahSearchIndex,
  matchSurahNames,
  parseAyahReference,
  searchAyahsByText,
} from "@/features/quran-reader/model/ayahTextSearch";
import type { MushafVerse } from "@/domain/quran";

function makeVerse(surah: number, ayah: number, text: string): MushafVerse {
  return {
    id: surah * 1000 + ayah,
    jozz: 1,
    page: 1,
    sura_no: surah,
    sura_name_en: "Test",
    sura_name_ar: "اختبار",
    line_start: 1,
    line_end: 1,
    aya_no: ayah,
    aya_text: text,
    aya_text_emlaey: text,
  };
}

describe("ayahTextSearch", () => {
  const index = buildAyahSearchIndex([
    makeVerse(1, 1, "بسم الله الرحمن الرحيم"),
    makeVerse(1, 2, "الحمد لله رب العالمين"),
    makeVerse(2, 255, "الله لا اله الا هو الحي القيوم"),
  ]);

  it("finds verses by partial imlaei text", () => {
    const results = searchAyahsByText(index, "الحمد لله");
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ surah: 1, ayah: 2 });
  });

  it("ignores diacritics and hamza variants", () => {
    const results = searchAyahsByText(index, "بسم الله");
    expect(results[0]).toMatchObject({ surah: 1, ayah: 1 });
  });

  it("requires at least two characters", () => {
    expect(searchAyahsByText(index, "ا")).toHaveLength(0);
  });

  it("deduplicates repeated mushaf rows", () => {
    const duplicateIndex = buildAyahSearchIndex([
      makeVerse(1, 1, "بسم الله الرحمن الرحيم"),
      makeVerse(1, 1, "بسم الله الرحمن الرحيم"),
    ]);
    expect(searchAyahsByText(duplicateIndex, "بسم")).toHaveLength(1);
  });

  /*
   * Both languages have always told the reader to "search by surah name", and
   * nothing matched one. An English reader had it worse still: the field was
   * locked to Arabic, so there was nothing they could type at all.
   */
  describe("surah names", () => {
    it.each([
      ["البقرة", 2, 1],
      ["بقره", 2, 1],
      ["Al-Baqarah", 2, 1],
      ["baqarah", 2, 1],
      ["al-fatihah", 1, 1],
      ["البقرة ٢٥٥", 2, 255],
      ["baqarah 255", 2, 255],
    ])("resolves %s", (query, surah, ayah) => {
      expect(matchSurahNames(query)[0]).toEqual({ surah, ayah });
    });

    it("matches an apostrophe name typed without one", () => {
      // "Al-Ma'idah" is surah 5; nobody types the apostrophe.
      expect(matchSurahNames("maidah")[0]).toEqual({ surah: 5, ayah: 1 });
    });

    it.each([
      // The article assimilates in these transliterations - An-Nas, Ar-Rahman -
      // so the bare name is not a prefix of them and has to match inside.
      ["rahman", 55],
      ["nas", 114],
      ["saff", 61],
    ])("matches %s despite the assimilated article", (query, surah) => {
      expect(matchSurahNames(query)[0]).toEqual({ surah, ayah: 1 });
    });

    it("puts the named surah above text matches without hiding them", () => {
      const namedIndex = buildAyahSearchIndex([
        makeVerse(24, 1, "سوره انزلناها وفرضناها"),
        // النور names surah 24 and is also an ordinary word of 2:257, so a
        // reader typing it could want either.
        makeVerse(2, 257, "يخرجهم من الظلمات الى النور"),
      ]);

      const results = searchAyahsByText(namedIndex, "النور");

      expect(results[0]).toMatchObject({ surah: 24, ayah: 1 });
      expect(results.map((result) => `${result.surah}:${result.ayah}`)).toEqual(
        ["24:1", "2:257"],
      );
    });

    it("leaves a query that names nothing to the text search", () => {
      expect(matchSurahNames("الحمد لله رب")).toHaveLength(0);
    });

    it("needs two characters, so a single letter does not list every surah", () => {
      expect(matchSurahNames("ا")).toHaveLength(0);
    });
  });

  it("reads a reference in either set of digits", () => {
    expect(parseAyahReference("٢:٢٥٥")).toEqual({ surah: 2, ayah: 255 });
    expect(parseAyahReference("2:255")).toEqual({ surah: 2, ayah: 255 });
  });
});
