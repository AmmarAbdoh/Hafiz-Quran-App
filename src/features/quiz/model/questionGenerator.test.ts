import { afterEach, describe, expect, it, vi } from "vitest";
import { SURAH_NAMES } from "@/domain/quran";
import type { MushafVerse, VerseInfoRecord } from "@/domain/quran";
import {
  checkQuizAnswer,
  generateQuizQuestion,
  getChoiceLabel,
  getCorrectChoiceId,
} from "./questionGenerator";

function makeVerse(
  ayah: number,
  text: string,
  overrides: Partial<MushafVerse> = {},
): MushafVerse {
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
    ...overrides,
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

afterEach(() => {
  vi.restoreAllMocks();
});

describe("question generation", () => {
  it("generates every question family for a workable scope", () => {
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
        verse: surah[0]!,
        questionType,
        pool: surah,
        mushafData: surah,
        verseInfoRecords: records,
        surahName,
        verseRef,
      });
      expect(question?.type).toBe(questionType);
    }
  });

  it("keeps ayah-number options inside the surah so elimination cannot win", () => {
    const question = generateQuizQuestion({
      verse: surah[1]!,
      questionType: "ayah_number",
      pool: surah,
      mushafData: surah,
      verseInfoRecords: records,
      surahName,
      verseRef,
    });

    expect(question?.type).toBe("ayah_number");
    if (question?.type !== "ayah_number") return;
    expect(question.choices).toHaveLength(4);
    for (const choice of question.choices) {
      expect(Number.parseInt(choice.id, 10)).toBeGreaterThanOrEqual(1);
      expect(Number.parseInt(choice.id, 10)).toBeLessThanOrEqual(4);
    }
    expect(getCorrectChoiceId(question)).toBe("2");
  });

  it("declines a hizb question when the verse has no info record", () => {
    const question = generateQuizQuestion({
      verse: surah[0]!,
      questionType: "hizb_number",
      pool: surah,
      mushafData: surah,
      verseInfoRecords: [],
      surahName,
      verseRef,
    });

    expect(question).toBeNull();
  });

  it("declines completing an ayah that is too short to split", () => {
    const shortVerse = makeVerse(5, "ألم", { id: 7000 });
    const question = generateQuizQuestion({
      verse: shortVerse,
      questionType: "complete_ayah",
      pool: [...surah, shortVerse],
      mushafData: [...surah, shortVerse],
      verseInfoRecords: records,
      surahName,
      verseRef,
    });

    expect(question).toBeNull();
  });

  it("never offers two options with the same text", () => {
    const twin = makeVerse(5, "ولم يكن له كفوا أحد", { id: 7001 });
    const question = generateQuizQuestion({
      verse: surah[0]!,
      questionType: "complete_ayah",
      pool: [...surah, twin],
      mushafData: [...surah, twin],
      verseInfoRecords: records,
      surahName,
      verseRef,
    });

    expect(question?.type).toBe("complete_ayah");
    if (question?.type !== "complete_ayah") return;
    const labels = question.choices.map((choice) => choice.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("credits a fill-blank answer whose text matches the hidden ayah", () => {
    const twin = makeVerse(9, "قل هو الله أحد سبحانه", {
      id: 7002,
      sura_no: 112,
    });
    const verses = [...surah, twin];
    // 0 keeps the anchor ayah itself hidden, so the twin repeats its text.
    vi.spyOn(Math, "random").mockReturnValue(0);
    const question = generateQuizQuestion({
      verse: surah[0]!,
      questionType: "fill_blank",
      pool: verses,
      mushafData: verses,
      verseInfoRecords: records,
      surahName,
      verseRef,
    });

    expect(question?.type).toBe("fill_blank");
    if (question?.type !== "fill_blank") return;
    expect(question.testedVerseKey).toBe(question.hiddenVerseKey);
    expect(getCorrectChoiceId(question)).toBe(question.hiddenVerseKey);
    expect(checkQuizAnswer(question, "112:9", verses)).toBe(true);
    expect(checkQuizAnswer(question, "112:3", verses)).toBe(false);
  });

  it("lets fill-blank search the whole surah, not only the quizzed scope", () => {
    const question = generateQuizQuestion({
      verse: surah[0]!,
      questionType: "fill_blank",
      pool: [surah[0]!, surah[1]!],
      mushafData: surah,
      verseInfoRecords: records,
      surahName,
      verseRef,
    });

    expect(question?.type).toBe("fill_blank");
    if (question?.type !== "fill_blank") return;
    expect(question.searchOptions).toHaveLength(surah.length);
  });

  it("names the chosen and correct options for review", () => {
    const question = generateQuizQuestion({
      verse: surah[0]!,
      questionType: "surah_name",
      pool: surah,
      mushafData: surah,
      verseInfoRecords: records,
      surahName,
      verseRef,
    });

    expect(question?.type).toBe("surah_name");
    if (question?.type !== "surah_name") return;
    expect(getChoiceLabel(question, "112")).toBe("الإخلاص");
    expect(checkQuizAnswer(question, "112", surah)).toBe(true);
    expect(checkQuizAnswer(question, "113", surah)).toBe(false);
  });

  it("falls back to a surah prompt when audio has no following ayah", () => {
    const question = generateQuizQuestion({
      verse: surah[3]!,
      questionType: "audio_identify",
      pool: surah,
      mushafData: surah,
      verseInfoRecords: records,
      surahName,
      verseRef,
    });

    expect(question?.type).toBe("audio_identify");
    if (question?.type !== "audio_identify") return;
    expect(question.audioPrompt).toBe("surah");
    expect(question.correctChoiceId).toBe("112");
    expect(question.choices).toHaveLength(4);
  });
});
