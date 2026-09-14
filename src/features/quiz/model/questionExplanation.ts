import { getSurahAyahCount } from "@/domain/quran";
import type { MushafVerse, VerseInfoRecord } from "@/domain/quran";
import { getChoiceLabel, getCorrectChoiceId } from "./questionGenerator";
import type { SurahNameLookup } from "./questions/shared";
import type { QuizQuestion } from "./types";
import { parseVerseKey } from "./versePool";

type ExplanationKey =
  | "explanation.fillBlank"
  | "explanation.completeAyah"
  | "explanation.audioSurah"
  | "explanation.audioNext"
  | "explanation.surahName"
  | "explanation.ayahNumber"
  | "explanation.juzNumber"
  | "explanation.hizbNumber"
  | "explanation.pageNumber";

/**
 * The facts that settle any question. The model gathers them, the view words
 * and localizes them.
 */
interface ExplanationFacts {
  surah: string;
  ayah: number;
  page: number;
  juz: number;
  totalAyahs: number;
  /** Null when the mushaf metadata for this ayah has not loaded. */
  hizb: number | null;
}

export interface AnswerExplanation {
  correctLabel: string;
  selectedLabel: string;
  /** Ayah to open in the mushaf when the learner wants the full context. */
  verseKey: string;
  surahNumber: number;
  ayahNumber: number;
  facts: ExplanationFacts;
  detailKey: ExplanationKey | null;
}

function findVerse(
  verseKey: string,
  mushafData: MushafVerse[],
): MushafVerse | undefined {
  const { surah, ayah } = parseVerseKey(verseKey);
  return mushafData.find(
    (verse) => verse.sura_no === surah && verse.aya_no === ayah,
  );
}

export function buildAnswerExplanation(input: {
  question: QuizQuestion;
  selectedChoiceId: string;
  mushafData: MushafVerse[];
  verseInfoRecords: VerseInfoRecord[];
  surahName: SurahNameLookup;
}): AnswerExplanation {
  const {
    question,
    selectedChoiceId,
    mushafData,
    verseInfoRecords,
    surahName,
  } = input;
  const testedVerse =
    findVerse(question.testedVerseKey, mushafData) ?? question.verse;
  const record = verseInfoRecords.find((item) => item.id === testedVerse.id);
  const facts: ExplanationFacts = {
    surah: surahName(testedVerse.sura_no),
    ayah: testedVerse.aya_no,
    page: record?.page_number ?? testedVerse.page,
    juz: record?.juz_number ?? testedVerse.jozz,
    totalAyahs: getSurahAyahCount(mushafData, testedVerse.sura_no),
    hizb: record?.hizb_number ?? null,
  };

  let detailKey: ExplanationKey | null;
  switch (question.type) {
    case "fill_blank":
      detailKey = "explanation.fillBlank";
      break;
    case "complete_ayah":
      detailKey = "explanation.completeAyah";
      break;
    case "audio_identify":
      detailKey =
        question.audioPrompt === "surah"
          ? "explanation.audioSurah"
          : "explanation.audioNext";
      break;
    case "surah_name":
      detailKey = "explanation.surahName";
      break;
    case "ayah_number":
      detailKey = "explanation.ayahNumber";
      break;
    case "juz_number":
      detailKey = "explanation.juzNumber";
      break;
    case "hizb_number":
      detailKey = facts.hizb === null ? null : "explanation.hizbNumber";
      break;
    case "page_number":
      detailKey = "explanation.pageNumber";
      break;
  }

  return {
    correctLabel: getChoiceLabel(question, getCorrectChoiceId(question)),
    selectedLabel: getChoiceLabel(question, selectedChoiceId),
    verseKey: question.testedVerseKey,
    surahNumber: testedVerse.sura_no,
    ayahNumber: testedVerse.aya_no,
    facts,
    detailKey,
  };
}
