import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  PracticeErrorCode,
  RecitationPracticeTelemetry,
  RecitationPracticeValue,
} from "@/features/recitation-practice/contract";
import {
  initialRecitationPracticeState,
  initialRecitationPracticeTelemetry,
  recitationPracticeReducer,
} from "@/features/recitation-practice/model/practiceState";
import {
  createAlignerState,
  isPracticeComplete,
  type AlignerState,
  type ExpectedPracticeWord,
} from "@/features/recitation-practice/model/constrainedWordAligner";
import {
  startPhraseMicCapture,
  type MicCaptureHandle,
} from "@/features/recitation-practice/services/micAudioCapture";
import { buildPageExpectedWords } from "@/features/recitation-practice/services/pageWordText";
import { playWrongSound } from "@/features/recitation-practice/services/playWrongSound";
import { matchRecitationSegment } from "@/features/recitation-practice/model/segmentMatch";
import {
  getWhisperDtypeCandidates,
  PRACTICE_HIDE_AYAT_STORAGE_KEY,
  PRACTICE_WRONG_FLASH_MS,
} from "@/features/recitation-practice/model/practiceConfig";
import { readPracticeModelPreference } from "@/features/recitation-practice/hooks/usePracticeModel";
import { clearWhisperModelCache } from "@/features/recitation-practice/services/clearWhisperModelCache";
import { safeStorage } from "@/shared/storage";
import type { MushafWord } from "@/domain/quran";

interface PendingTranscription {
  audio: Float32Array;
  isFinal: boolean;
  generation: number;
  sessionId: number;
}

interface WorkerMessage {
  type: string;
  progress?: number;
  status?: string;
  text?: string;
  message?: string;
  fatal?: boolean;
}

const RecitationPracticeContext = createContext<RecitationPracticeValue | null>(
  null,
);
const RecitationPracticeTelemetryContext =
  createContext<RecitationPracticeTelemetry | null>(null);

function getCurrentWordLocation(
  expected: ExpectedPracticeWord[],
  pointer: number,
): string | null {
  return expected[pointer]?.location ?? null;
}

function getRevealedLocations(
  expected: ExpectedPracticeWord[],
  pointer: number,
): string[] {
  return expected.slice(0, pointer).map((word) => word.location);
}

function readHideAyatPreference(): boolean {
  return safeStorage.getItem(PRACTICE_HIDE_AYAT_STORAGE_KEY) !== "false";
}

function abortError(): DOMException {
  return new DOMException("Practice startup was cancelled", "AbortError");
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function RecitationPracticeProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(
    recitationPracticeReducer,
    initialRecitationPracticeState,
  );
  const [telemetry, setTelemetry] = useState<RecitationPracticeTelemetry>(
    initialRecitationPracticeTelemetry,
  );
  const [hideAyat, setHideAyat] = useState(readHideAyatPreference);

  const workerRef = useRef<Worker | null>(null);
  const loadingWorkerRef = useRef<Worker | null>(null);
  const activeDtypeRef = useRef<string | null>(null);
  const activeModelIdRef = useRef<string | null>(null);
  const micRef = useRef<MicCaptureHandle | null>(null);
  const micStartAbortRef = useRef<AbortController | null>(null);
  const modelStartAbortRef = useRef<AbortController | null>(null);
  const sessionIdRef = useRef(0);
  const expectedWordsRef = useRef<ExpectedPracticeWord[]>([]);
  const alignerRef = useRef<AlignerState>(createAlignerState());
  const pendingTranscribeRef = useRef<PendingTranscription | null>(null);
  const transcribeGenerationRef = useRef(0);
  const activeTranscriptionRef = useRef<PendingTranscription | null>(null);
  const modelReadyRef = useRef(false);
  const processingRef = useRef(false);
  const completedRef = useRef(false);
  const wrongFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isCurrentSession = useCallback(
    (sessionId: number) => sessionIdRef.current === sessionId,
    [],
  );

  const disposeWorkers = useCallback(() => {
    const workers = new Set(
      [workerRef.current, loadingWorkerRef.current].filter(
        (worker): worker is Worker => worker !== null,
      ),
    );
    for (const worker of workers) {
      worker.onmessage = null;
      worker.onerror = null;
      worker.postMessage({ type: "dispose" });
      worker.terminate();
    }
    workerRef.current = null;
    loadingWorkerRef.current = null;
    activeDtypeRef.current = null;
    activeModelIdRef.current = null;
    modelReadyRef.current = false;
  }, []);

  const releaseSessionResources = useCallback(() => {
    modelStartAbortRef.current?.abort();
    modelStartAbortRef.current = null;
    micStartAbortRef.current?.abort();
    micStartAbortRef.current = null;
    micRef.current?.stop();
    micRef.current = null;
    disposeWorkers();

    if (wrongFlashTimerRef.current) {
      clearTimeout(wrongFlashTimerRef.current);
      wrongFlashTimerRef.current = null;
    }

    processingRef.current = false;
    completedRef.current = false;
    pendingTranscribeRef.current = null;
    activeTranscriptionRef.current = null;
    transcribeGenerationRef.current = 0;
    expectedWordsRef.current = [];
    alignerRef.current = createAlignerState();
  }, [disposeWorkers]);

  const stopPractice = useCallback(() => {
    sessionIdRef.current += 1;
    releaseSessionResources();
    setTelemetry(initialRecitationPracticeTelemetry);
    dispatch({ type: "reset" });
  }, [releaseSessionResources]);

  const applySegmentResult = useCallback(
    (transcript: string, isFinal: boolean, sessionId: number) => {
      if (!isCurrentSession(sessionId)) return;

      const expected = expectedWordsRef.current;
      const pointer = alignerRef.current.pointer;
      const match = matchRecitationSegment(expected, pointer, transcript);
      const trimmedTranscript = transcript.trim();

      if (match.wrongAttempt) {
        if (!isFinal) {
          dispatch({
            type: "transcript-observed",
            transcript: trimmedTranscript,
          });
          return;
        }

        playWrongSound();
        const location = expected[pointer]?.location ?? null;
        dispatch({
          type: "wrong-attempt",
          transcript: trimmedTranscript,
          location,
        });
        if (wrongFlashTimerRef.current) {
          clearTimeout(wrongFlashTimerRef.current);
        }
        if (location) {
          wrongFlashTimerRef.current = setTimeout(() => {
            if (isCurrentSession(sessionId)) {
              dispatch({ type: "clear-wrong-flash" });
            }
            wrongFlashTimerRef.current = null;
          }, PRACTICE_WRONG_FLASH_MS);
        }
        return;
      }

      if (match.revealedLocations.length > 0) {
        alignerRef.current = { pointer: match.newPointer };
      }

      const done = isPracticeComplete(expected, alignerRef.current);
      if (done) {
        completedRef.current = true;
        micStartAbortRef.current?.abort();
        micRef.current?.stop();
        micRef.current = null;
        disposeWorkers();
        setTelemetry(initialRecitationPracticeTelemetry);
      }

      dispatch({
        type: "progress-advanced",
        progressIndex: alignerRef.current.pointer,
        revealedLocations: getRevealedLocations(
          expected,
          alignerRef.current.pointer,
        ),
        currentWordLocation: getCurrentWordLocation(
          expected,
          alignerRef.current.pointer,
        ),
        transcript: trimmedTranscript,
        completed: done,
      });
    },
    [disposeWorkers, isCurrentSession],
  );

  const drainTranscribeQueue = useCallback(() => {
    if (processingRef.current || !pendingTranscribeRef.current) return;
    if (!modelReadyRef.current || completedRef.current) return;

    const worker = workerRef.current;
    const dtype = activeDtypeRef.current;
    const modelId = activeModelIdRef.current;
    if (!worker || !dtype || !modelId) return;

    const job = pendingTranscribeRef.current;
    if (!isCurrentSession(job.sessionId)) {
      pendingTranscribeRef.current = null;
      return;
    }
    pendingTranscribeRef.current = null;
    activeTranscriptionRef.current = job;
    processingRef.current = true;

    if (job.isFinal) dispatch({ type: "analysis-started" });
    worker.postMessage({
      type: "transcribe",
      modelId,
      dtype,
      audio: job.audio,
    });
  }, [isCurrentSession]);

  const scheduleTranscribe = useCallback(
    (audio: Float32Array, isFinal: boolean, sessionId: number) => {
      if (!isCurrentSession(sessionId) || completedRef.current) return;

      transcribeGenerationRef.current += 1;
      pendingTranscribeRef.current = {
        audio,
        isFinal,
        generation: transcribeGenerationRef.current,
        sessionId,
      };
      drainTranscribeQueue();
    },
    [drainTranscribeQueue, isCurrentSession],
  );

  const attachWorkerHandlers = useCallback(
    (worker: Worker, sessionId: number) => {
      worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
        if (!isCurrentSession(sessionId) || workerRef.current !== worker)
          return;
        const data = event.data;

        switch (data.type) {
          case "analyzing":
            dispatch({ type: "analysis-started" });
            break;
          case "result": {
            processingRef.current = false;
            const activeJob = activeTranscriptionRef.current;
            activeTranscriptionRef.current = null;
            const stale =
              !activeJob ||
              transcribeGenerationRef.current > activeJob.generation;
            if (!stale && activeJob) {
              applySegmentResult(
                data.text?.trim() ?? "",
                activeJob.isFinal,
                activeJob.sessionId,
              );
            }
            drainTranscribeQueue();
            break;
          }
          case "error":
            processingRef.current = false;
            activeTranscriptionRef.current = null;
            dispatch({
              type: "recognition-error",
              error: "recognition",
            });
            if (!data.fatal) drainTranscribeQueue();
            break;
          default:
            break;
        }
      };

      worker.onerror = () => {
        if (!isCurrentSession(sessionId) || workerRef.current !== worker)
          return;
        processingRef.current = false;
        activeTranscriptionRef.current = null;
        dispatch({
          type: "recognition-error",
          error: "workerUnavailable",
        });
      };
    },
    [applySegmentResult, drainTranscribeQueue, isCurrentSession],
  );

  const loadModelInFreshWorker = useCallback(
    (id: string, dtype: string, sessionId: number, signal: AbortSignal) =>
      new Promise<void>((resolve, reject) => {
        disposeWorkers();
        if (signal.aborted || !isCurrentSession(sessionId)) {
          reject(abortError());
          return;
        }

        const worker = new Worker(
          new URL("../workers/whisper.worker.ts", import.meta.url),
          { type: "module" },
        );
        loadingWorkerRef.current = worker;
        let settled = false;

        const cleanupInitListeners = () => {
          signal.removeEventListener("abort", handleAbort);
          worker.onerror = null;
        };
        const fail = (error: unknown) => {
          if (settled) return;
          settled = true;
          cleanupInitListeners();
          if (loadingWorkerRef.current === worker) {
            loadingWorkerRef.current = null;
          }
          worker.onmessage = null;
          worker.terminate();
          reject(
            error instanceof Error
              ? error
              : new Error("Whisper model load failed"),
          );
        };
        const handleAbort = () => fail(abortError());

        signal.addEventListener("abort", handleAbort, { once: true });
        worker.onerror = () => fail(new Error("Whisper worker failed"));
        worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
          if (!isCurrentSession(sessionId)) {
            fail(abortError());
            return;
          }
          const data = event.data;
          if (data.type === "progress" && data.status === "loading") {
            dispatch({
              type: "model-progress",
              progress: data.progress ?? 0,
            });
            return;
          }
          if (data.type === "ready") {
            if (settled) return;
            settled = true;
            cleanupInitListeners();
            loadingWorkerRef.current = null;
            workerRef.current = worker;
            activeDtypeRef.current = dtype;
            activeModelIdRef.current = id;
            modelReadyRef.current = true;
            attachWorkerHandlers(worker, sessionId);
            resolve();
            return;
          }
          if (data.type === "error") {
            fail(new Error(data.message ?? "Whisper model load failed"));
          }
        };

        worker.postMessage({ type: "init", modelId: id, dtype });
      }),
    [attachWorkerHandlers, disposeWorkers, isCurrentSession],
  );

  const initModel = useCallback(
    async (id: string, sessionId: number, signal: AbortSignal) => {
      const dtypes = getWhisperDtypeCandidates(id);
      let lastError: Error | null = null;

      const tryAll = async (clearCache: boolean) => {
        if (clearCache) {
          await clearWhisperModelCache();
          if (signal.aborted || !isCurrentSession(sessionId)) {
            throw abortError();
          }
        }

        for (const dtype of dtypes) {
          if (signal.aborted || !isCurrentSession(sessionId)) {
            throw abortError();
          }
          try {
            await loadModelInFreshWorker(id, dtype, sessionId, signal);
            return true;
          } catch (error) {
            if (isAbortError(error)) throw error;
            lastError =
              error instanceof Error
                ? error
                : new Error("Whisper model load failed");
          }
        }
        return false;
      };

      if (await tryAll(false)) return;
      if (await tryAll(true)) return;
      throw lastError ?? new Error("تعذر تحميل نموذج التعرف على الصوت");
    },
    [isCurrentSession, loadModelInFreshWorker],
  );

  const startMic = useCallback(
    async (sessionId: number) => {
      if (
        micRef.current ||
        completedRef.current ||
        !isCurrentSession(sessionId)
      ) {
        return;
      }

      const controller = new AbortController();
      micStartAbortRef.current?.abort();
      micStartAbortRef.current = controller;

      try {
        const mic = await startPhraseMicCapture(
          {
            onPhrase: (audio) => scheduleTranscribe(audio, true, sessionId),
            onRollingChunk: (audio) =>
              scheduleTranscribe(audio, false, sessionId),
            onSpeakingChange: (isSpeaking) => {
              if (!isCurrentSession(sessionId)) return;
              setTelemetry((current) =>
                current.isSpeaking === isSpeaking
                  ? current
                  : { ...current, isSpeaking },
              );
            },
            onLevelChange: (micLevel) => {
              if (!isCurrentSession(sessionId)) return;
              setTelemetry((current) =>
                current.micLevel === micLevel
                  ? current
                  : { ...current, micLevel },
              );
            },
          },
          { signal: controller.signal },
        );

        if (!isCurrentSession(sessionId) || controller.signal.aborted) {
          mic.stop();
          return;
        }
        micRef.current = mic;
      } finally {
        if (micStartAbortRef.current === controller) {
          micStartAbortRef.current = null;
        }
      }
    },
    [isCurrentSession, scheduleTranscribe],
  );

  const startPractice = useCallback(
    async (pageWords: MushafWord[]) => {
      sessionIdRef.current += 1;
      releaseSessionResources();
      setTelemetry(initialRecitationPracticeTelemetry);
      const sessionId = sessionIdRef.current;
      dispatch({ type: "start" });
      let startStage: "words" | "no-words" | "model" | "microphone" = "words";

      try {
        const expected = await buildPageExpectedWords(pageWords);
        if (!isCurrentSession(sessionId)) return;
        if (expected.length === 0) {
          startStage = "no-words";
          throw new Error("No practice words are available on this page");
        }

        expectedWordsRef.current = expected;
        alignerRef.current = createAlignerState();
        completedRef.current = false;
        dispatch({
          type: "expected-words-ready",
          totalWords: expected.length,
          currentWordLocation: getCurrentWordLocation(expected, 0),
        });

        startStage = "model";
        const modelController = new AbortController();
        modelStartAbortRef.current = modelController;
        await initModel(
          readPracticeModelPreference(),
          sessionId,
          modelController.signal,
        );
        if (!isCurrentSession(sessionId) || modelController.signal.aborted)
          return;
        modelStartAbortRef.current = null;

        dispatch({ type: "listening" });
        startStage = "microphone";
        await startMic(sessionId);
      } catch (error) {
        if (!isCurrentSession(sessionId) || isAbortError(error)) return;
        sessionIdRef.current += 1;
        releaseSessionResources();
        setTelemetry(initialRecitationPracticeTelemetry);
        let errorCode: PracticeErrorCode = "startFailed";
        if (error instanceof DOMException && error.name === "NotAllowedError") {
          errorCode = "microphonePermission";
        } else if (startStage === "no-words") {
          errorCode = "noWords";
        } else if (startStage === "words") {
          errorCode = "wordDataLoad";
        } else if (startStage === "model") {
          errorCode = "modelLoad";
        } else if (startStage === "microphone") {
          errorCode = "microphoneStart";
        }
        dispatch({ type: "reset", error: errorCode });
      }
    },
    [initModel, isCurrentSession, releaseSessionResources, startMic],
  );

  const toggleHideAyat = useCallback(() => {
    setHideAyat((current) => {
      const next = !current;
      safeStorage.setItem(PRACTICE_HIDE_AYAT_STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  const togglePractice = useCallback(
    async (pageWords: MushafWord[]) => {
      if (state.active) stopPractice();
      else await startPractice(pageWords);
    },
    [startPractice, state.active, stopPractice],
  );

  useEffect(
    () => () => {
      sessionIdRef.current += 1;
      releaseSessionResources();
    },
    [releaseSessionResources],
  );

  const value = useMemo<RecitationPracticeValue>(
    () => ({
      ...state,
      hideAyat,
      toggleHideAyat,
      startPractice,
      stopPractice,
      togglePractice,
    }),
    [
      state,
      hideAyat,
      toggleHideAyat,
      startPractice,
      stopPractice,
      togglePractice,
    ],
  );

  return (
    <RecitationPracticeContext.Provider value={value}>
      <RecitationPracticeTelemetryContext.Provider value={telemetry}>
        {children}
      </RecitationPracticeTelemetryContext.Provider>
    </RecitationPracticeContext.Provider>
  );
}

export function useRecitationPractice(): RecitationPracticeValue {
  const context = useContext(RecitationPracticeContext);
  if (!context) {
    throw new Error(
      "useRecitationPractice must be used within RecitationPracticeProvider",
    );
  }
  return context;
}

export function useRecitationPracticeTelemetry(): RecitationPracticeTelemetry {
  const context = useContext(RecitationPracticeTelemetryContext);
  if (!context) {
    throw new Error(
      "useRecitationPracticeTelemetry must be used within RecitationPracticeProvider",
    );
  }
  return context;
}
