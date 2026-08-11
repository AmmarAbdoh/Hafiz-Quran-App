import { SURAH_NAMES } from "@/domain/quran";
import type { MushafVerse, VerseInfoRecord } from "@/domain/quran";
import type { InfoQuizQuestion, QuizChoice } from "../types";
import { shuffleArray, toVerseKey } from "../versePool";
import { buildChoices, createQuestionId } from "./shared";

function getCorrectValue(
  type: InfoQuizQuestion["type"],
  verse: MushafVerse,
  records: VerseInfoRecord[],
): string {
  const record = records.find((item) => item.id === verse.id);
  switch (type) {
    case "surah_name":
      return String(verse.sura_no);
    case "ayah_number":
      return String(record?.verse_number ?? verse.aya_no);
    case "juz_number":
      return String(record?.juz_number ?? verse.jozz);
    case "hizb_number":
      return String(record?.hizb_number ?? "");
    case "page_number":
      return String(record?.page_number ?? verse.page);
  }
}

function buildNumericDistractors(max: number, correctId: string): QuizChoice[] {
  return Array.from({ length: max }, (_, index) => String(index + 1))
    .filter((value) => value !== correctId)
    .map((value) => ({ id: value, label: value }));
}

export function generateInfoQuestion(
  verse: MushafVerse,
  pool: MushafVerse[],
  records: VerseInfoRecord[],
  type: InfoQuizQuestion["type"],
): InfoQuizQuestion {
  const correctChoiceId = getCorrectValue(type, verse, records);
  let correctLabel = correctChoiceId;
  let distractors: QuizChoice[];

  switch (type) {
    case "surah_name": {
      correctLabel = SURAH_NAMES[verse.sura_no - 1] ?? verse.sura_name_ar;
      const scopedSurahs = [...new Set(pool.map((item) => item.sura_no))];
      const allSurahs = Array.from({ length: 114 }, (_, index) => index + 1);
      distractors = [...scopedSurahs, ...allSurahs]
        .filter(
          (surah, index, items) =>
            String(surah) !== correctChoiceId && items.indexOf(surah) === index,
        )
        .map((surah) => ({
          id: String(surah),
          label: SURAH_NAMES[surah - 1] ?? String(surah),
        }));
      break;
    }
    case "ayah_number":
      distractors = buildNumericDistractors(286, correctChoiceId);
      break;
    case "juz_number":
      distractors = buildNumericDistractors(30, correctChoiceId);
      break;
    case "hizb_number":
      distractors = buildNumericDistractors(60, correctChoiceId);
      break;
    case "page_number":
      distractors = buildNumericDistractors(604, correctChoiceId);
      break;
  }

  return {
    id: createQuestionId(),
    type,
    verse,
    verseKey: toVerseKey(verse),
    choices: buildChoices(
      { id: correctChoiceId, label: correctLabel },
      shuffleArray(distractors),
    ),
    correctChoiceId,
  };
}
