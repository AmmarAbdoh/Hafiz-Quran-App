import type { ReactNode } from "react";
import type { MushafWord } from "@/domain/quran";
import type { MicDiagnostics } from "@/features/recitation-practice/services/micAudioCapture";
import type { HeardInstead } from "@/features/recitation-practice/model/phonemeText";

type PracticePhase = "preparing" | "loading-model" | "listening" | "completed";

export type PracticeErrorCode =
  | "noWords"
  | "wordDataLoad"
  | "modelLoad"
  | "microphonePermission"
  | "microphoneStart"
  | "recognition"
  | "workerUnavailable"
  | "startFailed"
  /** The run ended with nothing recited to judge. */
  | "nothingHeard"
  /** Something was recited, and scoring it failed. */
  | "verdictFailed";

export interface MisreadWord {
  location: string;
  verseKey: string;
  /** As the page reads it, without tashkeel. */
  text: string;
  /**
   * Why it is listed, and what was there instead.
   *
   * A mark says which word and leaves the question the reciter actually has.
   * Any letters in here are the recogniser's phonemes spelled out rather
   * than a word from the Quran, so nothing should present them as text to
   * read - see `phonemesAsLetters`.
   */
  heard: HeardInstead;
}

export interface RecitationPracticeState {
  active: boolean;
  phase: PracticePhase;
  listening: boolean;
  loadingModel: boolean;
  modelProgress: number;
  isAnalyzing: boolean;
  currentWordLocation: string | null;
  lastTranscript: string;
  wrongFlashLocation: string | null;
  /**
   * The word the run is stopped at, and will not move past.
   *
   * Set only when the reader asked to be stopped at a mistake. The cursor
   * always waited at a word it had not heard, but the resync then carried
   * anyone who gave up and read on - so "stop me" never stopped anybody. It
   * does now, and the only ways past are to say the word, to ask to see it
   * and then say it, or to say you are giving up on it.
   *
   * Kept apart from `wrongFlashLocation`, which is the legacy engine's
   * 700ms mark and expires on a timer. This one lasts as long as the reciter
   * is stuck, because "which word" is the question it answers.
   */
  heldAtLocation: string | null;
  revealedLocations: string[];
  /**
   * Words passed but not said as the page has them.
   *
   * Distinct from the wrong flash, which is a moment: these persist, so at
   * the end of a run the reader can be shown every word that needs work
   * rather than only the one that was wrong a second ago. Carries the word
   * itself, not just where it was, because the summary has to name it
   * without going back to the page for it.
   */
  misreadWords: MisreadWord[];
  progressIndex: number;
  totalWords: number;
  completed: boolean;
  /**
   * The run ended before the end of the page.
   *
   * Kept apart from `completed`, which only says the verdict is in. A page
   * abandoned a third of the way through is a finished run and an unfinished
   * recitation, and the summary has to say the second.
   */
  stoppedShort: boolean;
  error: PracticeErrorCode | null;
  /**
   * What the speech engine said, when it was the engine that failed.
   *
   * The app translated every worker failure into one sentence and dropped the
   * message with the cause in it, which left both the reader and anyone
   * helping them with nothing to go on.
   */
  errorDetail: string | null;
}

/**
 * One phoneme as the recogniser emitted it, for the debug panel.
 *
 * Not exported: consumers reach it through `RecitationPracticeTelemetry`,
 * and a second name for the same shape is one more thing to keep in step.
 */
interface HeardPhoneme {
  symbol: string;
  /** 0 to 1, from the frame that emitted it. */
  confidence: number;
}

export interface RecitationPracticeTelemetry {
  isSpeaking: boolean;
  micLevel: number;
  /**
   * The most recent phonemes heard, oldest first.
   *
   * Kept only while the debug panel is on. Shown beside what the page expects
   * at the cursor, because the two questions a reciter actually has - "did it
   * hear me" and "did it hear me *right*" - look identical without the
   * comparison.
   */
  heard: HeardPhoneme[];
  /** What the page expects at the cursor, for that comparison. */
  expected: string[];
  /** What the microphone is really delivering; null until the first block. */
  mic: MicDiagnostics | null;
}

export interface RecitationPracticeValue extends RecitationPracticeState {
  hideAyat: boolean;
  toggleHideAyat: () => void;
  /**
   * Stop on a wrong word, sound, and show what it should have been.
   *
   * The cursor always waits for the word - skipping past one you could not
   * remember defeats the point of memorising. This decides whether being
   * wrong is also *announced*, which some people want and others find
   * punishing.
   */
  stopOnMistake: boolean;
  toggleStopOnMistake: () => void;
  /**
   * Show the word the run is held at, without moving past it.
   *
   * Being stopped used to reveal the word in the same breath, which handed
   * someone the answer they were in the middle of remembering. Seeing it is
   * now asked for, and asking does not let the cursor move: the word still
   * has to be recited.
   */
  revealHeldWord: () => void;
  /**
   * Give up on the word the run is held at and carry on past it.
   *
   * The escape hatch, and it has to exist: the recogniser does drop a
   * phoneme a learner really said, and without this the run would be a trap
   * with no way out but abandoning the page. It is recorded as given up on,
   * which is better evidence than anything the aligner has - the reader said
   * so themselves.
   */
  skipHeldWord: () => void;
  /**
   * Keep the finished run as a fixture, with a note about what went wrong.
   *
   * Development only, and it throws unless a run has just been judged. Every
   * threshold in this feature was measured on professional reciters; this is
   * how recordings of the person actually using it reach the bench.
   */
  saveRun: (note: string) => Promise<string>;
  /**
   * Show what the recogniser heard and what the microphone is delivering.
   *
   * Off by default: it is a diagnostic, not a feature, and the phonemes read
   * as nonsense to anyone not debugging. On, it is the only way to tell a bad
   * microphone from a misheard word.
   */
  showDebug: boolean;
  toggleShowDebug: () => void;
  startPractice: (pageWords: MushafWord[]) => Promise<void>;
  stopPractice: () => void;
  /**
   * End the run and ask for the verdict, rather than discarding it.
   *
   * Finishing only when every word has been matched is too brittle to be the
   * single way out: one word the recogniser never settles on and the reciter
   * is left with a page they have finished and no result. Stopping is the
   * reciter saying they are done, so it should be answered.
   */
  finishPractice: () => void;
  togglePractice: (pageWords: MushafWord[]) => Promise<void>;
  /**
   * Throw away the downloaded speech model so the next run fetches it afresh.
   *
   * A model file can be cached in a state that loads but cannot run - an
   * export that wants an input this runtime never sends, or a copy saved
   * half-written. Nothing about that is recoverable from inside a run, so the
   * reader needs a way out that does not involve browser settings.
   */
  clearDownloadedModel: () => Promise<void>;
}

export interface RecitationPracticeProviderProps {
  children: ReactNode;
}

export interface PracticeSummaryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  misreadWords: MisreadWord[];
  /** The page's words, so "three of a hundred" can be said. */
  totalWords: number;
  /** How far the reciter got, in the same words as `totalWords`. */
  progressIndex: number;
  /** They stopped before the end; see `stoppedShort`. */
  stoppedShort: boolean;
  /**
   * Keep this run as a fixture. Absent outside development, and the whole
   * control is absent with it.
   */
  onSaveRun?: (note: string) => Promise<string>;
  onPractiseAgain: () => void;
}
