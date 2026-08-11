import { afterEach, describe, expect, it, vi } from "vitest";
import type { MushafVerse } from "@/domain/quran";
import type { QuizScope } from "./types";
import {
  buildVersePool,
  getAdjacentVersesInSurah,
  parseVerseKey,
  shuffleArray,
  toVerseKey,
} from "./versePool";

const sampleVerses: MushafVerse[] = [
  {
    id: 1,
    jozz: 1,
    page: 1,
    sura_no: 1,
    sura_name_en: "Al-Fatihah",
    sura_name_ar: "الفاتحة",
    line_start: 1,
    line_end: 1,
    aya_no: 1,
    aya_text: "بسم",
    aya_text_emlaey: "بسم",
  },
  {
    id: 2,
    jozz: 1,
    page: 2,
    sura_no: 2,
    sura_name_en: "Al-Baqarah",
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
    sura_name_en: "Al-Baqarah",
    sura_name_ar: "البقرة",
    line_start: 1,
    line_end: 1,
    aya_no: 2,
    aya_text: "ذلك",
    aya_text_emlaey: "ذلك",
  },
];

describe("buildVersePool", () => {
  it.each<[QuizScope, number]>([
    [{ mode: "surah", surahIndices: [1] }, 1],
    [{ mode: "page", pageFrom: 2, pageTo: 2 }, 2],
    [
      {
        mode: "ayah_range",
        ayahRangeSurah: 2,
        ayahFrom: 1,
        ayahTo: 1,
      },
      1,
    ],
  ])("filters semantic scope %#", (scope, expectedCount) => {
    expect(buildVersePool(sampleVerses, scope)).toHaveLength(expectedCount);
  });

  it("filters a juz selection", () => {
    expect(
      buildVersePool(sampleVerses, { mode: "juz", juzIndices: [1] }),
    ).toEqual(sampleVerses);
    expect(buildVersePool(sampleVerses, { mode: "juz" })).toEqual([]);
  });

  it("uses safe defaults for missing page and ayah-range bounds", () => {
    expect(buildVersePool(sampleVerses, { mode: "page" })).toEqual([
      sampleVerses[0],
    ]);
    expect(buildVersePool(sampleVerses, { mode: "page", pageFrom: 2 })).toEqual(
      sampleVerses.slice(1),
    );
    expect(buildVersePool(sampleVerses, { mode: "ayah_range" })).toEqual([
      sampleVerses[0],
    ]);
    expect(
      buildVersePool(sampleVerses, {
        mode: "ayah_range",
        ayahRangeSurah: 2,
        ayahFrom: 2,
      }),
    ).toEqual([sampleVerses[2]]);
  });

  it("uses an empty selection when surah indices are absent", () => {
    expect(buildVersePool(sampleVerses, { mode: "surah" })).toEqual([]);
  });

  it("preserves verse keys for the selected range", () => {
    const pool = buildVersePool(sampleVerses, {
      mode: "ayah_range",
      ayahRangeSurah: 2,
      ayahFrom: 1,
      ayahTo: 1,
    });
    expect(toVerseKey(pool[0]!)).toBe("2:1");
  });
});

describe("verse key helpers", () => {
  it("parses complete and partial verse keys predictably", () => {
    expect(parseVerseKey("2:255")).toEqual({ surah: 2, ayah: 255 });
    expect(parseVerseKey("18")).toEqual({ surah: 18, ayah: 0 });
    const invalid = parseVerseKey(":");
    expect(Number.isNaN(invalid.surah)).toBe(true);
    expect(Number.isNaN(invalid.ayah)).toBe(true);
  });

  it("finds only adjacent verses that remain inside the selected pool", () => {
    const current = sampleVerses[1]!;
    expect(
      getAdjacentVersesInSurah(sampleVerses, sampleVerses, current),
    ).toEqual({ previous: null, next: sampleVerses[2] });
    expect(getAdjacentVersesInSurah([current], sampleVerses, current)).toEqual({
      previous: null,
      next: null,
    });
  });

  it("returns no neighbors when the verse is absent from mushaf data", () => {
    const missing = { ...sampleVerses[1]!, aya_no: 99 };
    expect(
      getAdjacentVersesInSurah(sampleVerses, sampleVerses, missing),
    ).toEqual({
      previous: null,
      next: null,
    });
  });
});

describe("shuffleArray", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a shuffled copy without mutating its input", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const input = [1, 2, 3];

    expect(shuffleArray(input)).toEqual([2, 3, 1]);
    expect(input).toEqual([1, 2, 3]);
  });

  it("handles an empty collection", () => {
    expect(shuffleArray([])).toEqual([]);
  });
});
