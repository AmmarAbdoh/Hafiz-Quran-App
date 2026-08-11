import type {
  PracticeErrorCode,
  RecitationPracticeState,
  RecitationPracticeTelemetry,
} from "@/features/recitation-practice/contract";

export const initialRecitationPracticeState: RecitationPracticeState = {
  active: false,
  phase: "preparing",
  listening: false,
  loadingModel: false,
  modelProgress: 0,
  isAnalyzing: false,
  currentWordLocation: null,
  lastTranscript: "",
  wrongFlashLocation: null,
  revealedLocations: [],
  progressIndex: 0,
  totalWords: 0,
  completed: false,
  error: null,
};

export const initialRecitationPracticeTelemetry: RecitationPracticeTelemetry = {
  isSpeaking: false,
  micLevel: 0,
};

export type PracticeStateAction =
  | { type: "reset"; error?: PracticeErrorCode | null }
  | { type: "start" }
  | {
      type: "expected-words-ready";
      totalWords: number;
      currentWordLocation: string | null;
    }
  | { type: "model-progress"; progress: number }
  | { type: "listening" }
  | { type: "analysis-started" }
  | { type: "transcript-observed"; transcript: string }
  | {
      type: "progress-advanced";
      progressIndex: number;
      revealedLocations: string[];
      currentWordLocation: string | null;
      transcript: string;
      completed: boolean;
    }
  | { type: "wrong-attempt"; transcript: string; location: string | null }
  | { type: "clear-wrong-flash" }
  | { type: "recognition-error"; error: PracticeErrorCode };

export function recitationPracticeReducer(
  state: RecitationPracticeState,
  action: PracticeStateAction,
): RecitationPracticeState {
  switch (action.type) {
    case "reset":
      return {
        ...initialRecitationPracticeState,
        error: action.error ?? null,
      };
    case "start":
      return { ...initialRecitationPracticeState, active: true };
    case "expected-words-ready":
      return {
        ...state,
        phase: "loading-model",
        loadingModel: true,
        modelProgress: 0,
        totalWords: action.totalWords,
        progressIndex: 0,
        currentWordLocation: action.currentWordLocation,
        revealedLocations: [],
        lastTranscript: "",
        error: null,
      };
    case "model-progress":
      return {
        ...state,
        phase: "loading-model",
        loadingModel: true,
        modelProgress: action.progress,
      };
    case "listening":
      return {
        ...state,
        phase: "listening",
        loadingModel: false,
        modelProgress: 100,
        listening: true,
        error: null,
      };
    case "analysis-started":
      return state.isAnalyzing ? state : { ...state, isAnalyzing: true };
    case "transcript-observed":
      return { ...state, lastTranscript: action.transcript };
    case "wrong-attempt":
      return {
        ...state,
        isAnalyzing: false,
        lastTranscript: action.transcript,
        wrongFlashLocation: action.location,
      };
    case "progress-advanced":
      return {
        ...state,
        progressIndex: action.progressIndex,
        revealedLocations: action.revealedLocations,
        currentWordLocation: action.currentWordLocation,
        completed: action.completed,
        phase: action.completed ? "completed" : "listening",
        listening: !action.completed,
        isAnalyzing: false,
        lastTranscript: action.transcript,
        wrongFlashLocation: null,
      };
    case "clear-wrong-flash":
      if (!state.wrongFlashLocation) return state;
      return { ...state, wrongFlashLocation: null };
    case "recognition-error":
      return { ...state, isAnalyzing: false, error: action.error };
  }
}
