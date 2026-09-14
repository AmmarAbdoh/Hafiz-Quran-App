import { describe, expect, it } from "vitest";
import type { MushafVerse, VerseInfoRecord } from "@/domain/quran";
import {
  describeScopeCoverage,
  getQuestionTypeAvailability,
} from "./scopeCoverage";

function makeVerse(overrides: Partial<MushafVerse>): MushafVerse {
  return {
    id: 1,
    jozz: 30,
    page: 604,
    sura_no: 112,
    sura_name_en: "Al-Ikhlas",
    sura_name_ar: "الإخلاص",
    line_start: 1,
    line_end: 1,
    aya_no: 1,
    aya_text: "نص",
    aya_text_emlaey: "نص",
    ...overrides,
  };
}

function makeRecord(id: number, hizb: number): VerseInfoRecord {
  return {
    id,
    verse_number: 1,
    verse_key: `112:${id}`,
    hizb_number: hizb,
    rub_el_hizb_number: 236,
    ruku_number: 555,
    manzil_number: 7,
    sajdah_number: null,
    page_number: 604,
    juz_number: 30,
  };
}

describe("describeScopeCoverage", () => {
  it("reports what the pool spans, deduplicated and sorted", () => {
    const pool = [
      makeVerse({ id: 1, sura_no: 112, jozz: 30, page: 604 }),
      makeVerse({ id: 2, sura_no: 113, jozz: 30, page: 604 }),
      makeVerse({ id: 3, sura_no: 114, jozz: 29, page: 603 }),
    ];

    expect(
      describeScopeCoverage(pool, [makeRecord(1, 60), makeRecord(2, 60)]),
    ).toEqual({
      ayahCount: 3,
      surahNumbers: [112, 113, 114],
      juzNumbers: [29, 30],
      hizbNumbers: [60],
      pageNumbers: [603, 604],
    });
  });

  it("leaves hizb numbers empty when the metadata has not loaded", () => {
    const coverage = describeScopeCoverage([makeVerse({ id: 1 })], []);

    expect(coverage.hizbNumbers).toEqual([]);
    expect(getQuestionTypeAvailability("hizb_number", coverage)).toEqual({
      available: false,
      reason: "noHizbData",
    });
  });
});
