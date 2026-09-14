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
