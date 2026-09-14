import { afterEach, describe, expect, it, vi } from "vitest";
import { SURAH_NAMES } from "@/domain/quran";
import type { MushafVerse, VerseInfoRecord } from "@/domain/quran";
import type { InfoQuizQuestion } from "../types";
import { generateInfoQuestion } from "./info";

function makeVerse(
  surahNumber: number,
  ayah: number,
  overrides: Partial<MushafVerse> = {},
): MushafVerse {
  return {
    id: surahNumber * 1000 + ayah,
    jozz: 3,
    page: 42,
    sura_no: surahNumber,
    sura_name_en: "Al-Baqarah",
    sura_name_ar: "Al-Baqarah Arabic",
    line_start: 1,
    line_end: 1,
    aya_no: ayah,
    aya_text: "نص الآية للاختبار",
    aya_text_emlaey: "نص الآية للاختبار",
    ...overrides,
  };
}

const verse = makeVerse(2, 7);
const mushafData: MushafVerse[] = [
  ...Array.from({ length: 10 }, (_, index) => makeVerse(2, index + 1)),
  makeVerse(1, 1),
  makeVerse(3, 1),
];
const pool: MushafVerse[] = [verse, makeVerse(1, 1), makeVerse(3, 1)];

const record: VerseInfoRecord = {
  id: verse.id,
  verse_number: 7,
  verse_key: "2:7",
  hizb_number: 5,
  rub_el_hizb_number: 1,
  ruku_number: 1,
  manzil_number: 1,
  sajdah_number: null,
  page_number: 55,
  juz_number: 4,
};

afterEach(() => {
  vi.restoreAllMocks();
});

const surahName = (surahNumber: number) =>
  SURAH_NAMES[surahNumber - 1] ?? String(surahNumber);

function generate(type: InfoQuizQuestion["type"], records = [record]) {
  return generateInfoQuestion({
    verse,
    pool,
    mushafData,
    records,
    type,
    surahName,
  });
}

describe("generateInfoQuestion", () => {
  it.each([
    ["surah_name", "2"],
    ["ayah_number", "7"],
    ["juz_number", "4"],
    ["hizb_number", "5"],
    ["page_number", "55"],
  ] as const)("builds four unique choices for %s", (type, expectedId) => {
    const question = generate(type);

    expect(question?.correctChoiceId).toBe(expectedId);
    expect(question?.choices).toHaveLength(4);
    expect(question?.choices.some(({ id }) => id === expectedId)).toBe(true);
    expect(new Set(question?.choices.map(({ id }) => id)).size).toBe(4);
    expect(question?.verseKey).toBe("2:7");
    expect(question?.testedVerseKey).toBe("2:7");
  });

  it("keeps numeric options near the answer instead of across the whole Quran", () => {
    const question = generate("page_number");
    const pages = (question?.choices ?? []).map(({ id }) =>
      Number.parseInt(id, 10),
    );

    expect(pages).toHaveLength(4);
    for (const page of pages) {
      expect(Math.abs(page - 55)).toBeLessThanOrEqual(13);
    }
  });

  it("never offers an ayah number the surah does not have", () => {
    const question = generate("ayah_number");
    const numbers = (question?.choices ?? []).map(({ id }) =>
      Number.parseInt(id, 10),
    );

    for (const number of numbers) {
      expect(number).toBeGreaterThanOrEqual(1);
      expect(number).toBeLessThanOrEqual(10);
    }
  });

  it("falls back to mushaf metadata when an info record is unavailable", () => {
    expect(generate("ayah_number", [])?.correctChoiceId).toBe("7");
    expect(generate("juz_number", [])?.correctChoiceId).toBe("3");
    expect(generate("page_number", [])?.correctChoiceId).toBe("42");
  });

  it("declines a hizb question instead of answering it with the page number", () => {
    expect(generate("hizb_number", [])).toBeNull();
  });

  it("labels surah choices with the names it is handed", () => {
    const unknownSurah = makeVerse(115, 1);

    const question = generateInfoQuestion({
      verse: unknownSurah,
      pool: [unknownSurah],
      mushafData: [unknownSurah],
      records: [],
      type: "surah_name",
      surahName: (number) => `Surah ${number}`,
    });
    expect(question?.choices).toContainEqual({
      id: "115",
      label: "Surah 115",
    });
  });
});
