import { afterEach, describe, expect, it, vi } from "vitest";
import { buildSessionSummary } from "./quizSession";

describe("buildSessionSummary", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("stores semantic scope data instead of a localized label", () => {
    const summary = buildSessionSummary({
      scope: { mode: "page", pageFrom: 3, pageTo: 5 },
      sessionMode: "fixed",
      answers: [
        { questionType: "ayah_number", isCorrect: true },
        { questionType: "ayah_number", isCorrect: false },
      ],
      startedAt: 1_000,
      completedAt: 4_000,
      id: "session",
    });

    expect(summary.schemaVersion).toBe(2);
    expect(summary.scope).toEqual({ mode: "page", from: 3, to: 5 });
    expect(summary).not.toHaveProperty("scopeSummary");
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
