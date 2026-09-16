import { describe, expect, it } from "vitest";
import {
  buildReviewTodayConfig,
  buildSurahConfig,
  buildWeakVersesConfig,
} from "./quizGoals";
import type { MushafVerse, VerseInfoRecord } from "@/domain/quran";

function makeVerse(
  surah: number,
  ayah: number,
  page: number,
  juz = 1,
): MushafVerse {
  return {
    id: surah * 1000 + ayah,
    jozz: juz,
    page,
    sura_no: surah,
    sura_name_en: `Surah ${surah}`,
    sura_name_ar: `سورة ${surah}`,
    line_start: 1,
    line_end: 1,
    aya_no: ayah,
    aya_text: `آية ${surah}:${ayah}`,
    aya_text_emlaey: `اية ${surah}:${ayah}`,
  };
}

const mushafData: MushafVerse[] = [
  makeVerse(1, 1, 1),
  makeVerse(1, 2, 1),
  makeVerse(2, 1, 2),
  makeVerse(2, 2, 2),
  makeVerse(2, 3, 3),
  makeVerse(3, 1, 4),
];

const verseInfoRecords: VerseInfoRecord[] = [];

describe("quiz goals", () => {
  /*
   * The engine has always taken a QuizConfig and nothing else. A goal is a
   * config, so none of the question generation changes - only what the learner
   * has to say to get one.
   */
  it("reviews the page that was last read", () => {
    const config = buildReviewTodayConfig(
      { layout: "page", page: 3, surah: 2 },
      mushafData,
      verseInfoRecords,
    );

    expect(config.scope).toEqual({ mode: "page", pageFrom: 3, pageTo: 3 });
    expect(config.sessionMode).toBe("fixed");
    expect(config.questionCount).toBe(10);
  });

  it("reviews the surah that was last read", () => {
    const config = buildReviewTodayConfig(
      { layout: "surah", page: 2, surah: 2 },
      mushafData,
      verseInfoRecords,
    );

    expect(config.scope).toEqual({ mode: "surah", surahIndices: [2] });
  });

  it("falls back to the opening surah before anything has been read", () => {
    const config = buildReviewTodayConfig(null, mushafData, verseInfoRecords);
    expect(config.scope).toEqual({ mode: "surah", surahIndices: [1] });
  });

  /*
   * A drill asks only about the missed ayahs, but its wrong options still come
   * from the scope, so the scope has to be every surah those ayahs fall in -
   * otherwise a miss in surah 3 is unaskable.
   */
  it("scopes a drill to every surah the missed ayahs fall in", () => {
    const config = buildWeakVersesConfig(
      [
        { verseKey: "2:2", missed: 3 },
        { verseKey: "3:1", missed: 1 },
        { verseKey: "2:1", missed: 1 },
      ],
      mushafData,
      verseInfoRecords,
    );

    expect(config?.scope).toEqual({ mode: "surah", surahIndices: [2, 3] });
    expect(config?.focusVerseKeys).toEqual(["2:2", "3:1", "2:1"]);
    // One question per missed ayah, so the drill ends when the work does.
    expect(config?.questionCount).toBe(3);
  });

  it("has no drill to offer when nothing has been missed", () => {
    expect(buildWeakVersesConfig([], mushafData, verseInfoRecords)).toBeNull();
  });

  it("ignores a stored key that is not a verse", () => {
    const config = buildWeakVersesConfig(
      [{ verseKey: "not-a-key", missed: 1 }],
      mushafData,
      verseInfoRecords,
    );
    expect(config).toBeNull();
  });

  it("tests a single chosen surah", () => {
    const config = buildSurahConfig(2, mushafData, verseInfoRecords);
    expect(config.scope).toEqual({ mode: "surah", surahIndices: [2] });
  });

  /*
   * No goal names a question type. A single surah cannot be asked which surah
   * an ayah is from - the answer is given away - and describeScopeCoverage
   * already knows that, so the goal states the scope and coverage decides.
   */
  it("never asks a question the scope gives away", () => {
    const config = buildSurahConfig(2, mushafData, verseInfoRecords);
    expect(config.questionTypes).not.toContain("surah_name");
    expect(config.questionTypes.length).toBeGreaterThan(0);
  });
});
