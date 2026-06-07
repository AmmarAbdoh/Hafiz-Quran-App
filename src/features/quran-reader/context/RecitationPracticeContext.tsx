import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  createAlignerState,
  isPracticeComplete,
  type AlignerState,
  type ExpectedPracticeWord,
} from "@/features/quran-reader/lib/constrainedWordAligner";
import { buildPageExpectedWords } from "@/features/quran-reader/lib/pageWordText";
import {
  startPhraseMicCapture,
  type MicCaptureHandle,
} from "@/features/quran-reader/lib/micAudioCapture";
import { matchRecitationSegment } from "@/features/quran-reader/lib/segmentMatch";
import { playWrongSound } from "@/features/quran-reader/lib/playWrongSound";
import { usePracticeModel } from "@/shared/hooks/use-practice-model";
import {
  getWhisperDtypeCandidates,
  PRACTICE_HIDE_AYAT_STORAGE_KEY,
  PRACTICE_WRONG_FLASH_MS,
} from "@/shared/constants/recitation-practice";
import { clearWhisperModelCache } from "@/shared/lib/clear-whisper-cache";
import type { MushafWord } from "@/shared/types/quran";

export type PracticePhase =
  | "preparing"
  | "loading-model"
  | "listening"
  | "completed";

export interface RecitationPracticeState {
  active: boolean;
  phase: PracticePhase;
  listening: boolean;
  loadingModel: boolean;
  modelProgress: number;
  isAnalyzing: boolean;
  isSpeaking: boolean;
  micLevel: number;
  currentWordLocation: string | null;
  lastTranscript: string;
  wrongFlashLocation: string | null;
  revealedLocations: string[];
  progressIndex: number;
  totalWords: number;
  completed: boolean;
  error: string | null;
}

interface RecitationPracticeContextValue extends RecitationPracticeState {
  hideAyat: boolean;
  toggleHideAyat: () => void;
  startPractice: (pageWords: MushafWord[]) => Promise<void>;
  stopPractice: () => void;
  togglePractice: (pageWords: MushafWord[]) => Promise<void>;
}

const initialState: RecitationPracticeState = {
  active: false,
  phase: "preparing",
  listening: false,
  loadingModel: false,
  modelProgress: 0,
  isAnalyzing: false,
  isSpeaking: false,
  micLevel: 0,
  currentWordLocation: null,
  lastTranscript: "",
  wrongFlashLocation: null,
  revealedLocations: [],
  progressIndex: 0,
  totalWords: 0,
  completed: false,
  error: null,
};

const RecitationPracticeContext =
  createContext<RecitationPracticeContextValue | null>(null);

function getCurrentWordLocation(
  expected: ExpectedPracticeWord[],
  pointer: number,
): string | null {
  if (pointer >= expected.length) return null;
  return expected[pointer]?.location ?? null;
}

function getRevealedLocations(
  expected: ExpectedPracticeWord[],
  pointer: number,
): string[] {
  return expected.slice(0, pointer).map((word) => word.location);
}

function readHideAyatPreference(): boolean {
  if (typeof localStorage === "undefined") return true;
  return localStorage.getItem(PRACTICE_HIDE_AYAT_STORAGE_KEY) !== "false";
}

export function RecitationPracticeProvider({ children }: { children: ReactNode }) {
  const { modelId } = usePracticeModel();
  const [state, setState] = useState<RecitationPracticeState>(initialState);
  const [hideAyat, setHideAyat] = useState(readHideAyatPreference);

  const workerRef = useRef<Worker | null>(null);
  const activeDtypeRef = useRef<string | null>(null);
  const micRef = useRef<MicCaptureHandle | null>(null);
  const expectedWordsRef = useRef<ExpectedPracticeWord[]>([]);
  const alignerRef = useRef<AlignerState>(createAlignerState());
  const pendingTranscribeRef = useRef<{
    audio: Float32Array;
    isFinal: boolean;
    generation: number;
  } | null>(null);
  const transcribeGenerationRef = useRef(0);
  const activeGenerationRef = useRef(0);
  const activeIsFinalRef = useRef(false);
  const modelReadyRef = useRef(false);
  const processingRef = useRef(false);
  const completedRef = useRef(false);
  const wrongFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const disposeWorker = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: "dispose" });
      workerRef.current.terminate();
      workerRef.current = null;
    }
    activeDtypeRef.current = null;
    modelReadyRef.current = false;
  }, []);

  const flashWrongWord = useCallback((location: string | null) => {
    if (wrongFlashTimerRef.current) {
      clearTimeout(wrongFlashTimerRef.current);
    }
    setState((prev) => ({ ...prev, wrongFlashLocation: location }));
    if (location) {
      wrongFlashTimerRef.current = setTimeout(() => {
        setState((prev) => ({ ...prev, wrongFlashLocation: null }));
        wrongFlashTimerRef.current = null;
      }, PRACTICE_WRONG_FLASH_MS);
    }
  }, []);

  const applySegmentResult = useCallback(
    (transcript: string, isFinal: boolean) => {
      const expected = expectedWordsRef.current;
      const pointer = alignerRef.current.pointer;
      const match = matchRecitationSegment(expected, pointer, transcript);
      const trimmedTranscript = transcript.trim();

      if (match.wrongAttempt) {
        if (!isFinal) {
          setState((prev) => ({
            ...prev,
            lastTranscript: trimmedTranscript,
          }));
          return;
        }

        playWrongSound();
        const nextWord = expected[pointer];
        flashWrongWord(nextWord?.location ?? null);
        setState((prev) => ({
          ...prev,
          isAnalyzing: false,
          lastTranscript: trimmedTranscript,
        }));
        return;
      }

      if (match.revealedLocations.length > 0) {
        alignerRef.current = { pointer: match.newPointer };
      }

      const done = isPracticeComplete(expected, alignerRef.current);
      if (done) {
        completedRef.current = true;
        micRef.current?.stop();
        micRef.current = null;
      }

      setState((prev) => ({
        ...prev,
        progressIndex: alignerRef.current.pointer,
        revealedLocations: getRevealedLocations(
          expected,
          alignerRef.current.pointer,
        ),
        currentWordLocation: getCurrentWordLocation(
          expected,
          alignerRef.current.pointer,
        ),
        completed: done,
        phase: done ? "completed" : "listening",
        listening: !done,
        isAnalyzing: false,
        lastTranscript: trimmedTranscript,
        wrongFlashLocation: null,
      }));
    },
    [flashWrongWord],
  );

  const drainTranscribeQueue = useCallback(() => {
    if (processingRef.current || !pendingTranscribeRef.current) return;
    if (!modelReadyRef.current || completedRef.current) return;

    const worker = workerRef.current;
    const dtype = activeDtypeRef.current;
    if (!worker || !dtype) return;

    const job = pendingTranscribeRef.current;
    pendingTranscribeRef.current = null;

    processingRef.current = true;
    activeGenerationRef.current = job.generation;
    activeIsFinalRef.current = job.isFinal;

    if (job.isFinal) {
      setState((prev) => ({ ...prev, isAnalyzing: true }));
    }

    worker.postMessage({
      type: "transcribe",
      modelId,
      dtype,
      audio: job.audio,
    });
  }, [modelId]);

  const scheduleTranscribe = useCallback(
    (audio: Float32Array, isFinal: boolean) => {
      if (completedRef.current) return;

      transcribeGenerationRef.current += 1;
      pendingTranscribeRef.current = {
        audio,
        isFinal,
        generation: transcribeGenerationRef.current,
      };
      drainTranscribeQueue();
    },
    [drainTranscribeQueue],
  );

  const attachWorkerHandlers = useCallback(
    (worker: Worker) => {
      worker.onmessage = (event: MessageEvent) => {
        const data = event.data as {
          type: string;
          progress?: number;
          status?: string;
          text?: string;
          message?: string;
          fatal?: boolean;
        };

        switch (data.type) {
          case "analyzing":
            setState((prev) => ({ ...prev, isAnalyzing: true }));
            break;
          case "progress":
            if (data.status === "loading") {
              setState((prev) => ({
                ...prev,
                phase: "loading-model",
                loadingModel: true,
                modelProgress: data.progress ?? prev.modelProgress,
              }));
            }
            break;
          case "ready":
            modelReadyRef.current = true;
            setState((prev) => ({
              ...prev,
              phase: "listening",
              loadingModel: false,
              modelProgress: 100,
              listening: true,
              error: null,
            }));
            break;
          case "result": {
            processingRef.current = false;
            const stale =
              transcribeGenerationRef.current > activeGenerationRef.current;
            if (!stale) {
              applySegmentResult(
                data.text?.trim() ?? "",
                activeIsFinalRef.current,
              );
            }
            drainTranscribeQueue();
            break;
          }
          case "error":
            processingRef.current = false;
            if (!data.fatal) {
              setState((prev) => ({
                ...prev,
                isAnalyzing: false,
                error: data.message ?? "خطأ في التعرف على الصوت",
              }));
            }
            drainTranscribeQueue();
            break;
          default:
            break;
        }
      };
    },
    [applySegmentResult, drainTranscribeQueue],
  );

  const loadModelInFreshWorker = useCallback(
    (id: string, dtype: string) =>
      new Promise<void>((resolve, reject) => {
        disposeWorker();

        const worker = new Worker(
          new URL("../workers/whisper.worker.ts", import.meta.url),
          { type: "module" },
        );

        worker.onmessage = (event: MessageEvent) => {
          const data = event.data as {
            type: string;
            progress?: number;
            status?: string;
            message?: string;
          };

          if (data.type === "progress" && data.status === "loading") {
            setState((prev) => ({
              ...prev,
              phase: "loading-model",
              loadingModel: true,
              modelProgress: data.progress ?? prev.modelProgress,
            }));
            return;
          }

          if (data.type === "ready") {
            workerRef.current = worker;
            activeDtypeRef.current = dtype;
            attachWorkerHandlers(worker);
            modelReadyRef.current = true;
            resolve();
            return;
          }

          if (data.type === "error") {
            worker.terminate();
            reject(new Error(data.message ?? "Whisper model load failed"));
          }
        };

        worker.postMessage({ type: "init", modelId: id, dtype });
      }),
    [attachWorkerHandlers, disposeWorker],
  );

  const initModel = useCallback(
    async (id: string) => {
      modelReadyRef.current = false;
      setState((prev) => ({
        ...prev,
        phase: "loading-model",
        loadingModel: true,
        modelProgress: 0,
        error: null,
      }));

      const dtypes = getWhisperDtypeCandidates(id);
      let lastError: Error | null = null;

      const tryAll = async (clearCache: boolean) => {
        if (clearCache) await clearWhisperModelCache();
        for (const dtype of dtypes) {
          try {
            await loadModelInFreshWorker(id, dtype);
            return true;
          } catch (error) {
            lastError =
              error instanceof Error
                ? error
                : new Error("Whisper model load failed");
            disposeWorker();
          }
        }
        return false;
      };

      if (await tryAll(false)) return;
      if (await tryAll(true)) return;

      throw (
        lastError ??
        new Error(
          "تعذر تحميل نموذج التعرف على الصوت. جرّب مسح ذاكرة النماذج من الإعدادات.",
        )
      );
    },
    [disposeWorker, loadModelInFreshWorker],
  );

  const startMic = useCallback(() => {
    if (micRef.current || completedRef.current) return;

    void startPhraseMicCapture({
      onPhrase: (audio) => scheduleTranscribe(audio, true),
      onRollingChunk: (audio) => scheduleTranscribe(audio, false),
      onSpeakingChange: (speaking) => {
        setState((prev) => ({ ...prev, isSpeaking: speaking }));
      },
      onLevelChange: (level) => {
        setState((prev) =>
          prev.micLevel === level ? prev : { ...prev, micLevel: level },
        );
      },
    }).then((mic) => {
      micRef.current = mic;
    });
  }, [scheduleTranscribe]);

  const stopPractice = useCallback(() => {
    micRef.current?.stop();
    micRef.current = null;
    processingRef.current = false;
    completedRef.current = false;
    pendingTranscribeRef.current = null;
    transcribeGenerationRef.current = 0;
    activeGenerationRef.current = 0;
    expectedWordsRef.current = [];
    alignerRef.current = createAlignerState();
    modelReadyRef.current = false;

    if (wrongFlashTimerRef.current) {
      clearTimeout(wrongFlashTimerRef.current);
      wrongFlashTimerRef.current = null;
    }

    disposeWorker();
    setState(initialState);
  }, [disposeWorker]);

  const startPractice = useCallback(
    async (pageWords: MushafWord[]) => {
      stopPractice();

      setState({ ...initialState, active: true, phase: "preparing" });

      try {
        const expected = await buildPageExpectedWords(pageWords);
        expectedWordsRef.current = expected;
        alignerRef.current = createAlignerState();
        completedRef.current = false;
        pendingTranscribeRef.current = null;
    transcribeGenerationRef.current = 0;
    activeGenerationRef.current = 0;

        setState((prev) => ({
          ...prev,
          phase: "loading-model",
          loadingModel: true,
          totalWords: expected.length,
          progressIndex: 0,
          currentWordLocation: getCurrentWordLocation(expected, 0),
          revealedLocations: [],
          lastTranscript: "",
          error: null,
        }));

        await initModel(modelId);

        setState((prev) => ({
          ...prev,
          phase: "listening",
          loadingModel: false,
          listening: true,
        }));
      } catch (error) {
        stopPractice();
        setState({
          ...initialState,
          error:
            error instanceof Error
              ? error.message
              : "تعذر بدء وضع التسميع",
        });
      }
    },
    [initModel, modelId, stopPractice],
  );

  useEffect(() => {
    if (!state.active || state.loadingModel || !modelReadyRef.current) return;
    if (state.completed || micRef.current) return;
    startMic();
  }, [state.active, state.loadingModel, state.completed, startMic]);

  const toggleHideAyat = useCallback(() => {
    setHideAyat((prev) => {
      const next = !prev;
      localStorage.setItem(PRACTICE_HIDE_AYAT_STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  const togglePractice = useCallback(
    async (pageWords: MushafWord[]) => {
      if (state.active) {
        stopPractice();
      } else {
        await startPractice(pageWords);
      }
    },
    [startPractice, state.active, stopPractice],
  );

  useEffect(() => () => stopPractice(), [stopPractice]);

  const value = useMemo(
    () => ({
      ...state,
      hideAyat,
      toggleHideAyat,
      startPractice,
      stopPractice,
      togglePractice,
    }),
    [state, hideAyat, toggleHideAyat, startPractice, stopPractice, togglePractice],
  );

  return (
    <RecitationPracticeContext.Provider value={value}>
      {children}
    </RecitationPracticeContext.Provider>
  );
}

export function useRecitationPractice() {
  const context = useContext(RecitationPracticeContext);
  if (!context) {
    throw new Error(
      "useRecitationPractice must be used within RecitationPracticeProvider",
    );
  }
  return context;
}
