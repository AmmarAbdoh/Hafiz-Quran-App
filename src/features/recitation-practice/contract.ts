import type { ReactNode } from "react";
import type { MushafWord } from "@/domain/quran";

type PracticePhase = "preparing" | "loading-model" | "listening" | "completed";

export type PracticeErrorCode =
  | "noWords"
  | "wordDataLoad"
  | "modelLoad"
  | "microphonePermission"
  | "microphoneStart"
  | "recognition"
  | "workerUnavailable"
  | "startFailed";

export interface MisreadWord {
  location: string;
  verseKey: string;
  /** As the page reads it, without tashkeel. */
  text: string;
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
  error: PracticeErrorCode | null;
}

export interface RecitationPracticeTelemetry {
  isSpeaking: boolean;
  micLevel: number;
}

export interface RecitationPracticeValue extends RecitationPracticeState {
  hideAyat: boolean;
  toggleHideAyat: () => void;
  startPractice: (pageWords: MushafWord[]) => Promise<void>;
  stopPractice: () => void;
  togglePractice: (pageWords: MushafWord[]) => Promise<void>;
}

export interface RecitationPracticeProviderProps {
  children: ReactNode;
}

export interface PracticeSummaryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  misreadWords: MisreadWord[];
  totalWords: number;
  onPractiseAgain: () => void;
}
