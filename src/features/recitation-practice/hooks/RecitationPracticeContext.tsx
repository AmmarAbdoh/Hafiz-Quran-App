import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import type {
  MisreadWord,
  PracticeErrorCode,
  RecitationPracticeProviderProps,
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
import {
  playWrongSound,
  WRONG_SOUND_MS,
} from "@/features/recitation-practice/services/playWrongSound";
import { matchRecitationSegment } from "@/features/recitation-practice/model/segmentMatch";
import {
  phonemesAsLetters,
  whatWasHeard,
} from "@/features/recitation-practice/model/phonemeText";
import {
  WHISPER_DTYPE_CANDIDATES,
  isStreamingPracticeModel,
  PRACTICE_DEBUG_STORAGE_KEY,
  PRACTICE_HIDE_AYAT_STORAGE_KEY,
  PRACTICE_SAMPLE_RATE,
  PRACTICE_STOP_ON_MISTAKE_STORAGE_KEY,
  PRACTICE_WRONG_FLASH_MS,
  VERDICT_TIMEOUT_MS,
} from "@/features/recitation-practice/model/practiceConfig";
import { readPracticeModelPreference } from "@/features/recitation-practice/hooks/usePracticeModel";
import { clearWhisperModelCache } from "@/features/recitation-practice/services/clearWhisperModelCache";
import { takeModelReload } from "@/features/recitation-practice/services/modelReload";
import { readPracticeStrictPreference } from "@/features/recitation-practice/hooks/usePracticeStrictMode";
import {
  saveRecording,
  type RecordingMeta,
} from "@/features/recitation-practice/services/captureRecording";
import {
  findMisreadWords,
  STRICT_WEAK_WORDS_TOLERATED,
  stoppedShort,
  WEAK_WORDS_TOLERATED,
} from "@/features/recitation-practice/model/practiceVerdict";
import { buildPageSpokenWords } from "@/features/recitation-practice/services/spokenWords";
import type { ScorableWord } from "@/features/recitation-practice/model/wordPhonemes";
import {
  startZipformer,
  type ZipformerEngine,
} from "@/features/recitation-practice/services/zipformerEngine";
import {
  advanceTracker,
  createPhonemeTracker,
  giveUpOnHeldWord,
  heldWord,
  holdAt,
  recitedSpan,
  releaseHold,
} from "@/features/recitation-practice/model/phonemeProgress";
import type { PhonemeEmission } from "@/features/recitation-practice/model/ctcGreedy";
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

/**
 * On unless turned off: being told which word was wrong is the help.
 *
 * Defaulting it off silently took the sound and the revealed word away from
 * every reader already on a Whisper model, where they had been unconditional.
 * Stored "false" is the only answer that turns it off, so nobody who chose
 * that has it put back.
 */
function readStopOnMistakePreference(): boolean {
  return safeStorage.getItem(PRACTICE_STOP_ON_MISTAKE_STORAGE_KEY) !== "false";
}

/** Off unless asked for: it is a diagnostic, and it reads as nonsense. */
function readShowDebugPreference(): boolean {
  return safeStorage.getItem(PRACTICE_DEBUG_STORAGE_KEY) === "true";
}

/** Enough heard phonemes to recognise a word or two, and no more. */
const HEARD_PHONEMES_KEPT = 16;

/**
 * Page words covered by these spoken words.
 *
 * Progress and the summary count what the reader sees, not the units the
 * recogniser follows: tajweed joins several page words into one sound in
 * most ayat, so "4 words of 3" was what counting both ways side by side
 * could produce.
 */
function pageWordCount(words: readonly ScorableWord[]): number {
  return new Set(words.flatMap((word) => word.locations)).size;
}

function abortError(): DOMException {
  return new DOMException("Practice startup was cancelled", "AbortError");
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function RecitationPracticeProvider({
  children,
}: RecitationPracticeProviderProps) {
  const [state, dispatch] = useReducer(
    recitationPracticeReducer,
    initialRecitationPracticeState,
  );
  const [telemetry, setTelemetry] = useState<RecitationPracticeTelemetry>(
    initialRecitationPracticeTelemetry,
  );
  const [hideAyat, setHideAyat] = useState(readHideAyatPreference);
  const [stopOnMistake, setStopOnMistake] = useState(
    readStopOnMistakePreference,
  );
  const [showDebug, setShowDebug] = useState(readShowDebugPreference);
  // Read inside the audio callback, which does not re-subscribe to state.
  const showDebugRef = useRef(showDebug);
  showDebugRef.current = showDebug;
  // Read inside the audio callback, which does not re-subscribe to state.
  const stopOnMistakeRef = useRef(stopOnMistake);
  stopOnMistakeRef.current = stopOnMistake;

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
  /** Every word misread so far in this run, in the order they were passed. */
  const misreadRef = useRef<MisreadWord[]>([]);
  const pendingTranscribeRef = useRef<PendingTranscription | null>(null);
  const transcribeGenerationRef = useRef(0);
  const activeTranscriptionRef = useRef<PendingTranscription | null>(null);
  const modelReadyRef = useRef(false);
  const processingRef = useRef(false);
  const completedRef = useRef(false);
  /**
   * Whether the recogniser emitted anything at all this run.
   *
   * Separates "nobody spoke" from "they spoke and were not recognised",
   * which look identical from the tracker alone and want opposite answers.
   * See `finishPractice`.
   */
  const heardPhonemesRef = useRef(false);
  /**
   * The verdict is on screen and must not be taken off it.
   *
   * `completedRef` cannot answer this: it is set when the verdict is asked
   * for, which is also the window in which pressing stop must *not* throw
   * the run away. One says "scoring has begun", this one says "it is done".
   */
  const verdictAppliedRef = useRef(false);
  /*
   * What a recorded run is made of, gathered only in development.
   *
   * `import.meta.env.DEV` is a constant the bundler folds away, so none of
   * this is kept - or even reachable - in a production build.
   */
  const capturedAudioRef = useRef<Float32Array[]>([]);
  const capturedHeardRef = useRef<[string, number, number][]>([]);
  const capturedHeldRef = useRef<{ locations: string[]; ms: number }[]>([]);
  const cursorHeldRef = useRef({ wordIndex: 0, since: 0 });
  const lastRunRef = useRef<RecordingMeta | null>(null);
  /** What the last progress dispatch said, so an unchanged one is skipped. */
  const lastDispatchedRef = useRef<{
    progressIndex: number;
    currentWordLocation: string | null;
    revealedLocations: string[];
    misreadWords: MisreadWord[];
    heldAtLocation: string | null;
  } | null>(null);
  const wrongFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * The verdict was asked for and has not arrived; see `VERDICT_TIMEOUT_MS`.
   *
   * Without it a recogniser that never answers leaves the run in the one
   * state both stop buttons refuse to act on - scoring has begun, so there is
   * a verdict to wait for, and `finishPractice` steps aside for it. The
   * reader is left with a bar that says it is checking, for good.
   */
  const verdictTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /*
   * Outlives the run it was loaded for, so reciting again or moving to the
   * next page reuses the session instead of fetching the model again. Each
   * run starts it afresh with `begin`.
   */
  const zipformerRef = useRef<ZipformerEngine | null>(null);
  /** Set by "download the model again": the next load skips cached copies. */
  const reloadModelRef = useRef(false);
  /** The spoken words the pending verdict covers. */
  const scoredSpanRef = useRef<{ from: number; to: number } | null>(null);
  const trackerRef = useRef<ReturnType<typeof createPhonemeTracker> | null>(
    null,
  );
  const revealedRef = useRef<string[]>([]);
  /** Words the cursor saw the reciter go past; see `advanceTracker`. */
  const skippedRef = useRef<Set<string>>(new Set());
  /**
   * Words something else was said at, and what that was.
   *
   * The reason this is kept rather than used and dropped: a word fumbled and
   * then recited correctly scores well, because the correct attempt is in
   * the audio and the alignment uses it - so the verdict has nothing against
   * it and the run comes back clean. That is what "it said I got nothing
   * wrong, but I did" is. The cursor is the only thing that saw it happen,
   * and only at the moment it happened, so what it saw is kept here.
   *
   * The first attempt at a word wins: a reciter who stalls twice on the same
   * word gets one entry, and the earliest is the one that says what they
   * reached for before they found it.
   */
  const stumbleRef = useRef(new Map<string, string[]>());
  /**
   * Words the reader said they could not say.
   *
   * The surest thing in the summary, and the only entry the reader reports
   * themselves: every other reason a word is listed is inferred from the
   * audio. Kept for the same reason the stumbles are - the verdict rebuilds
   * its list from the scores, which know nothing about this.
   */
  const gaveUpRef = useRef(new Set<string>());
  const spokenRef = useRef<ScorableWord[]>([]);
  const wordTextRef = useRef(
    new Map<string, { verseKey: string; text: string }>(),
  );

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
    if (verdictTimerRef.current) {
      clearTimeout(verdictTimerRef.current);
      verdictTimerRef.current = null;
    }

    processingRef.current = false;
    completedRef.current = false;
    verdictAppliedRef.current = false;
    lastDispatchedRef.current = null;
    capturedAudioRef.current = [];
    capturedHeardRef.current = [];
    capturedHeldRef.current = [];
    cursorHeldRef.current = { wordIndex: 0, since: performance.now() };
    lastRunRef.current = null;
    pendingTranscribeRef.current = null;
    activeTranscriptionRef.current = null;
    transcribeGenerationRef.current = 0;
    expectedWordsRef.current = [];
    alignerRef.current = createAlignerState();
    misreadRef.current = [];
    scoredSpanRef.current = null;
    trackerRef.current = null;
    revealedRef.current = [];
    skippedRef.current = new Set();
    stumbleRef.current = new Map();
    gaveUpRef.current = new Set();
    heardPhonemesRef.current = false;
    spokenRef.current = [];
    wordTextRef.current = new Map();
  }, [disposeWorkers]);

  const disposeEngine = useCallback(() => {
    zipformerRef.current?.stop();
    zipformerRef.current = null;
  }, []);

  const stopPractice = useCallback(() => {
    sessionIdRef.current += 1;
    releaseSessionResources();
    setTelemetry(initialRecitationPracticeTelemetry);
    dispatch({ type: "reset" });
  }, [releaseSessionResources]);

  /**
   * End the run and say why.
   *
   * Through `reset`, which is the only action that carries an error past the
   * end of a run. Dispatching the error and then stopping wiped it in the same
   * batch, so a recogniser that crashed mid-run simply vanished from the page.
   */
  const failPractice = useCallback(
    (error: PracticeErrorCode, detail?: string) => {
      sessionIdRef.current += 1;
      releaseSessionResources();
      setTelemetry(initialRecitationPracticeTelemetry);
      dispatch({ type: "reset", error, detail });
    },
    [releaseSessionResources],
  );

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

        /*
         * The toggle governs the correction here too.
         *
         * The streaming path checks it before sounding and showing the word;
         * this one did neither, so a reader who had turned "stop on mistake"
         * off still got the sound and the flash on every wrong word.
         */
        if (!stopOnMistakeRef.current) {
          dispatch({
            type: "transcript-observed",
            transcript: trimmedTranscript,
          });
          return;
        }

        playWrongSound();
        micRef.current?.muteFor(WRONG_SOUND_MS + 120);
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
      /*
       * Kept for the whole run, not just this phrase: the point is to leave
       * the reader a page with every word that needs work still marked.
       */
      for (const location of match.wrongLocations) {
        if (misreadRef.current.some((word) => word.location === location)) {
          continue;
        }
        const word = expected.find((item) => item.location === location);
        if (!word) continue;
        misreadRef.current = [
          ...misreadRef.current,
          {
            location,
            verseKey: word.verseKey,
            text: word.displayText,
            /* Whisper transcribes a whole phrase, so there is no telling
               which of its words stood where this one should have - only
               that the phrase did not contain it. */
            heard: { kind: "unclear" },
          },
        ];
      }

      const done = isPracticeComplete(expected, alignerRef.current);
      if (done) {
        completedRef.current = true;
        verdictAppliedRef.current = true;
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
        misreadWords: misreadRef.current,
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
              detail: data.message,
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
      const dtypes = WHISPER_DTYPE_CANDIDATES;
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

  /**
   * The verdict, once the whole recitation can be looked at.
   *
   * `findMisreadWords` holds the rule and the measurements behind it; this
   * only feeds it the alignment scores alongside what the cursor saw, and
   * turns the answer back into page locations.
   */
  const applyWordScores = useCallback(
    (scores: number[], heardPerWord: string[][], sessionId: number) => {
      if (!isCurrentSession(sessionId)) return;
      if (verdictTimerRef.current) {
        clearTimeout(verdictTimerRef.current);
        verdictTimerRef.current = null;
      }
      const span = scoredSpanRef.current;
      const judged = span ? spokenRef.current.slice(span.from, span.to) : [];
      /*
       * Scores that do not line up with what was asked about cannot be
       * trusted to mark the right words - and marking none would report a
       * clean recitation that nobody checked, which is the one answer a
       * memorization helper must never give by accident.
       */
      if (!span || judged.length === 0 || scores.length !== judged.length) {
        failPractice("verdictFailed");
        return;
      }

      const scored = judged.map((word, index) => ({
        ayah: word.locations[0]?.split(":").slice(0, 2).join(":") ?? "",
        score: scores[index]!,
        skipped: word.locations.some((location) =>
          skippedRef.current.has(location),
        ),
      }));

      const misread: MisreadWord[] = [];
      /* Read now rather than held in state: the switch for it lives in
         Settings, which is not inside this provider. */
      const strict = readPracticeStrictPreference();
      const tolerated = strict
        ? STRICT_WEAK_WORDS_TOLERATED
        : WEAK_WORDS_TOLERATED;

      /*
       * The words the reader said they could not say, before anything the
       * audio is asked about: a given-up word may also score badly, and
       * "you told us you were stuck here" is the truer reason of the two.
       */
      for (const location of gaveUpRef.current) {
        const known = wordTextRef.current.get(location);
        if (!known) continue;
        misread.push({
          location,
          verseKey: known.verseKey,
          text: known.text,
          heard: { kind: "gaveUp" },
        });
      }

      for (const index of findMisreadWords(scored, undefined, tolerated)) {
        for (const location of judged[index]!.locations) {
          if (misread.some((word) => word.location === location)) continue;
          const known = wordTextRef.current.get(location);
          if (!known) continue;
          misread.push({
            location,
            verseKey: known.verseKey,
            text: known.text,
            /* One spoken word can cover several of the page's, tajweed
               running them together, and the alignment scores the pair as
               one - so both carry the same reading of what was heard. */
            heard: whatWasHeard(
              judged[index]!.units,
              heardPerWord[index] ?? [],
            ),
          });
        }
      }

      /*
       * And the words they got wrong and then got right.
       *
       * Invisible to everything above: both attempts are in the audio, the
       * alignment uses the good one, and the word scores well. Listing them
       * is the answer to "it says I got nothing wrong, but I did" - the
       * recitation stopped and went back, which the cursor saw and nothing
       * else did.
       */
      for (const [location, stumbled] of stumbleRef.current) {
        if (misread.some((word) => word.location === location)) continue;
        const known = wordTextRef.current.get(location);
        if (!known) continue;
        misread.push({
          location,
          verseKey: known.verseKey,
          text: known.text,
          heard: { kind: "stumble", letters: phonemesAsLetters(stumbled) },
        });
      }
      /* Page order, so the list reads the way the page does: the stumbles
         were appended after words that may come later than they do. */
      const order = [...wordTextRef.current.keys()];
      misread.sort(
        (a, b) => order.indexOf(a.location) - order.indexOf(b.location),
      );

      misreadRef.current = misread;
      /*
       * How far they got, against the page - not against what was judged.
       *
       * Reporting the judged stretch as the total made every abandoned run a
       * complete one: three words of a hundred and twenty showed as 100% and
       * a clean page, which is the one answer this feature must never give
       * by accident. Measured, it was the whole of how `stopped-early` is
       * caught: 6 of 501 such clips are caught by marking words, 496 by
       * noticing the end was never reached.
       */
      verdictAppliedRef.current = true;
      if (import.meta.env.DEV) {
        const keys = new Set<string>();
        for (const word of spokenRef.current) {
          for (const location of word.locations) {
            keys.add(location.split(":").slice(0, 2).join(":"));
          }
        }
        lastRunRef.current = {
          verseKeys: [...keys],
          expected: spokenRef.current.map((word) => ({
            locations: word.locations,
            units: word.units,
          })),
          /*
           * What was recited, not where the cursor stopped.
           *
           * Counting from the first word of the page credited everything
           * before the reciter started: someone who opened halfway down and
           * carried on to the last word showed 100% of a page they had
           * recited half of. The bar and the summary both read this.
           */
          progressIndex: pageWordCount(
            spokenRef.current.slice(span.from, span.to),
          ),
          totalWords: pageWordCount(spokenRef.current),
          stoppedShort: stoppedShort(spokenRef.current.length, span),
          misreadLocations: misread.map((word) => word.location),
          skippedLocations: [...skippedRef.current],
          stumbles: [...stumbleRef.current].map(([location, heardAt]) => ({
            location,
            heard: heardAt,
          })),
          held: capturedHeldRef.current,
          heard: capturedHeardRef.current,
          strictMode: strict,
          recordedAt: new Date().toISOString(),
          note: "",
        };
      }
      dispatch({
        type: "progress-advanced",
        progressIndex: pageWordCount(
          spokenRef.current.slice(span.from, span.to),
        ),
        revealedLocations: revealedRef.current,
        misreadWords: misread,
        currentWordLocation: null,
        transcript: "",
        completed: true,
        stoppedShort: stoppedShort(spokenRef.current.length, span),
      });
    },
    [failPractice, isCurrentSession],
  );

  /**
   * The run is over: judge what was recited, or say that nothing was.
   *
   * Only the stretch the reciter covered is sent. Words they never reached
   * are not misread, and asking about them anyway is what marked a page red
   * from the first unreached word to the last.
   */
  const requestVerdict = useCallback(() => {
    /* Captured now, so a later run's verdict cannot be failed by this one's
       timer - and this one's cannot outlive being stopped. */
    const sessionId = sessionIdRef.current;
    completedRef.current = true;
    micStartAbortRef.current?.abort();
    micRef.current?.stop();
    micRef.current = null;
    setTelemetry(initialRecitationPracticeTelemetry);

    const tracker = trackerRef.current;
    const span = tracker ? recitedSpan(tracker) : null;
    const engine = zipformerRef.current;
    if (!span || !engine) {
      failPractice("nothingHeard");
      return;
    }
    /*
     * The verdict is not in yet, so the run is not completed: completing here
     * would open the summary on an empty list and fill it a moment later,
     * which is the same "you were fine - no wait" two judges used to produce.
     */
    scoredSpanRef.current = span;
    dispatch({ type: "analysis-started" });
    engine.score(span);
    /*
     * And a limit on waiting for it.
     *
     * Measured, a page takes 5.2s at the median and 23s at the worst, so this
     * is long enough that a slow phone is never cut off - and it is not a
     * performance budget. It is the difference between a recogniser that dies
     * silently and a run the reader cannot end: once scoring has begun both
     * stop buttons stand aside for the verdict, so a verdict that never
     * arrives takes the only two ways out with it.
     */
    if (verdictTimerRef.current) clearTimeout(verdictTimerRef.current);
    verdictTimerRef.current = setTimeout(() => {
      verdictTimerRef.current = null;
      if (!isCurrentSession(sessionId) || verdictAppliedRef.current) return;
      failPractice("verdictFailed");
    }, VERDICT_TIMEOUT_MS);
  }, [failPractice, isCurrentSession]);

  /**
   * Show the word the run is held at, without letting it move past.
   *
   * Reading it is the help; the hold stays, because the point is still to
   * recite it. A word joined to its neighbour by tajweed is shown whole -
   * revealing half of one leaves a blank beside a word, which reads as the
   * page having lost its place.
   */
  const revealHeldWord = useCallback(() => {
    /* The run is being scored, or is scored: nothing is held at a word any
       more, and the summary is what the reader is looking at. */
    if (completedRef.current) return;
    const tracker = trackerRef.current;
    const held = tracker ? heldWord(tracker) : null;
    if (!held) return;
    const reveal = held.filter(
      (location) => !revealedRef.current.includes(location),
    );
    if (reveal.length === 0) return;
    revealedRef.current = [...revealedRef.current, ...reveal];
    dispatch({
      type: "held-word-revealed",
      revealedLocations: revealedRef.current,
    });
  }, []);

  /**
   * Give up on the held word and carry on past it.
   *
   * This has to exist. The recogniser does drop a phoneme a learner really
   * said - one Fatihah into a real microphone stalled five times on a م
   * every professional reciter in the bench says clearly - and without a way
   * out, asking to be stopped would make the feature a trap whose only exit
   * is abandoning the page.
   *
   * It is recorded as given up on rather than merely skipped, which is the
   * best evidence in the whole summary: the reader said so themselves.
   */
  const skipHeldWord = useCallback(() => {
    /*
     * Not once the verdict has been asked for.
     *
     * The prompt is still on screen while a long page is scored, and pressing
     * this moved the cursor, dispatched `completed: false` over a run that was
     * finishing, and asked for a second verdict - which arrives as an error
     * on top of the summary.
     */
    if (completedRef.current) return;
    const tracker = trackerRef.current;
    if (!tracker || heldWord(tracker) === null) return;

    const left = giveUpOnHeldWord(tracker);
    for (const location of left) {
      skippedRef.current.add(location);
      gaveUpRef.current.add(location);
    }
    const reveal = left.filter(
      (location) => !revealedRef.current.includes(location),
    );
    if (reveal.length > 0) {
      revealedRef.current = [...revealedRef.current, ...reveal];
    }

    /* Asking the tracker where it now stands rather than reading its fields:
       an empty batch reports the position without moving it. */
    const progress = advanceTracker(tracker, []);
    /* The next batch of phonemes must dispatch, whatever it says. */
    lastDispatchedRef.current = null;
    dispatch({
      type: "progress-advanced",
      progressIndex: pageWordCount(
        spokenRef.current.slice(0, progress.wordIndex),
      ),
      revealedLocations: revealedRef.current,
      misreadWords: misreadRef.current,
      currentWordLocation: progress.currentLocations[0] ?? null,
      transcript: "",
      completed: false,
      heldAtLocation: null,
    });
    /* Giving up on the last word of the page ends the run, like reciting it
       would - otherwise the reader is left listening to a finished page. */
    if (progress.finished) requestVerdict();
  }, [requestVerdict]);

  const applyPhonemeUnits = useCallback(
    (units: PhonemeEmission[], sessionId: number) => {
      if (!isCurrentSession(sessionId)) return;
      const tracker = trackerRef.current;
      if (!tracker) return;
      /*
       * Scoring flushes the recogniser's buffered tail, so phonemes can still
       * arrive after the run is over. They have nowhere to go: the cursor is
       * finished and asking for a second verdict would reopen a run that is
       * already being judged.
       */
      if (completedRef.current) return;

      /* Something was said, whether or not it turns out to match the page. */
      if (units.length > 0) heardPhonemesRef.current = true;

      if (import.meta.env.DEV) {
        for (const unit of units) {
          capturedHeardRef.current.push([
            unit.symbol,
            unit.confidence,
            unit.seconds,
          ]);
        }
      }

      /*
       * The cursor always waits: moving past a word the reciter could not
       * produce is the opposite of what memorising needs. It used to be an
       * option, and every caller passed it.
       */
      const progress = advanceTracker(tracker, units);
      for (const location of progress.skipped) {
        skippedRef.current.add(location);
      }
      // Said after all: the cursor went past them and the reciter came back.
      for (const word of progress.completed) {
        for (const location of word.locations) {
          skippedRef.current.delete(location);
        }
      }

      /*
       * The diagnostic readout, when it is on. Both halves are needed to be
       * worth anything: the phonemes alone say the microphone is working, and
       * only beside what the page expects do they say whether the word was
       * heard *right*.
       */
      if (showDebugRef.current) {
        setTelemetry((reading) => ({
          ...reading,
          heard: [
            ...reading.heard,
            ...units.map((unit) => ({
              symbol: unit.symbol,
              confidence: unit.confidence,
            })),
          ].slice(-HEARD_PHONEMES_KEPT),
          expected: spokenRef.current[progress.wordIndex]?.units ?? [],
        }));
      }

      /*
       * Kept whether or not the reader asked to be stopped.
       *
       * The toggle below governs the sound and the prompt - being
       * interrupted - not whether what happened is remembered. Someone who
       * turned the interruption off still wants the word in the summary,
       * and dropping it there is how a run with fumbles in it came back
       * clean.
       */
      for (const stumble of progress.stumbles) {
        for (const location of stumble.locations) {
          if (stumbleRef.current.has(location)) continue;
          stumbleRef.current.set(location, stumble.heard);
        }
      }

      /*
       * Stop at the word, if being stopped is what the reader asked for.
       *
       * Once, on the batch that notices: while the hold stands the refused
       * resync reports the stumble again every six stray phonemes, and
       * sounding the tone each time would punish someone for trying.
       *
       * The word is deliberately *not* revealed with it. Being stopped used
       * to show the word in the same breath, which hands someone the answer
       * they are halfway through remembering - the whole point of reciting
       * from memory. `revealHeldWord` is how it gets asked for.
       */
      /*
       * Corrected before the batch was over, so there is nothing to stop for.
       *
       * The recogniser reports every 480ms, which is long enough to get a
       * word wrong and then right inside one report. Sounding the tone and
       * holding the run at a word the reciter has already recited correctly
       * is the complaint that started all of this, arriving by a new route:
       * the stumble is still kept for the summary, because it happened.
       */
      const stumble = progress.stumbles.at(-1);
      const stillThere = stumble && progress.wordIndex <= stumble.wordIndex;
      if (stillThere && stopOnMistakeRef.current && progress.heldAt === null) {
        holdAt(tracker, stumble.wordIndex);
        playWrongSound();
        /*
         * And stop listening for as long as it sounds. Echo cancellation is
         * off by design, so the error sound arrives back as speech - and it
         * plays *because* a word was wrong, so it could be heard as the next
         * wrong word and sound again.
         */
        micRef.current?.muteFor(WRONG_SOUND_MS + 120);
      }
      /*
       * Where the hold stands now, which the tracker decides.
       *
       * It lifts its own hold once the cursor is genuinely past the word, so
       * nothing here has to work out when that happened - and nothing here
       * can get it wrong, which is what reading "the cursor is no longer on
       * that word" did to a reciter who simply went back a line.
       */
      const heldAtLocation = heldWord(tracker)?.[0] ?? null;

      /*
       * The tracker's own verdict on each word is deliberately ignored.
       *
       * It decides by matching symbols as they arrive, with thresholds that
       * were never measured; the forced alignment at the end of the run was,
       * over 663 clips, and the two disagree. Marking a word wrong mid-
       * recitation and then reporting a clean run is worse than waiting, so
       * the tracker moves the cursor and nothing else. Every red mark comes
       * from the one judge that has numbers behind it.
       *
       * What it does decide is visibility: everything the cursor is now past
       * becomes readable, whether it was recited or jumped over. Revealing
       * only the words it heard left holes in the page behind a reciter who
       * carried on past one - they watched the cursor move ahead with blanks
       * trailing it, which reads as the page having lost them. Nothing is
       * judged by being shown, and a skipped word is remembered above.
       */
      const passed = [
        ...progress.completed.flatMap((word) => word.locations),
        ...progress.skipped,
      ];
      /* A new array only when something was added, so an unchanged batch can
         be recognised by reference and skipped. */
      const newlyPassed = passed.filter(
        (location) => !revealedRef.current.includes(location),
      );
      if (newlyPassed.length > 0) {
        revealedRef.current = [...revealedRef.current, ...newlyPassed];
      }

      /*
       * One update, carrying the stuck mark with it.
       *
       * `progress-advanced` clears the mark, so dispatching it and then
       * putting the mark back took two renders and the red flickered on
       * every batch of phonemes. The mark deliberately has no timer - a
       * 700ms flash answers "that was wrong", while being held at a word
       * needs an answer to "which one" that lasts until they get past it -
       * so it travels with the progress rather than chasing it.
       */
      /*
       * Nothing to say, so nothing is said.
       *
       * The recogniser reports every 480ms whether or not the cursor moved,
       * and a reciter holding a long madd produces several batches that say
       * exactly the same thing. The reducer used to notice that by comparing
       * thirteen fields and returning the old state - which silently dropped
       * any field somebody later forgot to add to the list. Not dispatching
       * is the same saving without the trap.
       */
      if (import.meta.env.DEV) {
        const held = cursorHeldRef.current;
        if (held.wordIndex !== progress.wordIndex) {
          const word = spokenRef.current[held.wordIndex];
          const now = performance.now();
          if (word) {
            capturedHeldRef.current.push({
              locations: word.locations,
              ms: Math.round(now - held.since),
            });
          }
          cursorHeldRef.current = { wordIndex: progress.wordIndex, since: now };
        }
      }

      const progressIndex = pageWordCount(
        spokenRef.current.slice(0, progress.wordIndex),
      );
      const currentWordLocation = progress.currentLocations[0] ?? null;
      const last = lastDispatchedRef.current;
      if (
        last &&
        last.progressIndex === progressIndex &&
        last.currentWordLocation === currentWordLocation &&
        last.revealedLocations === revealedRef.current &&
        last.misreadWords === misreadRef.current &&
        last.heldAtLocation === heldAtLocation
      ) {
        if (progress.finished) requestVerdict();
        return;
      }
      lastDispatchedRef.current = {
        progressIndex,
        currentWordLocation,
        revealedLocations: revealedRef.current,
        misreadWords: misreadRef.current,
        heldAtLocation,
      };

      dispatch({
        type: "progress-advanced",
        progressIndex,
        revealedLocations: revealedRef.current,
        misreadWords: misreadRef.current,
        currentWordLocation,
        // Phonemes would only read as gibberish on the page.
        transcript: "",
        completed: false,
        heldAtLocation,
      });

      /*
       * Asked for after the words are on the page, not instead of them.
       *
       * Returning early here meant the final word of a run stayed blank
       * until the verdict came back, which on a long page is several
       * seconds of looking like it was missed.
       */
      if (progress.finished) requestVerdict();
    },
    [isCurrentSession, requestVerdict],
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
        /*
         * One engine's callbacks, not both.
         *
         * Wiring the phrase and rolling callbacks on the streaming path cut
         * the audio into phrases and queued them for a transcriber that is
         * not running.
         */
        const streaming = zipformerRef.current !== null;
        const mic = await startPhraseMicCapture(
          {
            ...(streaming
              ? {
                  onAudioBlock: (audio) => {
                    if (import.meta.env.DEV) {
                      capturedAudioRef.current.push(audio);
                    }
                    zipformerRef.current?.push(audio);
                  },
                }
              : {
                  onPhrase: (audio) =>
                    scheduleTranscribe(audio, true, sessionId),
                  onRollingChunk: (audio) =>
                    scheduleTranscribe(audio, false, sessionId),
                }),
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
            onDiagnostics: (mic) => {
              if (!isCurrentSession(sessionId) || !showDebugRef.current) return;
              setTelemetry((current) => ({ ...current, mic }));
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
      /*
       * Stop a recogniser this run asked for and then never took.
       *
       * Set once the fetch is in flight, and a no-op once the engine has been
       * adopted. See where it is assigned for what it is guarding.
       */
      let abandonEngine: (() => void) | null = null;

      try {
        const expected = await buildPageExpectedWords(pageWords);
        if (!isCurrentSession(sessionId)) return;
        if (expected.length === 0) {
          startStage = "no-words";
          throw new Error("No practice words are available on this page");
        }

        expectedWordsRef.current = expected;
        alignerRef.current = createAlignerState();
        misreadRef.current = [];
        completedRef.current = false;

        /*
         * The streaming recogniser follows the page itself: it is given the
         * phonemes of every word and reports them as they are spoken, so
         * there is no transcript to match and no phrase to wait for.
         */
        if (isStreamingPracticeModel(readPracticeModelPreference())) {
          // The phoneme tables ship with the model; failing to fetch them is
          // the model not being there, not the page's words.
          startStage = "model";
          /*
           * Either this run asked for a fresh copy, or settings did - the
           * two features share no state, so the button there leaves its
           * request in storage for whichever run comes next.
           */
          /* Not `||`: short-circuiting left settings' request in storage,
             so the run after a reader-initiated reload downloaded 72MB a
             second time. Held in the ref until a load actually succeeds, so
             stopping before it finishes does not consume the request. */
          if (takeModelReload()) reloadModelRef.current = true;
          const reload = reloadModelRef.current;

          /*
           * The weights and the page's phonemes are fetched together.
           *
           * They need nothing from each other, and doing them in turn made
           * time-to-listening the sum of the two: a 5MB phoneme table and its
           * parse had to finish before the 72MB download even began.
           *
           * The engine promise is started here and awaited below, so a
           * failure to build the words would otherwise reject with nothing
           * watching. The `catch` marks it handled without swallowing it -
           * awaiting it later still throws.
           */
          const needsEngine = !zipformerRef.current?.usable || reload;
          let enginePromise: Promise<ZipformerEngine> | null = null;
          /** Set where the engine is taken on, which is what makes the
              abandon guard below a no-op. */
          let engineAdopted = false;
          if (needsEngine) {
            disposeEngine();
            const streamController = new AbortController();
            modelStartAbortRef.current = streamController;
            enginePromise = startZipformer({
              signal: streamController.signal,
              reload,
              onProgress: (percent) => {
                if (!isCurrentSession(sessionId)) return;
                dispatch({ type: "model-progress", progress: percent });
              },
            });
            enginePromise.catch(() => {});
            /*
             * Taken below, or stopped.
             *
             * Two steps sit between this and the `await` that adopts it - the
             * page's phoneme table, and a check that the run is still the
             * current one - and either can end the run. The fetch is then
             * still in flight, resolves into nothing, and keeps its worker
             * and the model's 72MB for the life of the page; every retry adds
             * another. Nothing else can reach it, because `zipformerRef` was
             * never assigned, so `disposeEngine` has nothing to dispose.
             */
            abandonEngine = () => {
              if (engineAdopted) return;
              void enginePromise?.then(
                (engine) => engine.stop(),
                () => {},
              );
            };
          }

          const spoken = await buildPageSpokenWords(pageWords, { reload });
          if (!isCurrentSession(sessionId)) {
            abandonEngine?.();
            return;
          }
          if (spoken.length === 0) {
            startStage = "no-words";
            throw new Error("No practice words are available on this page");
          }

          wordTextRef.current = new Map(
            expected.map((word) => [
              word.location,
              { verseKey: word.verseKey, text: word.displayText },
            ]),
          );
          spokenRef.current = spoken;
          trackerRef.current = createPhonemeTracker(spoken);
          revealedRef.current = [];
          skippedRef.current = new Set();
          stumbleRef.current = new Map();
          gaveUpRef.current = new Set();
          heardPhonemesRef.current = false;
          dispatch({
            type: "expected-words-ready",
            totalWords: pageWordCount(spoken),
            currentWordLocation: spoken[0]?.locations[0] ?? null,
          });

          let engine = zipformerRef.current;
          if (enginePromise) {
            engine = await enginePromise;
            if (!isCurrentSession(sessionId)) {
              engine.stop();
              return;
            }
            zipformerRef.current = engine;
            engineAdopted = true;
            modelStartAbortRef.current = null;
            reloadModelRef.current = false;
          }
          /* Reused only when it is still usable, which is what `needsEngine`
             asked - so this is a guard rather than a path. */
          if (!engine) throw new Error("The recogniser is not available");

          const labels: number[] = [];
          const spans: { from: number; to: number }[] = [];
          for (const word of spoken) {
            const from = labels.length;
            labels.push(...word.ids);
            spans.push({ from, to: labels.length });
          }
          engine.begin(
            {
              onUnits: (units) => applyPhonemeUnits(units, sessionId),
              onScores: (scores, heardPerWord) =>
                applyWordScores(scores, heardPerWord, sessionId),
              onError: (message, fatal) => {
                if (!isCurrentSession(sessionId)) return;
                /*
                 * The verdict is on screen; the run is over. The worker is
                 * reused, so a late failure from it - or the worker dying -
                 * still matched this session and replaced the summary the
                 * reader was reading with an error.
                 */
                if (verdictAppliedRef.current) return;
                if (fatal) {
                  disposeEngine();
                  failPractice("recognition", message);
                  return;
                }
                // A run waiting on a verdict that failed must still end -
                // and not as a clean one.
                if (completedRef.current) {
                  failPractice("verdictFailed", message);
                  return;
                }
                dispatch({
                  type: "recognition-error",
                  error: "recognition",
                  detail: message,
                });
              },
            },
            labels,
            spans,
          );

          dispatch({ type: "listening" });
          /* The clock for a recorded run starts when the microphone does,
             not when the model began loading 70MB ago. */
          cursorHeldRef.current = { wordIndex: 0, since: performance.now() };
          startStage = "microphone";
          await startMic(sessionId);
          return;
        }

        // Its worker would otherwise sit on the streaming model's memory.
        disposeEngine();
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
        /* Whatever went wrong, a recogniser this run fetched and never took
           is not left running. */
        abandonEngine?.();
        if (!isCurrentSession(sessionId) || isAbortError(error)) return;
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
        // What failed, for anyone helping: "model is not hosted at ..." says
        // more than the sentence it is translated into.
        failPractice(
          errorCode,
          error instanceof Error && errorCode === "modelLoad"
            ? error.message
            : undefined,
        );
      }
    },
    [
      applyPhonemeUnits,
      applyWordScores,
      disposeEngine,
      failPractice,
      initModel,
      isCurrentSession,
      releaseSessionResources,
      startMic,
    ],
  );

  /*
   * All three read the current value and then set it, rather than deciding
   * inside the updater.
   *
   * React may call an updater more than once for a single change - it does so
   * in StrictMode deliberately - so anything with an effect belongs outside
   * it. Writing a preference to storage twice is harmless; clearing other
   * state twice, as the debug toggle did, is not something to rely on.
   */
  /**
   * Keep this run, so the next thresholds are measured on the right voice.
   *
   * Development only; `saveRecording` posts to a dev-server middleware that
   * writes it beside the other fixtures. Returns the saved file's name.
   */
  const saveRun = useCallback(async (note: string) => {
    const meta = lastRunRef.current;
    const blocks = capturedAudioRef.current;
    if (!import.meta.env.DEV || !meta || blocks.length === 0) {
      throw new Error("There is no finished run to save");
    }
    let length = 0;
    for (const block of blocks) length += block.length;
    const samples = new Float32Array(length);
    let at = 0;
    for (const block of blocks) {
      samples.set(block, at);
      at += block.length;
    }
    return saveRecording(samples, PRACTICE_SAMPLE_RATE, { ...meta, note });
  }, []);

  const toggleStopOnMistake = useCallback(() => {
    const next = !stopOnMistakeRef.current;
    setStopOnMistake(next);
    safeStorage.setItem(PRACTICE_STOP_ON_MISTAKE_STORAGE_KEY, String(next));
    /*
     * Turning it off while stopped at a word lets the run go.
     *
     * Otherwise the switch that put someone there cannot get them out: the
     * hold would stand, the prompt with it, and the only way on would be the
     * give-up button they had just said they did not want.
     */
    const tracker = trackerRef.current;
    if (next || !tracker || heldWord(tracker) === null) return;
    releaseHold(tracker);
    lastDispatchedRef.current = null;
    dispatch({ type: "clear-held-word" });
  }, []);

  const toggleShowDebug = useCallback(() => {
    const next = !showDebugRef.current;
    setShowDebug(next);
    safeStorage.setItem(PRACTICE_DEBUG_STORAGE_KEY, String(next));
    // Turning it off clears what it was showing, rather than freezing it.
    if (!next) {
      setTelemetry((reading) => ({
        ...reading,
        heard: [],
        expected: [],
        mic: null,
      }));
    }
  }, []);

  const toggleHideAyat = useCallback(() => {
    const next = !hideAyat;
    setHideAyat(next);
    safeStorage.setItem(PRACTICE_HIDE_AYAT_STORAGE_KEY, String(next));
  }, [hideAyat]);

  const clearDownloadedModel = useCallback(async () => {
    stopPractice();
    /*
     * The streaming model is fetched with plain `fetch`, so its copy is the
     * browser's, not in the Whisper cache cleared below - which made this
     * button a no-op for everyone on the default model. Its next load goes
     * past the cached copy instead.
     */
    disposeEngine();
    reloadModelRef.current = true;
    await clearWhisperModelCache();
  }, [disposeEngine, stopPractice]);

  /** The reciter says they are done: score what they gave us. */
  const finishPractice = useCallback(() => {
    /*
     * Already scoring: let it land.
     *
     * `completedRef` is set the moment the verdict is asked for, so pressing
     * the stop square during the few seconds a long page takes to score fell
     * through to `stopPractice` and threw the run away - after a button that
     * says it will end the run *and score it*.
     */
    if (completedRef.current && !verdictAppliedRef.current) return;

    const tracker = trackerRef.current;
    const streaming = zipformerRef.current !== null && tracker !== null;
    if (!streaming || completedRef.current) {
      stopPractice();
      return;
    }

    /*
     * No word matched. Two very different reasons, told apart by whether the
     * recogniser emitted anything at all.
     *
     * Nothing emitted: nobody spoke. Someone started تسميع and changed their
     * mind, and reporting "no recitation was heard" as an error for pressing
     * stop made a cancel look like a failure.
     *
     * Something emitted but nothing matched: they recited and were not
     * recognised. Saying so is the only way they find out the microphone or
     * the model is the problem rather than their memory - and it must not be
     * reported as a clean run.
     */
    if (!recitedSpan(tracker)) {
      if (heardPhonemesRef.current) failPractice("nothingHeard");
      else stopPractice();
      return;
    }
    requestVerdict();
  }, [failPractice, requestVerdict, stopPractice]);

  const togglePractice = useCallback(
    async (pageWords: MushafWord[]) => {
      if (state.active) finishPractice();
      else await startPractice(pageWords);
    },
    [finishPractice, startPractice, state.active],
  );

  useEffect(
    () => () => {
      sessionIdRef.current += 1;
      releaseSessionResources();
      disposeEngine();
    },
    [disposeEngine, releaseSessionResources],
  );

  const value = useMemo<RecitationPracticeValue>(
    () => ({
      ...state,
      hideAyat,
      toggleHideAyat,
      stopOnMistake,
      toggleStopOnMistake,
      revealHeldWord,
      skipHeldWord,
      saveRun,
      showDebug,
      toggleShowDebug,
      startPractice,
      stopPractice,
      finishPractice,
      togglePractice,
      clearDownloadedModel,
    }),
    [
      state,
      hideAyat,
      toggleHideAyat,
      stopOnMistake,
      toggleStopOnMistake,
      revealHeldWord,
      skipHeldWord,
      saveRun,
      showDebug,
      toggleShowDebug,
      startPractice,
      stopPractice,
      finishPractice,
      togglePractice,
      clearDownloadedModel,
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
