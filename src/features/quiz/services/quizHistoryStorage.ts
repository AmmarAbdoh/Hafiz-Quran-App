import { safeStorage, type SafeStorage } from "@/shared/storage";
import type {
  QuizAnswerHistoryEntry,
  QuizSessionSummaryV1,
  QuizSessionSummaryV2,
  QuizSessionSummaryV3,
} from "../model/types";

export const QUIZ_HISTORY_STORAGE_KEY = "quiz-history";
const MAX_SESSIONS = 50;
/** Keeps per-answer detail useful without letting one session dominate storage. */
const MAX_STORED_ANSWERS = 100;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSessionMode(value: unknown): value is "fixed" | "endless" {
  return value === "fixed" || value === "endless";
}

function hasSharedSessionFields(value: Record<string, unknown>): boolean {
  return (
    typeof value.id === "string" &&
    typeof value.completedAt === "string" &&
    isSessionMode(value.sessionMode) &&
    typeof value.questionCount === "number" &&
    typeof value.correctCount === "number" &&
    isObject(value.accuracyByType) &&
    typeof value.durationMs === "number"
  );
}

function isV1Session(value: unknown): value is QuizSessionSummaryV1 {
  return (
    isObject(value) &&
    typeof value.scopeSummary === "string" &&
    hasSharedSessionFields(value)
  );
}

function isV2Session(value: unknown): value is QuizSessionSummaryV2 {
  return (
    isObject(value) &&
    value.schemaVersion === 2 &&
    (value.scope === null || isObject(value.scope)) &&
    hasSharedSessionFields(value)
  );
}

function parseAnswers(value: unknown): QuizAnswerHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is QuizAnswerHistoryEntry =>
      isObject(entry) &&
      typeof entry.questionType === "string" &&
      typeof entry.verseKey === "string" &&
      typeof entry.isCorrect === "boolean",
  );
}

function isV3Session(value: unknown): value is QuizSessionSummaryV3 {
  return (
    isObject(value) &&
    value.schemaVersion === 3 &&
    (value.scope === null || isObject(value.scope)) &&
    Array.isArray(value.answers) &&
    hasSharedSessionFields(value)
  );
}

/**
 * Older sessions keep their scores and scope; they simply have no per-answer
 * detail, which the review surfaces treat as "nothing to replay".
 */
export function migrateQuizSession(
  value: unknown,
): QuizSessionSummaryV3 | null {
  if (isV3Session(value)) {
    return { ...value, answers: parseAnswers(value.answers) };
  }
  if (isV2Session(value)) {
    return { ...value, schemaVersion: 3, answers: [] };
  }
  if (!isV1Session(value)) return null;

  return {
    schemaVersion: 3,
    id: value.id,
    completedAt: value.completedAt,
    scope: null,
    legacyScopeSummary: value.scopeSummary,
    sessionMode: value.sessionMode,
    questionCount: value.questionCount,
    correctCount: value.correctCount,
    accuracyByType: value.accuracyByType,
    durationMs: value.durationMs,
    answers: [],
  };
}

export function loadQuizHistory(
  storage: SafeStorage = safeStorage,
): QuizSessionSummaryV3[] {
  const raw = storage.getItem(QUIZ_HISTORY_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const sessions = parsed
      .map(migrateQuizSession)
      .filter((session): session is QuizSessionSummaryV3 => session !== null)
      .slice(0, MAX_SESSIONS);

    if (parsed.some((session) => !isV3Session(session))) {
      storage.setItem(QUIZ_HISTORY_STORAGE_KEY, JSON.stringify(sessions));
    }
    return sessions;
  } catch {
    return [];
  }
}

export function saveQuizSession(
  summary: QuizSessionSummaryV3,
  storage: SafeStorage = safeStorage,
): { history: QuizSessionSummaryV3[]; saved: boolean } {
  const trimmed: QuizSessionSummaryV3 = {
    ...summary,
    answers: summary.answers.slice(0, MAX_STORED_ANSWERS),
  };
  const history = [trimmed, ...loadQuizHistory(storage)].slice(0, MAX_SESSIONS);
  return {
    history,
    saved: storage.setItem(QUIZ_HISTORY_STORAGE_KEY, JSON.stringify(history)),
  };
}
