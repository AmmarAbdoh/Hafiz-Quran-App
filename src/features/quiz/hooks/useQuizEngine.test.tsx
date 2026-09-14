// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { MushafVerse, VerseInfoRecord } from "@/domain/quran";
import type { QuizConfig } from "../model/types";
import { useQuizEngine } from "./useQuizEngine";

function makeVerse(
  surahNumber: number,
  ayah: number,
  page: number,
): MushafVerse {
  return {
    id: surahNumber * 100 + ayah,
    jozz: 30,
    page,
    sura_no: surahNumber,
    sura_name_en: `Surah ${surahNumber}`,
    sura_name_ar: `سورة ${surahNumber}`,
    line_start: ayah,
    line_end: ayah,
    aya_no: ayah,
    aya_text: `نص الآية رقم ${ayah} من السورة ${surahNumber}`,
    aya_text_emlaey: `نص الآية رقم ${ayah} من السورة ${surahNumber}`,
  };
}

const mushafData: MushafVerse[] = [
  ...Array.from({ length: 4 }, (_, index) => makeVerse(112, index + 1, 604)),
  ...Array.from({ length: 5 }, (_, index) => makeVerse(113, index + 1, 604)),
  ...Array.from({ length: 6 }, (_, index) => makeVerse(114, index + 1, 605)),
];
const verseInfoRecords: VerseInfoRecord[] = mushafData.map((verse) => ({
  id: verse.id,
  verse_number: verse.aya_no,
  verse_key: `${verse.sura_no}:${verse.aya_no}`,
  hizb_number: verse.page === 604 ? 59 : 60,
  rub_el_hizb_number: 236,
  ruku_number: 555,
  manzil_number: 7,
  sajdah_number: null,
  page_number: verse.page,
  juz_number: 30,
}));

const baseConfig: QuizConfig = {
  scope: { mode: "surah", surahIndices: [112, 113, 114] },
  questionTypes: ["ayah_number", "surah_name", "page_number"],
  sessionMode: "fixed",
  questionCount: 5,
};

function renderEngine() {
  return renderHook(() => useQuizEngine(mushafData, verseInfoRecords));
}

beforeEach(() => {
  localStorage.clear();
});

describe("useQuizEngine", () => {
  it("asks every verse once before repeating any of them", () => {
    const { result } = renderEngine();
    act(() => {
      result.current.startQuiz({ ...baseConfig, questionCount: 15 });
    });

    const asked: string[] = [];
    for (let index = 0; index < 15; index += 1) {
      const question = result.current.currentQuestion;
      expect(question).not.toBeNull();
      asked.push(question!.verseKey);
      act(() => {
        result.current.submitAnswer("nothing");
      });
      act(() => {
        result.current.goToNextQuestion();
      });
    }

    expect(new Set(asked).size).toBe(mushafData.length);
  });

  it("reviews a single missed ayah using options from the whole scope", () => {
    const { result } = renderEngine();
    act(() => {
      result.current.startQuiz({
        ...baseConfig,
        questionCount: 1,
        focusVerseKeys: ["113:3"],
      });
    });

    expect(result.current.error).toBeNull();
    expect(result.current.currentQuestion?.testedVerseKey).toBe("113:3");
    expect(result.current.phase).toBe("active");
  });

  it("refuses a scope with no verses and reports why", () => {
    const { result } = renderEngine();
    act(() => {
      result.current.startQuiz({
        ...baseConfig,
        scope: { mode: "surah", surahIndices: [2] },
      });
    });

    expect(result.current.phase).toBe("idle");
    expect(result.current.error).toBe("scopeEmpty");
  });

  it("keeps a session out of history until it is finished, then stores it", () => {
    const { result } = renderEngine();
    act(() => {
      result.current.startQuiz({ ...baseConfig, questionCount: 1 });
    });
    act(() => {
      result.current.submitAnswer("not-an-option");
    });
    act(() => {
      result.current.goToNextQuestion();
    });

    expect(result.current.phase).toBe("results");
    expect(result.current.sessionSummary?.questionCount).toBe(1);
    expect(result.current.sessionSummary?.answers).toHaveLength(1);
    expect(result.current.sessionSummary?.correctCount).toBe(0);
  });
});
