import { getSurahAyahCount } from "@/domain/quran";
import type { MushafVerse, VerseInfoRecord } from "@/domain/quran";
import { buildNumericDistractors, buildSurahDistractors } from "../distractors";
import type { InfoQuizQuestion, QuizChoice } from "../types";
import { toVerseKey } from "../versePool";
import {
  DEFAULT_CHOICE_COUNT,
  buildChoices,
  createQuestionId,
  type SurahNameLookup,
} from "./shared";

const TOTAL_SURAHS = 114;
const TOTAL_JUZ = 30;
const TOTAL_HIZB = 60;
const TOTAL_PAGES = 604;

interface InfoQuestionInput {
  verse: MushafVerse;
  pool: MushafVerse[];
  mushafData: MushafVerse[];
  records: VerseInfoRecord[];
  type: InfoQuizQuestion["type"];
  surahName: SurahNameLookup;
}

/**
 * Hizb is the one value the mushaf rows cannot supply, so a missing info record
 * means the question is dropped rather than answered with the page number.
 */
function getCorrectValue(input: InfoQuestionInput): number | null {
  const { verse, records, type } = input;
  const record = records.find((item) => item.id === verse.id);
  switch (type) {
    case "surah_name":
      return verse.sura_no;
    case "ayah_number":
      return verse.aya_no;
    case "juz_number":
      return record?.juz_number ?? verse.jozz;
    case "hizb_number":
      return record?.hizb_number ?? null;
    case "page_number":
      return record?.page_number ?? verse.page;
  }
}

function buildNumericChoices(
  input: InfoQuestionInput,
  correct: number,
): { choices: QuizChoice[]; correctChoiceId: string } | null {
  const { verse, pool, mushafData, records, type } = input;
  const hizbByVerseId = new Map(
    records.map((record) => [record.id, record.hizb_number]),
  );

  let domain: { min: number; max: number };
  let preferred: number[];
  switch (type) {
    case "ayah_number":
      domain = {
        min: 1,
        max: Math.max(1, getSurahAyahCount(mushafData, verse.sura_no)),
      };
      preferred = pool
        .filter((item) => item.sura_no === verse.sura_no)
        .map((item) => item.aya_no);
      break;
    case "juz_number":
      domain = { min: 1, max: TOTAL_JUZ };
      preferred = pool.map((item) => item.jozz);
      break;
    case "hizb_number":
      domain = { min: 1, max: TOTAL_HIZB };
      preferred = pool
        .map((item) => hizbByVerseId.get(item.id))
        .filter((hizb): hizb is number => hizb !== undefined);
      break;
    default:
      domain = { min: 1, max: TOTAL_PAGES };
      preferred = pool.map((item) => item.page);
      break;
  }

  const distractors = buildNumericDistractors({
    correct,
    ...domain,
    preferred,
  });
  // A three-ayah surah honestly has only three answers; anything larger must
  // offer a full set of options.
  const domainSize = domain.max - domain.min + 1;
  const required = Math.min(DEFAULT_CHOICE_COUNT, domainSize);
  if (distractors.length + 1 < required) return null;

  const correctChoiceId = String(correct);
  return {
    correctChoiceId,
    choices: buildChoices(
      { id: correctChoiceId, label: correctChoiceId },
      distractors.map((value) => ({ id: String(value), label: String(value) })),
      required,
    ),
  };
}

function buildSurahChoices(
  input: InfoQuestionInput,
): { choices: QuizChoice[]; correctChoiceId: string } | null {
  const { verse, pool, surahName } = input;
  const distractors = buildSurahDistractors(
    verse.sura_no,
    pool.map((item) => item.sura_no),
  );
  if (distractors.length + 1 < Math.min(DEFAULT_CHOICE_COUNT, TOTAL_SURAHS)) {
    return null;
  }

  const correctChoiceId = String(verse.sura_no);
  return {
    correctChoiceId,
    choices: buildChoices(
      { id: correctChoiceId, label: surahName(verse.sura_no) },
      distractors.map((surah) => ({
        id: String(surah),
        label: surahName(surah),
      })),
    ),
  };
}

export function generateInfoQuestion(
  input: InfoQuestionInput,
): InfoQuizQuestion | null {
  const correct = getCorrectValue(input);
  if (correct === null) return null;

  const built =
    input.type === "surah_name"
      ? buildSurahChoices(input)
      : buildNumericChoices(input, correct);
  if (!built) return null;

  return {
    id: createQuestionId(),
    type: input.type,
    verse: input.verse,
    verseKey: toVerseKey(input.verse),
    testedVerseKey: toVerseKey(input.verse),
    choices: built.choices,
    correctChoiceId: built.correctChoiceId,
  };
}
