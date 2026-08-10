import { useCallback, useMemo, useRef, useState } from "react";
import {
  checkQuizAnswer,
  generateQuizQuestion,
  getCorrectChoiceId,
} from "@/features/quiz/lib/questionGen";
import { pickRandomQuestionType } from "@/features/quiz/lib/question-utils";
import { buildSessionSummary, saveQuizSession } from "@/features/quiz/lib/quizStorage";
import type {
  QuizAnswerRecord,
  QuizQuestion,
  QuizSessionSummary,
} from "@/features/quiz/lib/quiz-types";
import {
  buildVersePool,
  shuffleArray,
  summarizeQuizScope,
} from "@/features/quiz/lib/versePool";
import type {
  MushafVerse,
  QuizConfig,
  VerseInfoRecord,
} from "@/shared/types/quran";

export type QuizPhase = "idle" | "active" | "results";

export function useQuizEngine(
  mushafData: MushafVerse[],
  verseInfoRecords: VerseInfoRecord[],
) {
  const [phase, setPhase] = useState<QuizPhase>("idle");
  const [config, setConfig] = useState<QuizConfig | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<QuizQuestion | null>(
    null,
  );
  const [answers, setAnswers] = useState<QuizAnswerRecord[]>([]);
  const [streak, setStreak] = useState(0);
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionSummary, setSessionSummary] = useState<QuizSessionSummary | null>(
    null,
  );
  const [answered, setAnswered] = useState(false);
  const [lastSelectedChoiceId, setLastSelectedChoiceId] = useState<
    string | null
  >(null);
  const [lastIsCorrect, setLastIsCorrect] = useState<boolean | null>(null);

  const startedAtRef = useRef<number>(0);
  const queueRef = useRef<MushafVerse[]>([]);
  const poolRef = useRef<MushafVerse[]>([]);

  const refillQueue = useCallback(() => {
    queueRef.current = shuffleArray(poolRef.current);
  }, []);

  const drawNextVerse = useCallback((): MushafVerse | null => {
    if (queueRef.current.length === 0) {
      refillQueue();
    }
    return queueRef.current.shift() ?? null;
  }, [refillQueue]);

  const loadQuestion = useCallback(
    (activeConfig: QuizConfig) => {
      setLoadingQuestion(true);
      setError(null);
      setAnswered(false);
      setLastSelectedChoiceId(null);
      setLastIsCorrect(null);

      const verse = drawNextVerse();
      const questionType = pickRandomQuestionType(activeConfig.questionTypes);

      if (!verse || !questionType) {
        setError("تعذر إنشاء سؤال من النطاق المحدد.");
        setCurrentQuestion(null);
        setLoadingQuestion(false);
        return;
      }

      const question = generateQuizQuestion({
        verse,
        questionType,
        pool: poolRef.current,
        mushafData,
        verseInfoRecords,
      });

      setCurrentQuestion(question);
      setLoadingQuestion(false);
    },
    [drawNextVerse, mushafData, verseInfoRecords],
  );

  const startQuiz = useCallback(
    (nextConfig: QuizConfig) => {
      const pool = buildVersePool(mushafData, nextConfig.scope);
      if (pool.length === 0) {
        setError("النطاق المحدد لا يحتوي على آيات.");
        return false;
      }

      if (nextConfig.questionTypes.length === 0) {
        setError("اختر نوع سؤال واحد على الأقل.");
        return false;
      }

      poolRef.current = pool;
      refillQueue();
      startedAtRef.current = Date.now();
      setConfig(nextConfig);
      setAnswers([]);
      setStreak(0);
      setSessionSummary(null);
      setPhase("active");
      loadQuestion(nextConfig);
      return true;
    },
    [loadQuestion, mushafData, refillQueue],
  );

  const finishQuiz = useCallback(() => {
    if (!config) return;

    const summary = buildSessionSummary({
      scopeSummary: summarizeQuizScope(config.scope),
      sessionMode: config.sessionMode,
      answers,
      startedAt: startedAtRef.current,
    });

    setSessionSummary(summary);
    saveQuizSession(summary);
    setPhase("results");
  }, [answers, config]);

  const submitAnswer = useCallback(
    (selectedChoiceId: string) => {
      if (!currentQuestion || answered) return;

      const isCorrect = checkQuizAnswer(
        currentQuestion,
        selectedChoiceId,
        poolRef.current,
      );
      const record: QuizAnswerRecord = {
        questionId: currentQuestion.id,
        questionType: currentQuestion.type,
        verseKey: currentQuestion.verseKey,
        selectedChoiceId,
        correctChoiceId: getCorrectChoiceId(currentQuestion),
        isCorrect,
      };

      setAnswers((previous) => [...previous, record]);
      setStreak((previous) => (isCorrect ? previous + 1 : 0));
      setAnswered(true);
      setLastSelectedChoiceId(selectedChoiceId);
      setLastIsCorrect(isCorrect);
    },
    [answered, config, currentQuestion],
  );

  const goToNextQuestion = useCallback(() => {
    if (!config) return;

    if (
      config.sessionMode === "fixed" &&
      answers.length >= (config.questionCount ?? 0)
    ) {
      finishQuiz();
      return;
    }

    loadQuestion(config);
  }, [answers.length, config, finishQuiz, loadQuestion]);

  const resetQuiz = useCallback(() => {
    setPhase("idle");
    setConfig(null);
    setCurrentQuestion(null);
    setAnswers([]);
    setStreak(0);
    setLoadingQuestion(false);
    setError(null);
    setSessionSummary(null);
    setAnswered(false);
    setLastSelectedChoiceId(null);
    setLastIsCorrect(null);
    queueRef.current = [];
    poolRef.current = [];
  }, []);

  const progress = useMemo(() => {
    if (!config) {
      return { current: 0, total: 0, label: "" };
    }

    const current = answers.length + (answered ? 0 : 1);
    if (config.sessionMode === "endless") {
      return {
        current,
        total: 0,
        label: `السؤال ${current}`,
      };
    }

    return {
      current,
      total: config.questionCount ?? 0,
      label: `السؤال ${current} / ${config.questionCount ?? 0}`,
    };
  }, [answers.length, answered, config]);

  const score = useMemo(() => {
    const correct = answers.filter((answer) => answer.isCorrect).length;
    return {
      correct,
      total: answers.length,
      percentage:
        answers.length === 0
          ? 0
          : Math.round((correct / answers.length) * 100),
    };
  }, [answers]);

  return {
    phase,
    config,
    currentQuestion,
    answers,
    streak,
    loadingQuestion,
    error,
    sessionSummary,
    answered,
    lastSelectedChoiceId,
    lastIsCorrect,
    progress,
    score,
    startQuiz,
    submitAnswer,
    goToNextQuestion,
    finishQuiz,
    resetQuiz,
  };
}
