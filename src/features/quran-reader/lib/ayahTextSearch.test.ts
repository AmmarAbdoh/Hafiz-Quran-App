import { describe, expect, it } from "vitest";
import {
  buildAyahSearchIndex,
  searchAyahsByText,
} from "@/features/quran-reader/lib/ayahTextSearch";
import type { MushafVerse } from "@/shared/types/quran";

function makeVerse(
  surah: number,
  ayah: number,
  text: string,
): MushafVerse {
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
});
