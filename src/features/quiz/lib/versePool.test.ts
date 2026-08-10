import { describe, expect, it } from "vitest";
import { buildVersePool, toVerseKey } from "@/features/quiz/lib/versePool";
import type { MushafVerse, QuizScope } from "@/shared/types/quran";

const sampleVerses: MushafVerse[] = [
  {
    id: 1,
    jozz: 1,
    page: 1,
    sura_no: 1,
    sura_name_en: "Al-Fatiha",
    sura_name_ar: "الفاتحة",
    line_start: 1,
    line_end: 1,
    aya_no: 1,
    aya_text: "بِسْمِ",
    aya_text_emlaey: "بسم",
  },
  {
    id: 2,
    jozz: 1,
    page: 2,
    sura_no: 2,
    sura_name_en: "Al-Baqara",
    sura_name_ar: "البقرة",
    line_start: 1,
    line_end: 1,
    aya_no: 1,
    aya_text: "الم",
    aya_text_emlaey: "الم",
  },
  {
    id: 3,
    jozz: 1,
    page: 2,
    sura_no: 2,
    sura_name_en: "Al-Baqara",
    sura_name_ar: "البقرة",
    line_start: 1,
    line_end: 1,
    aya_no: 2,
    aya_text: "ذلك",
    aya_text_emlaey: "ذلك",
  },
];

describe("versePool", () => {
  it("filters by surah scope", () => {
    const scope: QuizScope = { mode: "surah", surahIndices: [1] };
    expect(buildVersePool(sampleVerses, scope)).toHaveLength(1);
  });

  it("filters by page scope", () => {
    const scope: QuizScope = { mode: "page", pageFrom: 2, pageTo: 2 };
    expect(buildVersePool(sampleVerses, scope)).toHaveLength(2);
  });

  it("filters by ayah range", () => {
    const scope: QuizScope = {
      mode: "ayah_range",
      ayahRangeSurah: 2,
      ayahFrom: 1,
      ayahTo: 1,
    };
    const pool = buildVersePool(sampleVerses, scope);
    expect(pool).toHaveLength(1);
    expect(toVerseKey(pool[0]!)).toBe("2:1");
  });
});
