import type { MushafVerse } from "@/domain/quran";

export type QuestionType =
  | "fill_blank"
  | "complete_ayah"
  | "audio_identify"
  | "surah_name"
  | "ayah_number"
  | "juz_number"
  | "hizb_number"
  | "page_number";

export type QuizScopeMode = "surah" | "juz" | "page" | "ayah_range";

export interface QuizScope {
  mode: QuizScopeMode;
  surahIndices?: number[];
  juzIndices?: number[];
  pageFrom?: number;
  pageTo?: number;
  ayahRangeSurah?: number;
  ayahFrom?: number;
  ayahTo?: number;
}

export type QuizSessionMode = "fixed" | "endless";

export interface QuizConfig {
  scope: QuizScope;
  questionTypes: QuestionType[];
  sessionMode: QuizSessionMode;
  questionCount?: number;
  /** Set when replaying only the ayahs missed in the previous session. */
  focusVerseKeys?: string[];
}

export interface QuizChoice {
  id: string;
  label: string;
}

interface QuizQuestionBase {
  id: string;
  type: QuestionType;
  /** Verse the prompt is built around. */
  verse: MushafVerse;
  verseKey: string;
  /**
   * Ayah the learner is actually asked about. Fill-blank hides a neighbour of
   * the anchor, and audio can ask what follows, so review must not assume the
   * anchor is the tested ayah.
   */
  testedVerseKey: string;
}

export interface FillBlankQuizQuestion extends QuizQuestionBase {
  type: "fill_blank";
  hiddenVerse: MushafVerse;
  hiddenVerseKey: string;
  page: number;
  searchOptions: QuizChoice[];
}

export interface CompleteAyahQuizQuestion extends QuizQuestionBase {
  type: "complete_ayah";
  promptText: string;
  choices: QuizChoice[];
  correctChoiceId: string;
}

export interface AudioIdentifyQuizQuestion extends QuizQuestionBase {
  type: "audio_identify";
  audioPrompt: "surah" | "next_ayah";
  choices: QuizChoice[];
  correctChoiceId: string;
}

export interface InfoQuizQuestion extends QuizQuestionBase {
  type:
    | "surah_name"
    | "ayah_number"
    | "juz_number"
    | "hizb_number"
    | "page_number";
  choices: QuizChoice[];
  correctChoiceId: string;
}

export type QuizQuestion =
  | FillBlankQuizQuestion
  | CompleteAyahQuizQuestion
  | AudioIdentifyQuizQuestion
  | InfoQuizQuestion;

export interface QuizAnswerRecord {
  questionId: string;
  questionType: QuestionType;
  verseKey: string;
  testedVerseKey: string;
  selectedChoiceId: string;
  /** Rendered text of the answer, kept so review can name it back. */
  selectedLabel: string;
  correctChoiceId: string;
  correctLabel: string;
  isCorrect: boolean;
}

/** Compact per-answer record; history keeps outcomes, not full prompts. */
export interface QuizAnswerHistoryEntry {
  questionType: QuestionType;
  verseKey: string;
  isCorrect: boolean;
}

export type QuizScopeSnapshot =
  | { mode: "surah"; surahNumbers: number[] }
  | { mode: "juz"; juzNumbers: number[] }
  | { mode: "page"; from: number; to: number }
  | {
      mode: "ayah_range";
      surahNumber: number;
      from: number;
      to: number;
    };

export interface QuizSessionSummaryV3 {
  schemaVersion: 3;
  id: string;
  completedAt: string;
  /** Null only for migrated records whose legacy label cannot be parsed safely. */
  scope: QuizScopeSnapshot | null;
  /** Display fallback retained for migrated V1 records only. */
  legacyScopeSummary?: string;
  sessionMode: "fixed" | "endless";
  questionCount: number;
  correctCount: number;
  accuracyByType: Partial<
    Record<QuestionType, { correct: number; total: number }>
  >;
  durationMs: number;
  /** Empty for sessions migrated from earlier schemas. */
  answers: QuizAnswerHistoryEntry[];
  reviewOfMistakes?: boolean;
}

export interface QuizSessionSummaryV2 {
  schemaVersion: 2;
  id: string;
  completedAt: string;
  /** Null only for migrated records whose legacy label cannot be parsed safely. */
  scope: QuizScopeSnapshot | null;
  /** Display fallback retained for migrated V1 records only. */
  legacyScopeSummary?: string;
  sessionMode: "fixed" | "endless";
  questionCount: number;
  correctCount: number;
  accuracyByType: Partial<
    Record<QuestionType, { correct: number; total: number }>
  >;
  durationMs: number;
}

export interface QuizSessionSummaryV1 {
  id: string;
  completedAt: string;
  scopeSummary: string;
  sessionMode: "fixed" | "endless";
  questionCount: number;
  correctCount: number;
  accuracyByType: Partial<
    Record<QuestionType, { correct: number; total: number }>
  >;
  durationMs: number;
}

type QuizPhase = "idle" | "setup" | "active" | "feedback" | "results";
export type QuizEngineError =
  | "scopeEmpty"
  | "noTypes"
  | "questionUnavailable"
  | "poolTooSmall";

export interface QuizState {
  phase: QuizPhase;
  config: QuizConfig | null;
  currentQuestion: QuizQuestion | null;
  answers: QuizAnswerRecord[];
  streak: number;
  error: QuizEngineError | null;
  sessionSummary: QuizSessionSummaryV3 | null;
  selectedChoiceId: string | null;
  lastIsCorrect: boolean | null;
  startedAt: number | null;
  historySaveFailed: boolean;
}

export function snapshotQuizScope(scope: QuizScope): QuizScopeSnapshot {
  switch (scope.mode) {
    case "surah":
      return {
        mode: "surah",
        surahNumbers: [...(scope.surahIndices ?? [])],
      };
    case "juz":
      return { mode: "juz", juzNumbers: [...(scope.juzIndices ?? [])] };
    case "page": {
      const from = scope.pageFrom ?? 1;
      return { mode: "page", from, to: scope.pageTo ?? from };
    }
    case "ayah_range": {
      const from = scope.ayahFrom ?? 1;
      return {
        mode: "ayah_range",
        surahNumber: scope.ayahRangeSurah ?? 1,
        from,
        to: scope.ayahTo ?? from,
      };
    }
  }
}
