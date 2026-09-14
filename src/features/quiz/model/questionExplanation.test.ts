import { describe, expect, it } from "vitest";
import { SURAH_NAMES } from "@/domain/quran";
import type { MushafVerse, VerseInfoRecord } from "@/domain/quran";
import { buildAnswerExplanation } from "./questionExplanation";
import { generateQuizQuestion } from "./questionGenerator";
import type { QuestionType } from "./types";

function makeVerse(ayah: number, text: string): MushafVerse {
  return {
    id: 6000 + ayah,
    jozz: 30,
    page: 604,
    sura_no: 112,
    sura_name_en: "Al-Ikhlas",
    sura_name_ar: "الإخلاص",
    line_start: ayah,
    line_end: ayah,
    aya_no: ayah,
    aya_text: text,
    aya_text_emlaey: text,
  };
}

const surah: MushafVerse[] = [
  makeVerse(1, "قل هو الله أحد سبحانه"),
  makeVerse(2, "الله الصمد لا شريك له"),
  makeVerse(3, "لم يلد ولم يولد أبدا"),
  makeVerse(4, "ولم يكن له كفوا أحد"),
];
const records: VerseInfoRecord[] = surah.map((verse) => ({
  id: verse.id,
  verse_number: verse.aya_no,
  verse_key: `112:${verse.aya_no}`,
  hizb_number: 59,
  rub_el_hizb_number: 236,
  ruku_number: 555,
  manzil_number: 7,
  sajdah_number: null,
  page_number: 604,
  juz_number: 30,
}));

const surahName = (surahNumber: number) =>
  SURAH_NAMES[surahNumber - 1] ?? String(surahNumber);
const verseRef = (surahNumber: number, ayahNumber: number) =>
  `${surahName(surahNumber)} ${ayahNumber}`;

function explain(
  questionType: QuestionType,
  verseInfoRecords: VerseInfoRecord[],
  selectedChoiceId: string,
) {
  const question = generateQuizQuestion({
    verse: surah[1]!,
    questionType,
    pool: surah,
    mushafData: surah,
    verseInfoRecords,
    surahName,
    verseRef,
  });
  if (!question) return null;
  return buildAnswerExplanation({
    question,
    selectedChoiceId,
    mushafData: surah,
    verseInfoRecords,
    surahName,
  });
}

describe("buildAnswerExplanation", () => {
  it.each([
    ["fill_blank", "explanation.fillBlank"],
    ["complete_ayah", "explanation.completeAyah"],
    ["surah_name", "explanation.surahName"],
    ["ayah_number", "explanation.ayahNumber"],
    ["juz_number", "explanation.juzNumber"],
    ["hizb_number", "explanation.hizbNumber"],
    ["page_number", "explanation.pageNumber"],
  ] as const)("explains a %s answer", (questionType, detailKey) => {
    expect(explain(questionType, records, "1")?.detailKey).toBe(detailKey);
  });

  it("explains an audio answer by what it asked for", () => {
    const explanation = explain("audio_identify", records, "112");

    expect(["explanation.audioSurah", "explanation.audioNext"]).toContain(
      explanation?.detailKey,
    );
  });

  it("names both answers and the facts that settle the question", () => {
    const explanation = explain("ayah_number", records, "3");

    expect(explanation).toMatchObject({
      correctLabel: "2",
      selectedLabel: "3",
      verseKey: "112:2",
      surahNumber: 112,
      ayahNumber: 2,
      detailKey: "explanation.ayahNumber",
    });
    expect(explanation?.facts).toEqual({
      surah: "الإخلاص",
      ayah: 2,
      page: 604,
      juz: 30,
      totalAyahs: 4,
      hizb: 59,
    });
  });

  it("stays silent about the hizb when the metadata has not loaded", () => {
    const question = generateQuizQuestion({
      verse: surah[1]!,
      questionType: "ayah_number",
      pool: surah,
      mushafData: surah,
      verseInfoRecords: [],
      surahName,
      verseRef,
    });
    const explanation = buildAnswerExplanation({
      question: question!,
      selectedChoiceId: "2",
      mushafData: surah,
      verseInfoRecords: [],
      surahName,
    });

    expect(explanation.facts.hizb).toBeNull();
    expect(explanation.facts.page).toBe(604);
  });
});
