import { describe, expect, it } from "vitest";
import type { MushafVerse } from "@/domain/quran";
import { validateScope } from "./scopeValidation";

const surah: MushafVerse[] = Array.from({ length: 4 }, (_, index) => ({
  id: 6000 + index,
  jozz: 30,
  page: 604,
  sura_no: 112,
  sura_name_en: "Al-Ikhlas",
  sura_name_ar: "الإخلاص",
  line_start: index + 1,
  line_end: index + 1,
  aya_no: index + 1,
  aya_text: "نص",
  aya_text_emlaey: "نص",
}));

describe("validateScope", () => {
  it("requires at least one surah or juz", () => {
    expect(validateScope({ mode: "surah", surahIndices: [] }, surah)).toBe(
      "pickSurah",
    );
    expect(
      validateScope({ mode: "surah", surahIndices: [1] }, surah),
    ).toBeNull();
    expect(validateScope({ mode: "juz", juzIndices: [] }, surah)).toBe(
      "pickJuz",
    );
    expect(validateScope({ mode: "juz", juzIndices: [30] }, surah)).toBeNull();
  });

  it("rejects page ranges that are reversed, empty, or off the mushaf", () => {
    expect(validateScope({ mode: "page", pageFrom: 5, pageTo: 3 }, surah)).toBe(
      "invalidPageRange",
    );
    expect(validateScope({ mode: "page", pageFrom: 1 }, surah)).toBe(
      "invalidPageRange",
    );
    expect(
      validateScope({ mode: "page", pageFrom: 600, pageTo: 700 }, surah),
    ).toBe("invalidPageRange");
    expect(
      validateScope({ mode: "page", pageFrom: 3, pageTo: 5 }, surah),
    ).toBeNull();
  });

  it("keeps an ayah range inside the chosen surah", () => {
    expect(
      validateScope(
        { mode: "ayah_range", ayahRangeSurah: 112, ayahFrom: 1, ayahTo: 9 },
        surah,
      ),
    ).toBe("invalidAyahRange");
    expect(
      validateScope(
        { mode: "ayah_range", ayahRangeSurah: 112, ayahFrom: 1, ayahTo: 4 },
        surah,
      ),
    ).toBeNull();
    expect(
      validateScope(
        { mode: "ayah_range", ayahRangeSurah: 200, ayahFrom: 1, ayahTo: 2 },
        surah,
      ),
    ).toBe("invalidAyahRange");
  });
});
