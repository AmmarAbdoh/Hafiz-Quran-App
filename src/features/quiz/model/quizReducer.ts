import type {
  QuizAnswerRecord,
  QuizEngineError,
  QuizQuestion,
  QuizSessionSummaryV2,
  QuizState,
} from "./types";
import type { QuizConfig } from "./types";

export const initialQuizState: QuizState = {
  phase: "idle",
  config: null,
  currentQuestion: null,
  answers: [],
  streak: 0,
  error: null,
  sessionSummary: null,
  selectedChoiceId: null,
  lastIsCorrect: null,
  startedAt: null,
  historySaveFailed: false,
};

export type QuizAction =
  | { type: "OPEN_SETUP" }
  | {
      type: "START";
      config: QuizConfig;
      question: QuizQuestion;
      startedAt: number;
    }
  | { type: "START_FAILED"; error: QuizEngineError }
  | { type: "ANSWER"; answer: QuizAnswerRecord }
  | { type: "NEXT_QUESTION"; question: QuizQuestion }
  | { type: "QUESTION_FAILED" }
  | {
      type: "FINISH";
      summary: QuizSessionSummaryV2;
      historySaveFailed: boolean;
    };

export function quizReducer(state: QuizState, action: QuizAction): QuizState {
  switch (action.type) {
    case "OPEN_SETUP":
      return { ...initialQuizState, phase: "setup" };
    case "START":
      return {
        ...initialQuizState,
        phase: "active",
        config: action.config,
        currentQuestion: action.question,
        startedAt: action.startedAt,
      };
    case "START_FAILED":
      if (state.phase !== "idle" && state.phase !== "setup") return state;
      return { ...state, error: action.error };
    case "ANSWER":
      if (state.phase !== "active" || !state.currentQuestion) return state;
      return {
        ...state,
        phase: "feedback",
        answers: [...state.answers, action.answer],
        streak: action.answer.isCorrect ? state.streak + 1 : 0,
        selectedChoiceId: action.answer.selectedChoiceId,
        lastIsCorrect: action.answer.isCorrect,
      };
    case "NEXT_QUESTION":
      if (state.phase !== "feedback") return state;
      return {
        ...state,
        phase: "active",
        currentQuestion: action.question,
        selectedChoiceId: null,
        lastIsCorrect: null,
        error: null,
      };
    case "QUESTION_FAILED":
      if (state.phase !== "active" && state.phase !== "feedback") return state;
      return {
        ...state,
        currentQuestion: null,
        error: "questionUnavailable",
      };
    case "FINISH":
      if (state.phase !== "active" && state.phase !== "feedback") return state;
      return {
        ...state,
        phase: "results",
        sessionSummary: action.summary,
        historySaveFailed: action.historySaveFailed,
      };
  }
}
