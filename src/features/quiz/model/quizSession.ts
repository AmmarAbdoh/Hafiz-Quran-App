import type { QuestionType, QuizScope } from "./types";
import { snapshotQuizScope, type QuizSessionSummaryV2 } from "./types";

export function buildSessionSummary(input: {
  scope: QuizScope;
  sessionMode: "fixed" | "endless";
  answers: Array<{ questionType: QuestionType; isCorrect: boolean }>;
  startedAt: number;
  completedAt?: number;
  id?: string;
}): QuizSessionSummaryV2 {
  const completedAt = input.completedAt ?? Date.now();
  const accuracyByType: QuizSessionSummaryV2["accuracyByType"] = {};

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

  return {
    schemaVersion: 2,
    id: input.id ?? `${completedAt}-${Math.random().toString(36).slice(2, 8)}`,
    completedAt: new Date(completedAt).toISOString(),
    scope: snapshotQuizScope(input.scope),
    sessionMode: input.sessionMode,
    questionCount: input.answers.length,
    correctCount: input.answers.filter((answer) => answer.isCorrect).length,
    accuracyByType,
    durationMs: Math.max(0, completedAt - input.startedAt),
  };
}
