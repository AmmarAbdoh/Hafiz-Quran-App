import { describe, expect, it } from "vitest";
import type { SafeStorage } from "@/shared/storage";
import type {
  QuizSessionSummaryV2,
  QuizSessionSummaryV3,
} from "../model/types";
import {
  loadQuizHistory,
  migrateQuizSession,
  QUIZ_HISTORY_STORAGE_KEY,
  saveQuizSession,
} from "./quizHistoryStorage";

function createMemoryStorage(initial: Record<string, string> = {}): {
  storage: SafeStorage;
  values: Map<string, string>;
} {
  const values = new Map(Object.entries(initial));
  return {
    values,
    storage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        values.set(key, value);
        return true;
      },
      removeItem: (key) => values.delete(key),
    },
  };
}

const v2Summary: QuizSessionSummaryV2 = {
  schemaVersion: 2,
  id: "v2",
  completedAt: "2026-01-01T00:00:00.000Z",
  scope: { mode: "surah", surahNumbers: [1, 2] },
  sessionMode: "fixed",
  questionCount: 2,
  correctCount: 1,
  accuracyByType: { ayah_number: { correct: 1, total: 2 } },
  durationMs: 1_000,
};

const v3Summary: QuizSessionSummaryV3 = {
  ...v2Summary,
  schemaVersion: 3,
  id: "v3",
  answers: [
    { questionType: "ayah_number", verseKey: "1:1", isCorrect: true },
    { questionType: "ayah_number", verseKey: "1:2", isCorrect: false },
  ],
};

describe("quiz history storage", () => {
  it("migrates V1 records without losing the legacy scope fallback", () => {
    const v1 = {
      id: "v1",
      completedAt: "2025-01-01T00:00:00.000Z",
      scopeSummary: "legacy localized scope",
      sessionMode: "fixed",
      questionCount: 3,
      correctCount: 2,
      accuracyByType: {},
      durationMs: 5_000,
    };
    expect(migrateQuizSession(v1)).toMatchObject({
      schemaVersion: 3,
      id: "v1",
      scope: null,
      legacyScopeSummary: "legacy localized scope",
      answers: [],
    });
  });

  it("keeps V2 scores and scope, with no per-answer detail to replay", () => {
    expect(migrateQuizSession(v2Summary)).toMatchObject({
      schemaVersion: 3,
      id: "v2",
      scope: { mode: "surah", surahNumbers: [1, 2] },
      correctCount: 1,
      answers: [],
    });
  });

  it("keeps per-answer detail for V3 records and drops malformed entries", () => {
    const withNoise = {
      ...v3Summary,
      answers: [...v3Summary.answers, { questionType: "ayah_number" }],
    };
    expect(migrateQuizSession(withNoise)).toMatchObject({
      answers: v3Summary.answers,
    });
  });

  it("rewrites migrated history in V3 form and keeps every valid session", () => {
    const v1 = {
      id: "v1",
      completedAt: "2025-01-01T00:00:00.000Z",
      scopeSummary: "old scope",
      sessionMode: "endless",
      questionCount: 1,
      correctCount: 1,
      accuracyByType: {},
      durationMs: 10,
    };
    const { storage, values } = createMemoryStorage({
      [QUIZ_HISTORY_STORAGE_KEY]: JSON.stringify([v3Summary, v2Summary, v1]),
    });
    const history = loadQuizHistory(storage);
    expect(history.map((session) => session.id)).toEqual(["v3", "v2", "v1"]);
    const rewritten = JSON.parse(
      values.get(QUIZ_HISTORY_STORAGE_KEY) ?? "[]",
    ) as QuizSessionSummaryV3[];
    expect(rewritten.every((session) => session.schemaVersion === 3)).toBe(
      true,
    );
  });

  it("reports blocked writes without throwing or dropping in-memory history", () => {
    const storage: SafeStorage = {
      getItem: () => null,
      setItem: () => false,
      removeItem: () => false,
    };
    expect(saveQuizSession(v3Summary, storage)).toEqual({
      history: [v3Summary],
      saved: false,
    });
  });

  it("ignores malformed storage values", () => {
    const { storage } = createMemoryStorage({
      [QUIZ_HISTORY_STORAGE_KEY]: "not-json",
    });
    expect(loadQuizHistory(storage)).toEqual([]);
  });
});
