import { describe, expect, it } from "vitest";
import { summarizeQuizProgress } from "./quizSession";
import type { QuizSessionSummaryV3 } from "./types";

const NOW = new Date("2026-09-15T20:00:00");

function daysBefore(days: number): string {
  const date = new Date(NOW);
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function makeSession(
  completedAt: string,
  overrides: Partial<QuizSessionSummaryV3> = {},
): QuizSessionSummaryV3 {
  return {
    schemaVersion: 3,
    id: completedAt,
    completedAt,
    scope: null,
    sessionMode: "fixed",
    questionCount: 10,
    correctCount: 8,
    accuracyByType: {},
    durationMs: 1000,
    answers: [],
    ...overrides,
  };
}

describe("summarizeQuizProgress", () => {
  it("reports nothing before the first session", () => {
    expect(summarizeQuizProgress([], NOW)).toEqual({
      sessions: 0,
      streakDays: 0,
      recentAccuracy: null,
      weakVerseCount: 0,
    });
  });

  it("counts consecutive days ending today", () => {
    const sessions = [0, 1, 2].map((day) => makeSession(daysBefore(day)));
    expect(summarizeQuizProgress(sessions, NOW).streakDays).toBe(3);
  });

  /*
   * A day that has not ended cannot break a streak. Someone who reviewed every
   * day for a week and has not opened the app yet today is on seven days, not
   * zero - and being told otherwise at breakfast is exactly how a streak stops
   * being worth keeping.
   */
  it("keeps the streak on a day with no session yet", () => {
    const sessions = [1, 2, 3].map((day) => makeSession(daysBefore(day)));
    expect(summarizeQuizProgress(sessions, NOW).streakDays).toBe(3);
  });

  it("ends the streak at the first missed day", () => {
    const sessions = [0, 1, 3, 4].map((day) => makeSession(daysBefore(day)));
    expect(summarizeQuizProgress(sessions, NOW).streakDays).toBe(2);
  });

  it("counts a day once however many sessions it holds", () => {
    const sessions = [
      makeSession(daysBefore(0)),
      makeSession(daysBefore(0)),
      makeSession(daysBefore(1)),
    ];
    expect(summarizeQuizProgress(sessions, NOW).streakDays).toBe(2);
  });

  it("drops a streak that ended before yesterday", () => {
    const sessions = [3, 4, 5].map((day) => makeSession(daysBefore(day)));
    expect(summarizeQuizProgress(sessions, NOW).streakDays).toBe(0);
  });

  it("averages accuracy over the five most recent sessions", () => {
    // Newest first, as the history is stored. The sixth is older and ignored.
    const sessions = [
      makeSession(daysBefore(0), { questionCount: 10, correctCount: 10 }),
      makeSession(daysBefore(1), { questionCount: 10, correctCount: 5 }),
      makeSession(daysBefore(2), { questionCount: 10, correctCount: 5 }),
      makeSession(daysBefore(3), { questionCount: 10, correctCount: 5 }),
      makeSession(daysBefore(4), { questionCount: 10, correctCount: 5 }),
      makeSession(daysBefore(5), { questionCount: 10, correctCount: 0 }),
    ];

    expect(summarizeQuizProgress(sessions, NOW).recentAccuracy).toBe(0.6);
  });

  it("counts every missed ayah, not just the ones a list would show", () => {
    const answers = Array.from({ length: 12 }, (_, index) => ({
      questionType: "complete_ayah" as const,
      verseKey: `2:${index + 1}`,
      isCorrect: false,
    }));

    const progress = summarizeQuizProgress(
      [makeSession(daysBefore(0), { answers })],
      NOW,
    );

    // collectWeakVerses defaults to the top eight for display; the count on the
    // home page has to be the whole backlog or it understates the work.
    expect(progress.weakVerseCount).toBe(12);
  });

  it("ignores a record whose date cannot be read", () => {
    const sessions = [makeSession("not a date"), makeSession(daysBefore(0))];
    expect(summarizeQuizProgress(sessions, NOW).streakDays).toBe(1);
  });
});
