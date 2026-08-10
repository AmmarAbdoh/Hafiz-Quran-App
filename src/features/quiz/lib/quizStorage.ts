import type { QuestionType } from "@/shared/types/quran";
import type { QuizSessionSummary } from "@/features/quiz/lib/quiz-types";

const STORAGE_KEY = "quiz-history";
const MAX_SESSIONS = 50;

export function loadQuizHistory(): QuizSessionSummary[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QuizSessionSummary[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveQuizSession(summary: QuizSessionSummary): QuizSessionSummary[] {
  const history = [summary, ...loadQuizHistory()].slice(0, MAX_SESSIONS);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  return history;
}

export function clearQuizHistory(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}

export function buildSessionSummary(input: {
  scopeSummary: string;
  sessionMode: "fixed" | "endless";
  answers: Array<{
    questionType: QuestionType;
    isCorrect: boolean;
  }>;
  startedAt: number;
}): QuizSessionSummary {
  const accuracyByType: QuizSessionSummary["accuracyByType"] = {};

  for (const answer of input.answers) {
    const current = accuracyByType[answer.questionType] ?? {
      correct: 0,
      total: 0,
    };
    current.total += 1;
    if (answer.isCorrect) current.correct += 1;
    accuracyByType[answer.questionType] = current;
  }

  const correctCount = input.answers.filter((answer) => answer.isCorrect).length;

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    completedAt: new Date().toISOString(),
    scopeSummary: input.scopeSummary,
    sessionMode: input.sessionMode,
    questionCount: input.answers.length,
    correctCount,
    accuracyByType,
    durationMs: Math.max(0, Date.now() - input.startedAt),
  };
}
