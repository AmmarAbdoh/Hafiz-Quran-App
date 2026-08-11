import { safeStorage, type SafeStorage } from "@/shared/storage";
import type {
  QuizSessionSummaryV1,
  QuizSessionSummaryV2,
} from "../model/types";

export const QUIZ_HISTORY_STORAGE_KEY = "quiz-history";
const MAX_SESSIONS = 50;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSessionMode(value: unknown): value is "fixed" | "endless" {
  return value === "fixed" || value === "endless";
}

function isV1Session(value: unknown): value is QuizSessionSummaryV1 {
  return (
    isObject(value) &&
    typeof value.id === "string" &&
    typeof value.completedAt === "string" &&
    typeof value.scopeSummary === "string" &&
    isSessionMode(value.sessionMode) &&
    typeof value.questionCount === "number" &&
    typeof value.correctCount === "number" &&
    isObject(value.accuracyByType) &&
    typeof value.durationMs === "number"
  );
}

function isV2Session(value: unknown): value is QuizSessionSummaryV2 {
  return (
    isObject(value) &&
    value.schemaVersion === 2 &&
    typeof value.id === "string" &&
    typeof value.completedAt === "string" &&
    (value.scope === null || isObject(value.scope)) &&
    isSessionMode(value.sessionMode) &&
    typeof value.questionCount === "number" &&
    typeof value.correctCount === "number" &&
    isObject(value.accuracyByType) &&
    typeof value.durationMs === "number"
  );
}

export function migrateQuizSession(
  value: unknown,
): QuizSessionSummaryV2 | null {
  if (isV2Session(value)) return value;
  if (!isV1Session(value)) return null;

  return {
    schemaVersion: 2,
    id: value.id,
    completedAt: value.completedAt,
    scope: null,
    legacyScopeSummary: value.scopeSummary,
    sessionMode: value.sessionMode,
    questionCount: value.questionCount,
    correctCount: value.correctCount,
    accuracyByType: value.accuracyByType,
    durationMs: value.durationMs,
  };
}

export function loadQuizHistory(
  storage: SafeStorage = safeStorage,
): QuizSessionSummaryV2[] {
  const raw = storage.getItem(QUIZ_HISTORY_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const sessions = parsed
      .map(migrateQuizSession)
      .filter((session): session is QuizSessionSummaryV2 => session !== null)
      .slice(0, MAX_SESSIONS);

    if (parsed.some((session) => !isV2Session(session))) {
      storage.setItem(QUIZ_HISTORY_STORAGE_KEY, JSON.stringify(sessions));
    }
    return sessions;
  } catch {
    return [];
  }
}

export function saveQuizSession(
  summary: QuizSessionSummaryV2,
  storage: SafeStorage = safeStorage,
): { history: QuizSessionSummaryV2[]; saved: boolean } {
  const history = [summary, ...loadQuizHistory(storage)].slice(0, MAX_SESSIONS);
  return {
    history,
    saved: storage.setItem(QUIZ_HISTORY_STORAGE_KEY, JSON.stringify(history)),
  };
}
