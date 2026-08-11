import { describe, expect, it } from "vitest";
import { snapshotQuizScope } from "./types";

describe("snapshotQuizScope", () => {
  it("copies selected surah and juz numbers", () => {
    const surahNumbers = [1, 2];
    const juzNumbers = [29, 30];

    const surah = snapshotQuizScope({
      mode: "surah",
      surahIndices: surahNumbers,
    });
    const juz = snapshotQuizScope({ mode: "juz", juzIndices: juzNumbers });

    expect(surah).toEqual({ mode: "surah", surahNumbers });
    expect(juz).toEqual({ mode: "juz", juzNumbers });
    if (surah.mode === "surah")
      expect(surah.surahNumbers).not.toBe(surahNumbers);
    if (juz.mode === "juz") expect(juz.juzNumbers).not.toBe(juzNumbers);
  });

  it("uses empty selections when optional selection arrays are absent", () => {
    expect(snapshotQuizScope({ mode: "surah" })).toEqual({
      mode: "surah",
      surahNumbers: [],
    });
    expect(snapshotQuizScope({ mode: "juz" })).toEqual({
      mode: "juz",
      juzNumbers: [],
    });
  });

  it("preserves page ranges and defaults missing bounds", () => {
    expect(snapshotQuizScope({ mode: "page", pageFrom: 3, pageTo: 5 })).toEqual(
      {
        mode: "page",
        from: 3,
        to: 5,
      },
    );
    expect(snapshotQuizScope({ mode: "page", pageFrom: 8 })).toEqual({
      mode: "page",
      from: 8,
      to: 8,
    });
    expect(snapshotQuizScope({ mode: "page" })).toEqual({
      mode: "page",
      from: 1,
      to: 1,
    });
  });

  it("preserves ayah ranges and supplies safe first-ayah defaults", () => {
    expect(
      snapshotQuizScope({
        mode: "ayah_range",
        ayahRangeSurah: 18,
        ayahFrom: 10,
        ayahTo: 20,
      }),
    ).toEqual({
      mode: "ayah_range",
      surahNumber: 18,
      from: 10,
      to: 20,
    });
    expect(snapshotQuizScope({ mode: "ayah_range", ayahFrom: 4 })).toEqual({
      mode: "ayah_range",
      surahNumber: 1,
      from: 4,
      to: 4,
    });
    expect(snapshotQuizScope({ mode: "ayah_range" })).toEqual({
      mode: "ayah_range",
      surahNumber: 1,
      from: 1,
      to: 1,
    });
  });
});
