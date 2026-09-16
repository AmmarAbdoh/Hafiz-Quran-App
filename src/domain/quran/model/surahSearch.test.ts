import { describe, expect, it } from "vitest";
import { findSurahsByName, searchSurahNumbers } from "./surahSearch";

describe("surah name search", () => {
  it.each([
    ["البقرة", 2],
    ["بقره", 2],
    ["Al-Baqarah", 2],
    ["baqarah", 2],
    ["maidah", 5],
    ["rahman", 55],
    ["nas", 114],
    ["saff", 61],
  ])("finds %s", (query, surah) => {
    expect(findSurahsByName(query)[0]).toBe(surah);
  });

  it("finds nothing for a name no surah has", () => {
    expect(findSurahsByName("zzzz")).toHaveLength(0);
  });
});

describe("filtering a surah list", () => {
  /*
   * Two of the reader's three surah lists filtered with a plain lowercase
   * includes. That serves an English reader typing "baqarah" and fails an
   * Arabic one typing "بقره", because the stored name is "البقرة" - a
   * different alef, a ta marbuta and an article away.
   */
  it("matches an Arabic name typed without its article or ta marbuta", () => {
    expect(searchSurahNumbers("بقره")).toContain(2);
  });

  it("matches a transliterated name from either language's list", () => {
    expect(searchSurahNumbers("Fatihah")).toContain(1);
  });

  it("matches by surah number as well as by name", () => {
    expect(searchSurahNumbers("11")).toEqual([11, 110, 111, 112, 113, 114]);
  });

  it("reads Arabic-indic digits as numbers", () => {
    expect(searchSurahNumbers("١١٤")).toEqual([114]);
  });

  /*
   * Null rather than every number: the lists show themselves whole, and a
   * caller that had to compare against all 114 would sort them pointlessly.
   */
  it("does not filter an empty query", () => {
    expect(searchSurahNumbers("")).toBeNull();
    expect(searchSurahNumbers("   ")).toBeNull();
  });
});
