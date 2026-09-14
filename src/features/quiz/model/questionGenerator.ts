import { normalizeArabicForMatch } from "@/shared/lib/arabic-normalize";
import type { MushafVerse, VerseInfoRecord } from "@/domain/quran";
import type { QuestionType, QuizQuestion } from "./types";
import { toVerseKey } from "./versePool";
import { generateAudioIdentifyQuestion } from "./questions/audioIdentify";
import { generateCompleteAyahQuestion } from "./questions/completeAyah";
import { generateFillBlankQuestion } from "./questions/fillBlank";
import { generateInfoQuestion } from "./questions/info";
import type { SurahNameLookup, VerseRefFormatter } from "./questions/shared";

/**
 * Returns null when this verse cannot carry a fair question of this type, for
 * example a two-word ayah to complete or an ayah whose hizb is unknown. The
 * caller draws again instead of asking something degenerate.
 */
export function generateQuizQuestion(input: {
  verse: MushafVerse;
  questionType: QuestionType;
  pool: MushafVerse[];
  mushafData: MushafVerse[];
  verseInfoRecords: VerseInfoRecord[];
  surahName: SurahNameLookup;
  verseRef: VerseRefFormatter;
}): QuizQuestion | null {
  const {
    verse,
    questionType,
    pool,
    mushafData,
    verseInfoRecords,
    surahName,
    verseRef,
  } = input;
  switch (questionType) {
    case "fill_blank":
      return generateFillBlankQuestion(verse, pool, mushafData, verseRef);
    case "complete_ayah":
      return generateCompleteAyahQuestion(verse, pool);
    case "audio_identify":
      return generateAudioIdentifyQuestion(verse, pool, mushafData, surahName);
    default:
      return generateInfoQuestion({
        verse,
        pool,
        mushafData,
        records: verseInfoRecords,
        type: questionType,
        surahName,
      });
  }
}

export function getCorrectChoiceId(question: QuizQuestion): string {
  return question.type === "fill_blank"
    ? question.hiddenVerseKey
    : question.correctChoiceId;
}

function getQuestionChoices(question: QuizQuestion) {
  return question.type === "fill_blank"
    ? question.searchOptions
    : question.choices;
}

export function getChoiceLabel(
  question: QuizQuestion,
  choiceId: string,
): string {
  return (
    getQuestionChoices(question).find((choice) => choice.id === choiceId)
      ?.label ?? choiceId
  );
}

export function checkQuizAnswer(
  question: QuizQuestion,
  selectedChoiceId: string,
  verses: MushafVerse[],
): boolean {
  const correctId = getCorrectChoiceId(question);
  if (question.type !== "fill_blank" || selectedChoiceId === correctId) {
    return selectedChoiceId === correctId;
  }

  // Some ayahs repeat verbatim; picking an identical text is not a mistake.
  const selectedVerse = verses.find(
    (verse) => toVerseKey(verse) === selectedChoiceId,
  );
  return Boolean(
    selectedVerse &&
    normalizeArabicForMatch(selectedVerse.aya_text_emlaey) ===
      normalizeArabicForMatch(question.hiddenVerse.aya_text_emlaey),
  );
}
