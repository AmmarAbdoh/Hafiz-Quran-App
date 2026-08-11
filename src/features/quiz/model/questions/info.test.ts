import { afterEach, describe, expect, it, vi } from "vitest";
import type { MushafVerse, VerseInfoRecord } from "@/domain/quran";
import type { InfoQuizQuestion } from "../types";
import { generateInfoQuestion } from "./info";

const verse: MushafVerse = {
  id: 10,
  jozz: 3,
  page: 42,
  sura_no: 2,
  sura_name_en: "Al-Baqarah",
  sura_name_ar: "Al-Baqarah Arabic",
  line_start: 1,
  line_end: 1,
  aya_no: 7,
  aya_text: "verse text",
  aya_text_emlaey: "verse text",
};

const record: VerseInfoRecord = {
  id: verse.id,
  verse_number: 17,
  verse_key: "2:17",
  hizb_number: 5,
  rub_el_hizb_number: 1,
  ruku_number: 1,
  manzil_number: 1,
  sajdah_number: null,
  page_number: 55,
  juz_number: 4,
};

const pool: MushafVerse[] = [
  verse,
  { ...verse, id: 11, sura_no: 1, aya_no: 1 },
  { ...verse, id: 12, sura_no: 3, aya_no: 1 },
];

afterEach(() => {
  vi.restoreAllMocks();
});

function generate(type: InfoQuizQuestion["type"], records = [record]) {
  vi.spyOn(Math, "random").mockReturnValue(0.99);
  return generateInfoQuestion(verse, pool, records, type);
}

describe("generateInfoQuestion", () => {
  it.each([
    ["surah_name", "2"],
    ["ayah_number", "17"],
    ["juz_number", "4"],
    ["hizb_number", "5"],
    ["page_number", "55"],
  ] as const)("builds four unique choices for %s", (type, expectedId) => {
    const question = generate(type);

    expect(question.correctChoiceId).toBe(expectedId);
    expect(question.choices).toHaveLength(4);
    expect(question.choices.some(({ id }) => id === expectedId)).toBe(true);
    expect(new Set(question.choices.map(({ id }) => id)).size).toBe(4);
    expect(question.verseKey).toBe("2:7");
  });

  it("falls back to verse metadata when an info record is unavailable", () => {
    expect(generate("ayah_number", []).correctChoiceId).toBe("7");
    expect(generate("juz_number", []).correctChoiceId).toBe("3");
    expect(generate("page_number", []).correctChoiceId).toBe("42");
    expect(generate("hizb_number", []).correctChoiceId).toBe("42");
  });

  it("falls back to the verse's Arabic surah label for an unknown number", () => {
    const unknownSurah = {
      ...verse,
      sura_no: 115,
      sura_name_ar: "Unknown surah label",
    };
    vi.spyOn(Math, "random").mockReturnValue(0.99);

    const question = generateInfoQuestion(
      unknownSurah,
      [unknownSurah],
      [],
      "surah_name",
    );
    expect(question.choices).toContainEqual({
      id: "115",
      label: "Unknown surah label",
    });
  });
});
