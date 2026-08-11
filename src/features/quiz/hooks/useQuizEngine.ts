import { useReducer, useRef } from "react";
import {
  checkQuizAnswer,
  generateQuizQuestion,
  getCorrectChoiceId,
} from "../model/questionGenerator";
import { pickRandomQuestionType } from "../model/questionTypes";
import { quizReducer, initialQuizState } from "../model/quizReducer";
import { buildSessionSummary } from "../model/quizSession";
import type {
  QuizAnswerRecord,
  QuizConfig,
  QuizEngineError,
} from "../model/types";
import { buildVersePool, shuffleArray } from "../model/versePool";
import { saveQuizSession } from "../services/quizHistoryStorage";
import type { MushafVerse, VerseInfoRecord } from "@/domain/quran";

export type QuizStartResult =
  | { ok: true }
  | { ok: false; error: QuizEngineError };

export function useQuizEngine(
  mushafData: MushafVerse[],
  verseInfoRecords: VerseInfoRecord[],
) {
  const [state, dispatch] = useReducer(quizReducer, initialQuizState);
  const poolRef = useRef<MushafVerse[]>([]);
  const queueRef = useRef<MushafVerse[]>([]);

  function drawNextVerse(): MushafVerse | null {
    if (queueRef.current.length === 0) {
      queueRef.current = shuffleArray(poolRef.current);
    }
    return queueRef.current.shift() ?? null;
  }

  function createQuestion(config: QuizConfig) {
    const verse = drawNextVerse();
    const questionType = pickRandomQuestionType(config.questionTypes);
    if (!verse || !questionType) return null;

    return generateQuizQuestion({
      verse,
      questionType,
      pool: poolRef.current,
      mushafData,
      verseInfoRecords,
    });
  }

  function startQuiz(config: QuizConfig): QuizStartResult {
    const pool = buildVersePool(mushafData, config.scope);
    if (pool.length === 0) {
      dispatch({ type: "START_FAILED", error: "scopeEmpty" });
      return { ok: false, error: "scopeEmpty" };
    }
    if (config.questionTypes.length === 0) {
      dispatch({ type: "START_FAILED", error: "noTypes" });
      return { ok: false, error: "noTypes" };
    }

    poolRef.current = pool;
    queueRef.current = shuffleArray(pool);
    const question = createQuestion(config);
    if (!question) {
      dispatch({ type: "START_FAILED", error: "questionUnavailable" });
      return { ok: false, error: "questionUnavailable" };
    }

    dispatch({
      type: "START",
      config,
      question,
      startedAt: Date.now(),
    });
    return { ok: true };
  }

  function submitAnswer(selectedChoiceId: string): void {
    const question = state.currentQuestion;
    if (!question || state.phase !== "active") return;

    const answer: QuizAnswerRecord = {
      questionId: question.id,
      questionType: question.type,
      verseKey: question.verseKey,
      selectedChoiceId,
      correctChoiceId: getCorrectChoiceId(question),
      isCorrect: checkQuizAnswer(question, selectedChoiceId, poolRef.current),
    };
    dispatch({ type: "ANSWER", answer });
  }

  function finishQuiz(): void {
    if (!state.config || state.startedAt === null) return;
    const summary = buildSessionSummary({
      scope: state.config.scope,
      sessionMode: state.config.sessionMode,
      answers: state.answers,
      startedAt: state.startedAt,
    });
    const { saved } = saveQuizSession(summary);
    dispatch({
      type: "FINISH",
      summary,
      historySaveFailed: !saved,
    });
  }

  function goToNextQuestion(): void {
    const config = state.config;
    if (!config || state.phase !== "feedback") return;
    if (
      config.sessionMode === "fixed" &&
      state.answers.length >= (config.questionCount ?? 0)
    ) {
      finishQuiz();
      return;
    }

    const question = createQuestion(config);
    dispatch(
      question
        ? { type: "NEXT_QUESTION", question }
        : { type: "QUESTION_FAILED" },
    );
  }

  function openSetup(): void {
    poolRef.current = [];
    queueRef.current = [];
    dispatch({ type: "OPEN_SETUP" });
  }

  const correct = state.answers.filter((answer) => answer.isCorrect).length;
  const score = {
    correct,
    total: state.answers.length,
    percentage:
      state.answers.length === 0
        ? 0
        : Math.round((correct / state.answers.length) * 100),
  };
  const progress = {
    current: state.answers.length + (state.phase === "active" ? 1 : 0),
    total:
      state.config?.sessionMode === "fixed"
        ? (state.config.questionCount ?? 0)
        : 0,
  };

  return {
    ...state,
    answered: state.phase === "feedback",
    lastSelectedChoiceId: state.selectedChoiceId,
    progress,
    score,
    startQuiz,
    submitAnswer,
    goToNextQuestion,
    finishQuiz,
    resetQuiz: openSetup,
    openSetup,
  };
}
