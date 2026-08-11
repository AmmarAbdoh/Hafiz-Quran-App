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
