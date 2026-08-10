import type { MushafVerse, QuestionType } from "@/shared/types/quran";

export interface QuizChoice {
  id: string;
  label: string;
}

export interface QuizQuestionBase {
  id: string;
  type: QuestionType;
  verse: MushafVerse;
  verseKey: string;
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
  prompt: string;
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
  selectedChoiceId: string;
  correctChoiceId: string;
  isCorrect: boolean;
}

export interface QuizSessionSummary {
  id: string;
  completedAt: string;
  scopeSummary: string;
  sessionMode: "fixed" | "endless";
  questionCount: number;
  correctCount: number;
  accuracyByType: Partial<Record<QuestionType, { correct: number; total: number }>>;
  durationMs: number;
}
