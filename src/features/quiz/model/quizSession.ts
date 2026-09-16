import type { QuestionType, QuizAnswerHistoryEntry, QuizScope } from "./types";
import { snapshotQuizScope, type QuizSessionSummaryV3 } from "./types";

interface SummaryAnswer {
  questionType: QuestionType;
  testedVerseKey?: string;
  verseKey?: string;
  isCorrect: boolean;
}

export function buildSessionSummary(input: {
  scope: QuizScope;
  sessionMode: "fixed" | "endless";
  answers: SummaryAnswer[];
  startedAt: number;
  completedAt?: number;
  id?: string;
  reviewOfMistakes?: boolean;
}): QuizSessionSummaryV3 {
  const completedAt = input.completedAt ?? Date.now();
  const accuracyByType: QuizSessionSummaryV3["accuracyByType"] = {};

  for (const answer of input.answers) {
    const current = accuracyByType[answer.questionType] ?? {
      correct: 0,
      total: 0,
    };
    accuracyByType[answer.questionType] = {
      correct: current.correct + (answer.isCorrect ? 1 : 0),
      total: current.total + 1,
    };
  }

  const answers: QuizAnswerHistoryEntry[] = input.answers.map((answer) => ({
    questionType: answer.questionType,
    verseKey: answer.testedVerseKey ?? answer.verseKey ?? "",
    isCorrect: answer.isCorrect,
  }));

  return {
    schemaVersion: 3,
    id: input.id ?? `${completedAt}-${Math.random().toString(36).slice(2, 8)}`,
    completedAt: new Date(completedAt).toISOString(),
    scope: snapshotQuizScope(input.scope),
    sessionMode: input.sessionMode,
    questionCount: input.answers.length,
    correctCount: input.answers.filter((answer) => answer.isCorrect).length,
    accuracyByType,
    durationMs: Math.max(0, completedAt - input.startedAt),
    answers,
    ...(input.reviewOfMistakes ? { reviewOfMistakes: true } : {}),
  };
}

/**
 * Ayahs that were missed most often across saved sessions, so the learner can
 * see what actually needs work instead of a single score.
 */
export function collectWeakVerses(
  sessions: readonly QuizSessionSummaryV3[],
  limit = 8,
): Array<{ verseKey: string; missed: number; asked: number }> {
  const stats = new Map<string, { missed: number; asked: number }>();
  for (const session of sessions) {
    for (const answer of session.answers) {
      if (answer.verseKey === "") continue;
      const current = stats.get(answer.verseKey) ?? { missed: 0, asked: 0 };
      stats.set(answer.verseKey, {
        missed: current.missed + (answer.isCorrect ? 0 : 1),
        asked: current.asked + 1,
      });
    }
  }

  return [...stats.entries()]
    .filter(([, value]) => value.missed > 0)
    .map(([verseKey, value]) => ({ verseKey, ...value }))
    .sort(
      (left, right) => right.missed - left.missed || right.asked - left.asked,
    )
    .slice(0, limit);
}

/** Sessions counted towards the accuracy shown on the home page. */
const RECENT_SESSION_COUNT = 5;

export interface QuizProgress {
  sessions: number;
  /** Consecutive days ending today, or yesterday if today has no session yet. */
  streakDays: number;
  /** Share correct over the most recent sessions; null before any were answered. */
  recentAccuracy: number | null;
  weakVerseCount: number;
}

function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/**
 * What a learner has to show for their reviews. Every part of this was already
 * being written to storage after each session and never read back, so the app
 * asked people to memorize and then told them nothing about how it was going.
 */
export function summarizeQuizProgress(
  sessions: readonly QuizSessionSummaryV3[],
  now: Date = new Date(),
): QuizProgress {
  const days = new Set<string>();
  for (const session of sessions) {
    const completed = new Date(session.completedAt);
    if (!Number.isNaN(completed.getTime())) days.add(localDayKey(completed));
  }

  /*
   * A day that has not ended cannot break a streak: someone who reviewed
   * daily for a week and has not yet opened the app today is still on seven
   * days, not zero. So counting starts at today when today has a session and
   * at yesterday when it does not.
   */
  const cursor = new Date(now);
  if (!days.has(localDayKey(cursor))) cursor.setDate(cursor.getDate() - 1);

  let streakDays = 0;
  while (days.has(localDayKey(cursor))) {
    streakDays += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  // Newest first, as saveQuizSession stores them.
  const recent = sessions.slice(0, RECENT_SESSION_COUNT);
  const asked = recent.reduce((total, s) => total + s.questionCount, 0);
  const correct = recent.reduce((total, s) => total + s.correctCount, 0);

  return {
    sessions: sessions.length,
    streakDays,
    recentAccuracy: asked > 0 ? correct / asked : null,
    weakVerseCount: collectWeakVerses(sessions, Number.MAX_SAFE_INTEGER).length,
  };
}
