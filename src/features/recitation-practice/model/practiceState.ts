import type {
  MisreadWord,
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
  heldAtLocation: null,
  revealedLocations: [],
  misreadWords: [],
  progressIndex: 0,
  totalWords: 0,
  completed: false,
  stoppedShort: false,
  error: null,
  errorDetail: null,
};

export const initialRecitationPracticeTelemetry: RecitationPracticeTelemetry = {
  isSpeaking: false,
  micLevel: 0,
  heard: [],
  expected: [],
  mic: null,
};

export type PracticeStateAction =
  | { type: "reset"; error?: PracticeErrorCode | null; detail?: string }
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
      misreadWords: MisreadWord[];
      currentWordLocation: string | null;
      transcript: string;
      completed: boolean;
      /**
       * The reciter stopped before the end; see `stoppedShort`.
       *
       * Only a finished run can be reported as a clean one, and the total
       * this is measured against is the page's, not the stretch that was
       * judged. Replacing the total with the judged stretch showed three
       * words of a hundred and twenty as a complete, clean page.
       */
      stoppedShort?: boolean;
      /**
       * The word the reciter is being held at, if any.
       *
       * Carried here rather than dispatched after: this action clears the
       * mark, so setting it in a second action made the red flicker on every
       * batch of phonemes.
       */
      wrongFlashLocation?: string | null;
      /** The word the run is stopped at; see `heldAtLocation`. */
      heldAtLocation?: string | null;
    }
  | { type: "wrong-attempt"; transcript: string; location: string | null }
  | { type: "clear-wrong-flash" }
  /**
   * The reader asked to see the word they are stopped at.
   *
   * Only what it changes: the run is still held, and the next batch of
   * phonemes will say so again. Dispatching the whole of the progress here
   * would report a cursor position the recogniser has not reported.
   */
  | { type: "held-word-revealed"; revealedLocations: string[] }
  /** The reader turned off being stopped, so the run is let go. */
  | { type: "clear-held-word" }
  | { type: "recognition-error"; error: PracticeErrorCode; detail?: string };

export function recitationPracticeReducer(
  state: RecitationPracticeState,
  action: PracticeStateAction,
): RecitationPracticeState {
  switch (action.type) {
    case "reset":
      return {
        ...initialRecitationPracticeState,
        error: action.error ?? null,
        errorDetail: action.detail ?? null,
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
      /* The run is over, so nothing is held at a word any more - and the
         prompt offering to move past one must not outlive it. */
      return state.isAnalyzing && !state.heldAtLocation
        ? state
        : { ...state, isAnalyzing: true, heldAtLocation: null };
    case "transcript-observed":
      return { ...state, lastTranscript: action.transcript };
    case "wrong-attempt":
      return {
        ...state,
        isAnalyzing: false,
        lastTranscript: action.transcript,
        wrongFlashLocation: action.location,
      };
    case "progress-advanced": {
      /*
       * The cursor moving is proof the recogniser recovered.
       *
       * A non-fatal recognition error left its banner on screen for the rest
       * of the run - and offered to re-download a model that was by then
       * plainly working. It has to be the cursor *moving*: the recogniser
       * reports every 480ms whether or not it did, so clearing the error on
       * every report cleared it about half a second after it appeared, while
       * the cursor was still stuck. A fatal error does not reach here; it
       * resets the run and keeps its message.
       */
      const moved = state.progressIndex !== action.progressIndex;
      return {
        ...state,
        progressIndex: action.progressIndex,
        revealedLocations: action.revealedLocations,
        misreadWords: action.misreadWords,
        currentWordLocation: action.currentWordLocation,
        completed: action.completed,
        stoppedShort: action.stoppedShort ?? state.stoppedShort,
        phase: action.completed ? "completed" : "listening",
        listening: !action.completed,
        isAnalyzing: false,
        lastTranscript: action.transcript,
        wrongFlashLocation: action.wrongFlashLocation ?? null,
        heldAtLocation: action.heldAtLocation ?? null,
        error: moved ? null : state.error,
        errorDetail: moved ? null : state.errorDetail,
      };
    }
    case "clear-wrong-flash":
      if (!state.wrongFlashLocation) return state;
      return { ...state, wrongFlashLocation: null };
    case "held-word-revealed":
      return { ...state, revealedLocations: action.revealedLocations };
    case "clear-held-word":
      if (!state.heldAtLocation) return state;
      return { ...state, heldAtLocation: null };
    case "recognition-error":
      return {
        ...state,
        isAnalyzing: false,
        error: action.error,
        errorDetail: action.detail ?? null,
      };
  }
}
