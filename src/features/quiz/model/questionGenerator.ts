import { normalizeArabicForMatch } from "@/shared/lib/arabic-normalize";
import type { MushafVerse, VerseInfoRecord } from "@/domain/quran";
import type { QuestionType, QuizQuestion } from "./types";
import { toVerseKey } from "./versePool";
import { generateAudioIdentifyQuestion } from "./questions/audioIdentify";
import { generateCompleteAyahQuestion } from "./questions/completeAyah";
import { generateFillBlankQuestion } from "./questions/fillBlank";
import { generateInfoQuestion } from "./questions/info";

export function generateQuizQuestion(input: {
  verse: MushafVerse;
  questionType: QuestionType;
  pool: MushafVerse[];
  mushafData: MushafVerse[];
  verseInfoRecords: VerseInfoRecord[];
}): QuizQuestion {
  const { verse, questionType, pool, mushafData, verseInfoRecords } = input;
  switch (questionType) {
    case "fill_blank":
      return generateFillBlankQuestion(verse, pool, mushafData);
    case "complete_ayah":
      return generateCompleteAyahQuestion(verse, pool);
    case "audio_identify":
      return generateAudioIdentifyQuestion(verse, pool, mushafData);
    default:
      return generateInfoQuestion(verse, pool, verseInfoRecords, questionType);
  }
}

export function getCorrectChoiceId(question: QuizQuestion): string {
  return question.type === "fill_blank"
    ? question.hiddenVerseKey
    : question.correctChoiceId;
}

export function checkQuizAnswer(
  question: QuizQuestion,
  selectedChoiceId: string,
  pool: MushafVerse[],
): boolean {
  const correctId = getCorrectChoiceId(question);
  if (question.type !== "fill_blank" || selectedChoiceId === correctId) {
    return selectedChoiceId === correctId;
  }

  const selectedVerse = pool.find(
    (verse) => toVerseKey(verse) === selectedChoiceId,
  );
  return Boolean(
    selectedVerse &&
    normalizeArabicForMatch(selectedVerse.aya_text_emlaey) ===
      normalizeArabicForMatch(question.hiddenVerse.aya_text_emlaey),
  );
}
