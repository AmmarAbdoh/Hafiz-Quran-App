import { describe, expect, it } from "vitest";
import type { MushafVerse } from "@/domain/quran";
import { initialQuizState, quizReducer } from "./quizReducer";
import type {
  QuizAnswerRecord,
  QuizConfig,
  QuizQuestion,
  QuizSessionSummaryV2,
} from "./types";

const verse: MushafVerse = {
  id: 1,
  jozz: 1,
  page: 1,
  sura_no: 1,
  sura_name_en: "Al-Fatihah",
  sura_name_ar: "الفاتحة",
  line_start: 1,
  line_end: 1,
  aya_no: 1,
  aya_text: "بسم الله",
  aya_text_emlaey: "بسم الله",
};
const config: QuizConfig = {
  scope: { mode: "surah", surahIndices: [1] },
  questionTypes: ["ayah_number"],
  sessionMode: "fixed",
  questionCount: 2,
};
const question: QuizQuestion = {
  id: "question-1",
  type: "ayah_number",
  verse,
  verseKey: "1:1",
  choices: [{ id: "1", label: "1" }],
  correctChoiceId: "1",
};
const answer: QuizAnswerRecord = {
  questionId: question.id,
  questionType: question.type,
  verseKey: question.verseKey,
  selectedChoiceId: "1",
  correctChoiceId: "1",
  isCorrect: true,
};
const summary: QuizSessionSummaryV2 = {
  schemaVersion: 2,
  id: "session-1",
  completedAt: "2026-01-01T00:00:00.000Z",
  scope: { mode: "surah", surahNumbers: [1] },
  sessionMode: "fixed",
  questionCount: 1,
  correctCount: 1,
  accuracyByType: { ayah_number: { correct: 1, total: 1 } },
  durationMs: 1000,
};

describe("quizReducer", () => {
  it("moves through setup, active, feedback, and results explicitly", () => {
    const setup = quizReducer(initialQuizState, { type: "OPEN_SETUP" });
    expect(setup.phase).toBe("setup");

    const active = quizReducer(setup, {
      type: "START",
      config,
      question,
      startedAt: 100,
    });
    expect(active.phase).toBe("active");
    expect(active.answers).toEqual([]);

    const feedback = quizReducer(active, { type: "ANSWER", answer });
    expect(feedback.phase).toBe("feedback");
    expect(feedback.answers).toEqual([answer]);
    expect(feedback.streak).toBe(1);

    const results = quizReducer(feedback, {
      type: "FINISH",
      summary,
      historySaveFailed: false,
    });
    expect(results.phase).toBe("results");
    expect(results.sessionSummary).toBe(summary);
  });

  it("ignores answers outside the active phase", () => {
    expect(quizReducer(initialQuizState, { type: "ANSWER", answer })).toBe(
      initialQuizState,
    );
  });

  it("resets feedback fields when the next question starts", () => {
    const active = quizReducer(initialQuizState, {
      type: "START",
      config,
      question,
      startedAt: 100,
    });
    const feedback = quizReducer(active, { type: "ANSWER", answer });
    const nextQuestion = { ...question, id: "question-2" };
    const next = quizReducer(feedback, {
      type: "NEXT_QUESTION",
      question: nextQuestion,
    });
    expect(next.phase).toBe("active");
    expect(next.currentQuestion).toBe(nextQuestion);
    expect(next.selectedChoiceId).toBeNull();
    expect(next.lastIsCorrect).toBeNull();
  });

  it("reports setup failures but ignores stale failures after a session starts", () => {
    const failedIdle = quizReducer(initialQuizState, {
      type: "START_FAILED",
      error: "scopeEmpty",
    });
    const setup = quizReducer(initialQuizState, { type: "OPEN_SETUP" });
    const failedSetup = quizReducer(setup, {
      type: "START_FAILED",
      error: "noTypes",
    });
    const active = quizReducer(setup, {
      type: "START",
      config,
      question,
      startedAt: 100,
    });

    expect(failedIdle.error).toBe("scopeEmpty");
    expect(failedSetup.error).toBe("noTypes");
    expect(
      quizReducer(active, {
        type: "START_FAILED",
        error: "questionUnavailable",
      }),
    ).toBe(active);
  });

  it("resets the streak after an incorrect answer", () => {
    const active = {
      ...quizReducer(initialQuizState, {
        type: "START" as const,
        config,
        question,
        startedAt: 100,
      }),
      streak: 4,
    };
    const incorrect = { ...answer, selectedChoiceId: "2", isCorrect: false };

    expect(
      quizReducer(active, { type: "ANSWER", answer: incorrect }),
    ).toMatchObject({
      phase: "feedback",
      streak: 0,
      selectedChoiceId: "2",
      lastIsCorrect: false,
    });
  });

  it("requires a current active question before recording an answer", () => {
    const activeWithoutQuestion = {
      ...initialQuizState,
      phase: "active" as const,
    };
    expect(quizReducer(activeWithoutQuestion, { type: "ANSWER", answer })).toBe(
      activeWithoutQuestion,
    );
  });

  it("ignores next-question actions outside feedback", () => {
    expect(
      quizReducer(initialQuizState, {
        type: "NEXT_QUESTION",
        question,
      }),
    ).toBe(initialQuizState);
  });

  it("marks active or feedback questions unavailable and ignores stale errors", () => {
    const active = quizReducer(initialQuizState, {
      type: "START",
      config,
      question,
      startedAt: 100,
    });
    const feedback = quizReducer(active, { type: "ANSWER", answer });

    expect(quizReducer(active, { type: "QUESTION_FAILED" })).toMatchObject({
      phase: "active",
      currentQuestion: null,
      error: "questionUnavailable",
    });
    expect(quizReducer(feedback, { type: "QUESTION_FAILED" })).toMatchObject({
      phase: "feedback",
      currentQuestion: null,
      error: "questionUnavailable",
    });
    expect(quizReducer(initialQuizState, { type: "QUESTION_FAILED" })).toBe(
      initialQuizState,
    );
  });

  it("finishes from active or feedback and records persistence failures", () => {
    const active = quizReducer(initialQuizState, {
      type: "START",
      config,
      question,
      startedAt: 100,
    });
    const feedback = quizReducer(active, { type: "ANSWER", answer });

    expect(
      quizReducer(active, {
        type: "FINISH",
        summary,
        historySaveFailed: true,
      }),
    ).toMatchObject({
      phase: "results",
      sessionSummary: summary,
      historySaveFailed: true,
    });
    expect(
      quizReducer(feedback, {
        type: "FINISH",
        summary,
        historySaveFailed: false,
      }),
    ).toMatchObject({ phase: "results", historySaveFailed: false });
    expect(
      quizReducer(initialQuizState, {
        type: "FINISH",
        summary,
        historySaveFailed: false,
      }),
    ).toBe(initialQuizState);
  });
});
