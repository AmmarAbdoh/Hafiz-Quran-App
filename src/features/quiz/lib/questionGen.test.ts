import { describe, expect, it } from "vitest";
import {
  checkQuizAnswer,
  generateQuizQuestion,
} from "@/features/quiz/lib/questionGen";
import type { MushafVerse } from "@/shared/types/quran";

const verse: MushafVerse = {
  id: 10,
  jozz: 1,
  page: 1,
  sura_no: 1,
  sura_name_en: "Al-Fatiha",
  sura_name_ar: "الفاتحة",
  line_start: 1,
  line_end: 1,
  aya_no: 1,
  aya_text: "بِسْمِ اللَّهِ",
  aya_text_emlaey: "بسم الله",
};

const duplicateVerse: MushafVerse = {
  ...verse,
  id: 99,
  aya_no: 99,
};

const pool = [verse, duplicateVerse];

describe("questionGen", () => {
  it("generates fill blank question scoped to pool", () => {
    const question = generateQuizQuestion({
      verse,
      questionType: "fill_blank",
      pool,
      mushafData: pool,
      verseInfoRecords: [],
    });

    expect(question.type).toBe("fill_blank");
    if (question.type === "fill_blank") {
      expect(question.searchOptions.length).toBe(pool.length);
    }
  });

  it("accepts duplicate imlaei answers by verse key equivalence", () => {
    const question = generateQuizQuestion({
      verse,
      questionType: "fill_blank",
      pool,
      mushafData: pool,
      verseInfoRecords: [],
    });

    if (question.type !== "fill_blank") {
      throw new Error("expected fill blank");
    }

    expect(checkQuizAnswer(question, "1:99", pool)).toBe(true);
  });

  it("falls back to surah prompt when verse has no next ayah", () => {
    // 1:99 is the last ayah in this sample surah
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
      expect(question.choices.length).toBe(4);
    }
  });

  it("uses ayah text snippets for next-ayah choices", () => {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const question = generateQuizQuestion({
        verse,
        questionType: "audio_identify",
        pool,
        mushafData: pool,
        verseInfoRecords: [],
      });

      if (
        question.type === "audio_identify" &&
        question.audioPrompt === "next_ayah"
      ) {
        const correct = question.choices.find(
          (choice) => choice.id === question.correctChoiceId,
        );
        expect(correct?.label).toBe("بسم الله");
        return;
      }
    }
    // 50/50 prompt selection over 30 attempts; failing to hit next_ayah is ~1e-9
    throw new Error("next_ayah prompt was never generated");
  });

  it("generates complete ayah choices", () => {
    const question = generateQuizQuestion({
      verse,
      questionType: "complete_ayah",
      pool,
      mushafData: pool,
      verseInfoRecords: [],
    });

    expect(question.type).toBe("complete_ayah");
    if (question.type === "complete_ayah") {
      expect(question.choices.length).toBeGreaterThan(0);
      expect(question.promptText.length).toBeGreaterThan(0);
    }
  });
});
