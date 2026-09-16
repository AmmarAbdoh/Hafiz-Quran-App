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

  /*
   * Answering fill-blank used to mean typing Arabic to filter as many as 286
   * whole-ayah options, while every other question type is a tap.
   */
  describe("fill-blank options", () => {
    // A long surah, so there is something to draw distractors from that is
    // not printed around the blank.
    const longSurah: MushafVerse[] = Array.from({ length: 20 }, (_, index) =>
      makeVerse(index + 1, `آية رقم ${index + 1} من هذه السورة`, {
        id: 8000 + index,
      }),
    );

    function build(pool: MushafVerse[], data: MushafVerse[]) {
      const question = generateQuizQuestion({
        verse: pool[Math.floor(pool.length / 2)]!,
        questionType: "fill_blank",
        pool,
        mushafData: data,
        verseInfoRecords: records,
        surahName,
        verseRef,
      });
      return question?.type === "fill_blank" ? question : null;
    }

    it("offers a few options to tap, with the answer among them", () => {
      const question = build(longSurah, longSurah);

      expect(question).not.toBeNull();
      expect(question!.choices).toHaveLength(4);
      expect(question!.choices.map((choice) => choice.id)).toContain(
        question!.hiddenVerseKey,
      );
    });

    it("keeps the whole surah reachable for searching", () => {
      const question = build(longSurah, longSurah);
      expect(question!.searchOptions).toHaveLength(longSurah.length);
    });

    /*
     * The ayahs printed around the blank are on the page. Offering them as
     * options offers answers the learner can rule out by looking rather than
     * by remembering.
     */
    it("does not offer an ayah that is visible around the blank", () => {
      // The anchor is the middle of the pool, so the page shows it and its two
      // neighbours; whichever of the three is blanked, the other two are read.
      const anchorAyah = longSurah[Math.floor(longSurah.length / 2)]!.aya_no;
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const question = build(longSurah, longSurah);
        const hidden = question!.hiddenVerseKey;
        const visible = new Set(
          [anchorAyah - 1, anchorAyah, anchorAyah + 1]
            .map((n) => `112:${n}`)
            .filter((key) => key !== hidden),
        );
        const distractors = question!.choices
          .map((choice) => choice.id)
          .filter((id) => id !== hidden);

        for (const id of distractors) {
          expect(visible.has(id), `${id} is printed beside the blank`).toBe(
            false,
          );
        }
      }
    });

    it("falls back to search alone when nothing can stand in", () => {
      // Two ayahs: whichever is hidden, the other one is printed beside it.
      const pair = [longSurah[0]!, longSurah[1]!];
      const question = build(pair, pair);
      expect(question!.choices).toHaveLength(0);
      expect(question!.searchOptions.length).toBeGreaterThan(0);
    });
  });

  /*
   * The mushaf text ends each ayah with its number as a single codepoint from
   * U+FC00 upward. Outside the Quran font those are Arabic ligatures - U+FC00
   * is BEH WITH JEEM - so an option carrying one read "جب" where the number
   * belonged, on a screen a memorizer sees ten times a session.
   */
  it("offers ayah continuations without the ayah-number ornament", () => {
    const marked = surah.map((verse, index) => ({
      ...verse,
      aya_text: `${verse.aya_text} ${String.fromCodePoint(0xfc00 + index)}`,
    }));

    const question = generateQuizQuestion({
      verse: marked[0]!,
      questionType: "complete_ayah",
      pool: marked,
      mushafData: marked,
      verseInfoRecords: records,
      surahName,
      verseRef,
    });

    expect(question?.type).toBe("complete_ayah");
    if (question?.type !== "complete_ayah") return;

    for (const choice of question.choices) {
      expect(
        /[ﰀ-ﴝ]/.test(choice.label),
        `option "${choice.label}" still carries a marker`,
      ).toBe(false);
    }
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
