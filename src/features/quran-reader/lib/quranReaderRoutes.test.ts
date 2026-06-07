import { describe, expect, it } from "vitest";
import {
  buildCanonicalReaderPath,
  buildQuranAyahPath,
  buildQuranReaderPath,
  buildQuranSurahPath,
  clampPage,
  getQuranRouteContext,
  isAyahRoute,
  isLegacyAyahRoute,
  isPageLayoutRoute,
  isQuranReaderPath,
  legacyQuranPathRedirect,
  parseExplicitAyahPath,
  resolveLayoutMode,
  resolveReaderPage,
  resolveReaderSurahNumber,
} from "@/features/quran-reader/lib/quranReaderRoutes";
import type { MushafVerse } from "@/shared/types/quran";

const sampleVerses = [
  {
    id: 1,
    sura_no: 1,
    aya_no: 1,
    page: 1,
    line_start: 3,
    line_end: 3,
    sura_name_ar: "الفَاتِحة",
    jozz: 1,
    sura_name_en: "Al-Fatiha",
    aya_text: "",
    aya_text_emlaey: "",
  },
  {
    id: 2,
    sura_no: 1,
    aya_no: 7,
    page: 1,
    line_start: 8,
    line_end: 8,
    sura_name_ar: "الفَاتِحة",
    jozz: 1,
    sura_name_en: "Al-Fatiha",
    aya_text: "",
    aya_text_emlaey: "",
  },
  {
    id: 3,
    sura_no: 2,
    aya_no: 1,
    page: 2,
    line_start: 1,
    line_end: 1,
    sura_name_ar: "البَقَرَة",
    jozz: 1,
    sura_name_en: "Al-Baqara",
    aya_text: "",
    aya_text_emlaey: "",
  },
  {
    id: 4,
    sura_no: 2,
    aya_no: 255,
    page: 42,
    line_start: 8,
    line_end: 10,
    sura_name_ar: "البَقَرَة",
    jozz: 3,
    sura_name_en: "Al-Baqara",
    aya_text: "",
    aya_text_emlaey: "",
  },
] satisfies MushafVerse[];

describe("quranReaderRoutes", () => {
  it("builds numeric shareable paths", () => {
    expect(buildQuranReaderPath(42, 2)).toBe("/quran/42/2");
    expect(buildQuranSurahPath(2)).toBe("/quran/2");
    expect(buildQuranAyahPath(2, 255)).toBe("/quran/surah/2/ayah/255");
    expect(buildQuranAyahPath(1, 7)).toBe("/quran/surah/1/ayah/7");
  });

  it("detects quran reader routes", () => {
    expect(isQuranReaderPath("/quran")).toBe(true);
    expect(isQuranReaderPath("/quran/5")).toBe(true);
    expect(isQuranReaderPath("/quran/5/2")).toBe(true);
    expect(isQuranReaderPath("/quran/surah/2/ayah/7")).toBe(true);
    expect(isQuranReaderPath("/quiz")).toBe(false);
  });

  it("detects layout from params", () => {
    expect(resolveLayoutMode({ first: "2" })).toBe("surah");
    expect(resolveLayoutMode({ first: "42", second: "2" })).toBe("page");
    expect(resolveLayoutMode({ first: "2", second: "255" })).toBe("surah");
    expect(
      resolveLayoutMode(
        { surahNumber: "1", ayahNumber: "7" },
        "/quran/surah/1/ayah/7",
      ),
    ).toBe("surah");
    expect(isPageLayoutRoute("42", "2")).toBe(true);
    expect(isPageLayoutRoute("2", "255")).toBe(false);
    expect(isPageLayoutRoute("1", "7")).toBe(true);
  });

  it("parses explicit ayah routes for any ayah number", () => {
    expect(parseExplicitAyahPath("/quran/surah/1/ayah/7")).toEqual({
      surah: 1,
      ayah: 7,
    });
    expect(getQuranRouteContext("/quran/surah/1/ayah/7", {})).toEqual({
      type: "ayah",
      surah: 1,
      ayah: 7,
    });
  });

  it("detects legacy ayah routes only when ayah exceeds 114", () => {
    expect(isLegacyAyahRoute("2", "255")).toBe(true);
    expect(isLegacyAyahRoute("42", "2")).toBe(false);
    expect(isLegacyAyahRoute("1", "7")).toBe(false);
    expect(isAyahRoute("2", "255")).toBe(true);
  });

  it("resolves page and surah from numeric params", () => {
    expect(clampPage(999, 604)).toBe(604);
    expect(resolveReaderPage({ first: "42", second: "2" }, sampleVerses, 604)).toBe(
      42,
    );
    expect(
      resolveReaderPage(
        { surahNumber: "2", ayahNumber: "255" },
        sampleVerses,
        604,
        "/quran/surah/2/ayah/255",
      ),
    ).toBe(42);
    expect(
      resolveReaderPage(
        { surahNumber: "1", ayahNumber: "7" },
        sampleVerses,
        604,
        "/quran/surah/1/ayah/7",
      ),
    ).toBe(1);
    expect(resolveReaderPage({ first: "2", second: "255" }, sampleVerses, 604)).toBe(
      42,
    );
    expect(resolveReaderPage({ first: "2" }, sampleVerses, 604)).toBe(2);
    expect(resolveReaderSurahNumber({ first: "2" }, sampleVerses, 2)).toBe(2);
    expect(resolveReaderSurahNumber({ first: "42", second: "2" }, sampleVerses, 42)).toBe(
      2,
    );
    expect(
      resolveReaderSurahNumber(
        { surahNumber: "1", ayahNumber: "7" },
        sampleVerses,
        1,
        "/quran/surah/1/ayah/7",
      ),
    ).toBe(1);
  });

  it("builds canonical paths", () => {
    expect(
      buildCanonicalReaderPath({ first: "2" }, sampleVerses, 604),
    ).toBe("/quran/2");
    expect(
      buildCanonicalReaderPath({ first: "42", second: "2" }, sampleVerses, 604),
    ).toBe("/quran/42/2");
    expect(
      buildCanonicalReaderPath(
        { surahNumber: "2", ayahNumber: "255" },
        sampleVerses,
        604,
        "/quran/surah/2/ayah/255",
      ),
    ).toBe("/quran/surah/2/ayah/255");
    expect(
      buildCanonicalReaderPath(
        { surahNumber: "1", ayahNumber: "7" },
        sampleVerses,
        604,
        "/quran/surah/1/ayah/7",
      ),
    ).toBe("/quran/surah/1/ayah/7");
  });

  it("redirects legacy verbose paths", () => {
    expect(legacyQuranPathRedirect("/quran/page/42/surah/2")).toBe("/quran/42/2");
    expect(legacyQuranPathRedirect("/quran/surah/2/ayah/255")).toBe(null);
    expect(legacyQuranPathRedirect("/quran/surah/2")).toBe("/quran/2");
    expect(legacyQuranPathRedirect("/quran/scroll/42")).toBe("/quran/42/1");
  });
});
