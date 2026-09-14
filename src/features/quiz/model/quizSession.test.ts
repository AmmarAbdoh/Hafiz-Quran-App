import { afterEach, describe, expect, it, vi } from "vitest";
import { buildSessionSummary, collectWeakVerses } from "./quizSession";

describe("buildSessionSummary", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("stores semantic scope data instead of a localized label", () => {
    const summary = buildSessionSummary({
      scope: { mode: "page", pageFrom: 3, pageTo: 5 },
      sessionMode: "fixed",
      answers: [
        {
          questionType: "ayah_number",
          testedVerseKey: "112:1",
          isCorrect: true,
        },
        {
          questionType: "ayah_number",
          testedVerseKey: "112:2",
          isCorrect: false,
        },
      ],
      startedAt: 1_000,
      completedAt: 4_000,
      id: "session",
    });

    expect(summary.schemaVersion).toBe(3);
    expect(summary.scope).toEqual({ mode: "page", from: 3, to: 5 });
    expect(summary).not.toHaveProperty("scopeSummary");
    expect(summary.answers).toEqual([
      { questionType: "ayah_number", verseKey: "112:1", isCorrect: true },
      { questionType: "ayah_number", verseKey: "112:2", isCorrect: false },
    ]);
    expect(summary.accuracyByType.ayah_number).toEqual({
      correct: 1,
      total: 2,
    });
    expect(summary.durationMs).toBe(3_000);
  });

  it("generates identifiers and clamps clock skew to zero duration", () => {
    vi.spyOn(Date, "now").mockReturnValue(2_000);
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    const summary = buildSessionSummary({
      scope: { mode: "juz", juzIndices: [30] },
      sessionMode: "endless",
      answers: [
        { questionType: "surah_name", isCorrect: false },
        { questionType: "page_number", isCorrect: true },
      ],
      startedAt: 3_000,
    });

    expect(summary.id).toMatch(/^2000-/);
    expect(summary.durationMs).toBe(0);
    expect(summary.correctCount).toBe(1);
    expect(summary.accuracyByType).toEqual({
      surah_name: { correct: 0, total: 1 },
      page_number: { correct: 1, total: 1 },
    });
  });
});

describe("collectWeakVerses", () => {
  it("ranks the ayahs missed most often and ignores mastered ones", () => {
    const session = buildSessionSummary({
      scope: { mode: "surah", surahIndices: [111] },
      sessionMode: "fixed",
      answers: [
        {
          questionType: "fill_blank",
          testedVerseKey: "112:2",
          isCorrect: false,
        },
        {
          questionType: "ayah_number",
          testedVerseKey: "112:2",
          isCorrect: false,
        },
        {
          questionType: "fill_blank",
          testedVerseKey: "112:3",
          isCorrect: false,
        },
        {
          questionType: "fill_blank",
          testedVerseKey: "112:1",
          isCorrect: true,
        },
      ],
      startedAt: 0,
      completedAt: 1_000,
      id: "session",
    });

    expect(collectWeakVerses([session])).toEqual([
      { verseKey: "112:2", missed: 2, asked: 2 },
      { verseKey: "112:3", missed: 1, asked: 1 },
    ]);
  });
});
