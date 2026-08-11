import { afterEach, describe, expect, it, vi } from "vitest";
import type { MushafVerse } from "@/domain/quran";
import {
  checkQuizAnswer,
  generateQuizQuestion,
  getCorrectChoiceId,
} from "./questionGenerator";

const verse: MushafVerse = {
  id: 10,
  jozz: 1,
  page: 1,
  sura_no: 1,
  sura_name_en: "Al-Fatihah",
  sura_name_ar: "الفاتحة",
  line_start: 1,
  line_end: 1,
  aya_no: 1,
  aya_text: "بسم الله الرحمن الرحيم",
  aya_text_emlaey: "بسم الله الرحمن الرحيم",
};
const duplicateVerse: MushafVerse = { ...verse, id: 99, aya_no: 99 };
const pool = [verse, duplicateVerse];

afterEach(() => {
  vi.restoreAllMocks();
});

describe("question generation", () => {
  it("generates each question family through the public dispatcher", () => {
    for (const questionType of [
      "fill_blank",
      "complete_ayah",
      "audio_identify",
      "surah_name",
      "ayah_number",
      "juz_number",
      "hizb_number",
      "page_number",
    ] as const) {
      const question = generateQuizQuestion({
        verse,
        questionType,
        pool,
        mushafData: pool,
        verseInfoRecords: [],
      });
      expect(question.type).toBe(questionType);
    }
  });

  it("accepts a duplicate normalized fill-blank verse", () => {
    const question = generateQuizQuestion({
      verse,
      questionType: "fill_blank",
      pool,
      mushafData: pool,
      verseInfoRecords: [],
    });
    expect(question.type).toBe("fill_blank");
    expect(checkQuizAnswer(question, "1:99", pool)).toBe(true);
  });

  it("rejects a missing or differently worded fill-blank selection", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.75);
    const differentVerse = {
      ...duplicateVerse,
      id: 100,
      aya_no: 100,
      aya_text_emlaey: "different words",
    };
    const question = generateQuizQuestion({
      verse,
      questionType: "fill_blank",
      pool: [...pool, differentVerse],
      mushafData: [...pool, differentVerse],
      verseInfoRecords: [],
    });
    expect(question.type).toBe("fill_blank");
    expect(checkQuizAnswer(question, "99:99", pool)).toBe(false);
    expect(checkQuizAnswer(question, "1:100", [...pool, differentVerse])).toBe(
      false,
    );
  });

  it("compares ordinary choice questions directly", () => {
    const question = generateQuizQuestion({
      verse,
      questionType: "ayah_number",
      pool,
      mushafData: pool,
      verseInfoRecords: [],
    });

    expect(getCorrectChoiceId(question)).toBe("1");
    expect(checkQuizAnswer(question, "1", pool)).toBe(true);
    expect(checkQuizAnswer(question, "2", pool)).toBe(false);
  });

  it("returns the hidden verse key for a fill-blank question", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const question = generateQuizQuestion({
      verse,
      questionType: "fill_blank",
      pool,
      mushafData: pool,
      verseInfoRecords: [],
    });
    expect(question.type).toBe("fill_blank");
    if (question.type !== "fill_blank") return;
    expect(getCorrectChoiceId(question)).toBe(question.hiddenVerseKey);
    expect(checkQuizAnswer(question, question.hiddenVerseKey, pool)).toBe(true);
  });

  it("uses a surah prompt when audio has no next ayah", () => {
    const question = generateQuizQuestion({
      verse: duplicateVerse,
      questionType: "audio_identify",
      pool,
      mushafData: pool,
      verseInfoRecords: [],
    });
    expect(question.type).toBe("audio_identify");
    if (question.type === "audio_identify") {
      expect(question.audioPrompt).toBe("surah");
      expect(question.correctChoiceId).toBe("1");
      expect(question.choices).toHaveLength(4);
    }
  });
});
