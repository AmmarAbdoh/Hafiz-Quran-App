import type { MushafVerse, VerseInfoRecord } from "@/domain/quran";
import type { QuestionType } from "./types";

/**
 * What a chosen scope actually contains. Question types are only fair when the
 * scope spans more than one possible answer, so the setup screen and the
 * generators both reason about the pool instead of guessing from the scope mode.
 */
export interface ScopeCoverage {
  ayahCount: number;
  surahNumbers: number[];
  juzNumbers: number[];
  hizbNumbers: number[];
  pageNumbers: number[];
}

function sortedUnique(values: number[]): number[] {
  return [...new Set(values)].sort((left, right) => left - right);
}

export function describeScopeCoverage(
  pool: MushafVerse[],
  records: VerseInfoRecord[],
): ScopeCoverage {
  const hizbByVerseId = new Map(
    records.map((record) => [record.id, record.hizb_number]),
  );
  const hizbNumbers: number[] = [];
  for (const verse of pool) {
    const hizb = hizbByVerseId.get(verse.id);
    if (hizb !== undefined) hizbNumbers.push(hizb);
  }

  return {
    ayahCount: pool.length,
    surahNumbers: sortedUnique(pool.map((verse) => verse.sura_no)),
    juzNumbers: sortedUnique(pool.map((verse) => verse.jozz)),
    hizbNumbers: sortedUnique(hizbNumbers),
    pageNumbers: sortedUnique(pool.map((verse) => verse.page)),
  };
}

/**
 * Recall questions need enough neighbouring ayahs to build believable wrong
 * answers; location questions need the scope to span more than one value, or
 * the answer is whatever the learner already sees in front of them.
 */
const MIN_RECALL_AYAHS = 4;

export type QuestionTypeAvailability =
  | { available: true }
  | { available: false; reason: "tooFewAyahs" | "singleValue" | "noHizbData" };

export function getQuestionTypeAvailability(
  type: QuestionType,
  coverage: ScopeCoverage,
): QuestionTypeAvailability {
  const unavailable = (reason: "tooFewAyahs" | "singleValue" | "noHizbData") =>
    ({ available: false, reason }) as const;

  switch (type) {
    case "fill_blank":
      return coverage.ayahCount < 2
        ? unavailable("tooFewAyahs")
        : { available: true };
    case "complete_ayah":
    case "audio_identify":
      return coverage.ayahCount < MIN_RECALL_AYAHS
        ? unavailable("tooFewAyahs")
        : { available: true };
    case "surah_name":
      return coverage.surahNumbers.length < 2
        ? unavailable("singleValue")
        : { available: true };
    case "ayah_number":
      return coverage.ayahCount < 2
        ? unavailable("tooFewAyahs")
        : { available: true };
    case "juz_number":
      return coverage.juzNumbers.length < 2
        ? unavailable("singleValue")
        : { available: true };
    case "hizb_number":
      if (coverage.hizbNumbers.length === 0) return unavailable("noHizbData");
      return coverage.hizbNumbers.length < 2
        ? unavailable("singleValue")
        : { available: true };
    case "page_number":
      return coverage.pageNumbers.length < 2
        ? unavailable("singleValue")
        : { available: true };
  }
}

export function isQuestionTypeAvailable(
  type: QuestionType,
  coverage: ScopeCoverage,
): boolean {
  return getQuestionTypeAvailability(type, coverage).available;
}
