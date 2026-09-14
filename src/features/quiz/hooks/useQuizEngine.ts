import { useReducer, useRef } from "react";
import { useSurahNames } from "@/domain/quran";
import {
  checkQuizAnswer,
  generateQuizQuestion,
  getChoiceLabel,
  getCorrectChoiceId,
} from "../model/questionGenerator";
import { pickQuestionType } from "../model/questionTypes";
import { quizReducer, initialQuizState } from "../model/quizReducer";
import { buildSessionSummary } from "../model/quizSession";
import {
  describeScopeCoverage,
  isQuestionTypeAvailable,
} from "../model/scopeCoverage";
import type {
  QuestionType,
  QuizAnswerRecord,
  QuizConfig,
  QuizEngineError,
  QuizQuestion,
} from "../model/types";
import { buildVersePool, shuffleArray, toVerseKey } from "../model/versePool";
import { saveQuizSession } from "../services/quizHistoryStorage";
import { useQuizFormatters } from "./useQuizFormatters";
import type { MushafVerse, VerseInfoRecord } from "@/domain/quran";

export type QuizStartResult =
  | { ok: true }
  | { ok: false; error: QuizEngineError };

/** How many verses to try before admitting the scope cannot be quizzed. */
const MAX_DRAW_ATTEMPTS = 8;
/** How many consecutive generation failures end the session instead of retrying. */
const MAX_CONSECUTIVE_QUESTION_FAILURES = 3;

export function useQuizEngine(
  mushafData: MushafVerse[],
  verseInfoRecords: VerseInfoRecord[],
) {
  const [state, dispatch] = useReducer(quizReducer, initialQuizState);
  const { surahName } = useSurahNames();
  const { formatVerseRef } = useQuizFormatters();
  /** Every verse in the scope: the source of options and neighbouring ayahs. */
  const poolRef = useRef<MushafVerse[]>([]);
  /** The verses to ask about, which a review session narrows to the misses. */
  const askPoolRef = useRef<MushafVerse[]>([]);
  const queueRef = useRef<MushafVerse[]>([]);
  const lastVerseKeyRef = useRef<string | null>(null);
  const consecutiveQuestionFailuresRef = useRef(0);

  /**
   * Every verse to ask about is asked once before any repeats, and a new cycle
   * never opens with the verse that just closed the previous one.
   */
  function drawNextVerse(): MushafVerse | null {
    if (queueRef.current.length === 0) {
      const reshuffled = shuffleArray(askPoolRef.current);
      if (
        reshuffled.length > 1 &&
        toVerseKey(reshuffled[0]!) === lastVerseKeyRef.current
      ) {
        reshuffled.push(reshuffled.shift()!);
      }
      queueRef.current = reshuffled;
    }
    const verse = queueRef.current.shift() ?? null;
    if (verse) lastVerseKeyRef.current = toVerseKey(verse);
    return verse;
  }

  function createQuestion(
    config: QuizConfig,
    previousType: QuestionType | null,
  ): QuizQuestion | null {
    for (let attempt = 0; attempt < MAX_DRAW_ATTEMPTS; attempt += 1) {
      const verse = drawNextVerse();
      if (!verse) return null;

      // The preferred type leads; the rest stand in when this verse cannot
      // carry it, so one awkward ayah never ends the session.
      const preferred = pickQuestionType(config.questionTypes, previousType);
      const fallbacks = shuffleArray(
        config.questionTypes.filter((type) => type !== preferred),
      );
      for (const questionType of [preferred, ...fallbacks]) {
        if (!questionType) continue;
        const question = generateQuizQuestion({
          verse,
          questionType,
          pool: poolRef.current,
          mushafData,
          verseInfoRecords,
          surahName,
          verseRef: formatVerseRef,
        });
        if (question) return question;
      }
    }
    return null;
  }

  function startQuiz(config: QuizConfig): QuizStartResult {
    const pool = buildVersePool(mushafData, config.scope);
    const focusKeys = new Set(config.focusVerseKeys ?? []);
    // A review of missed ayahs asks only about those, but still draws its
    // options from the whole scope, so one missed ayah is still quizzable.
    const askPool =
      focusKeys.size > 0
        ? pool.filter((verse) => focusKeys.has(toVerseKey(verse)))
        : pool;

    if (askPool.length === 0) {
      dispatch({ type: "START_FAILED", error: "scopeEmpty" });
      return { ok: false, error: "scopeEmpty" };
    }
    if (config.questionTypes.length === 0) {
      dispatch({ type: "START_FAILED", error: "noTypes" });
      return { ok: false, error: "noTypes" };
    }

    // Drop types the scope cannot support instead of asking them anyway.
    const coverage = describeScopeCoverage(pool, verseInfoRecords);
    const questionTypes = config.questionTypes.filter((type) =>
      isQuestionTypeAvailable(type, coverage),
    );
    if (questionTypes.length === 0) {
      dispatch({ type: "START_FAILED", error: "poolTooSmall" });
      return { ok: false, error: "poolTooSmall" };
    }

    const effectiveConfig: QuizConfig = { ...config, questionTypes };
    poolRef.current = pool;
    askPoolRef.current = askPool;
    queueRef.current = shuffleArray(askPool);
    lastVerseKeyRef.current = null;

    const question = createQuestion(effectiveConfig, null);
    if (!question) {
      dispatch({ type: "START_FAILED", error: "questionUnavailable" });
      return { ok: false, error: "questionUnavailable" };
    }

    dispatch({
      type: "START",
      config: effectiveConfig,
      question,
      startedAt: Date.now(),
    });
    consecutiveQuestionFailuresRef.current = 0;
    return { ok: true };
  }

  function submitAnswer(selectedChoiceId: string): void {
    const question = state.currentQuestion;
    if (!question || state.phase !== "active") return;

    const correctChoiceId = getCorrectChoiceId(question);
    const answer: QuizAnswerRecord = {
      questionId: question.id,
      questionType: question.type,
      verseKey: question.verseKey,
      testedVerseKey: question.testedVerseKey,
      selectedChoiceId,
      selectedLabel: getChoiceLabel(question, selectedChoiceId),
      correctChoiceId,
      correctLabel: getChoiceLabel(question, correctChoiceId),
      isCorrect: checkQuizAnswer(question, selectedChoiceId, mushafData),
    };
    dispatch({ type: "ANSWER", answer });
  }

  function finishQuiz(): void {
    if (
      !state.config ||
      state.startedAt === null ||
      (state.phase !== "active" && state.phase !== "feedback")
    ) {
      return;
    }
    const summary = buildSessionSummary({
      scope: state.config.scope,
      sessionMode: state.config.sessionMode,
      answers: state.answers,
      startedAt: state.startedAt,
      reviewOfMistakes: (state.config.focusVerseKeys?.length ?? 0) > 0,
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

    const question = createQuestion(
      config,
      state.currentQuestion?.type ?? null,
    );
    if (question) {
      consecutiveQuestionFailuresRef.current = 0;
      dispatch({ type: "NEXT_QUESTION", question });
      return;
    }

    consecutiveQuestionFailuresRef.current += 1;
    if (
      consecutiveQuestionFailuresRef.current >=
      MAX_CONSECUTIVE_QUESTION_FAILURES
    ) {
      finishQuiz();
      return;
    }

    dispatch({ type: "QUESTION_FAILED" });
  }

  function openSetup(): void {
    poolRef.current = [];
    askPoolRef.current = [];
    queueRef.current = [];
    lastVerseKeyRef.current = null;
    consecutiveQuestionFailuresRef.current = 0;
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
