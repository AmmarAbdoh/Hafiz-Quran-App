import { TOTAL_MUSHAF_PAGES, getSurahAyahCount } from "@/domain/quran";
import type { MushafVerse } from "@/domain/quran";
import type { QuizScope } from "./types";

export type ScopeValidationError =
  | "pickSurah"
  | "pickJuz"
  | "invalidPageRange"
  | "invalidAyahRange";

function isPositiveInteger(value: number | undefined): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

export function validateScope(
  scope: QuizScope,
  mushafData: MushafVerse[],
): ScopeValidationError | null {
  switch (scope.mode) {
    case "surah":
      return (scope.surahIndices?.length ?? 0) > 0 ? null : "pickSurah";
    case "juz":
      return (scope.juzIndices?.length ?? 0) > 0 ? null : "pickJuz";
    case "page": {
      const { pageFrom: from, pageTo: to } = scope;
      const valid =
        isPositiveInteger(from) &&
        isPositiveInteger(to) &&
        from <= to &&
        to <= TOTAL_MUSHAF_PAGES;
      return valid ? null : "invalidPageRange";
    }
    case "ayah_range": {
      const { ayahRangeSurah: surah, ayahFrom: from, ayahTo: to } = scope;
      if (!isPositiveInteger(surah) || surah > 114) return "invalidAyahRange";
      const valid =
        isPositiveInteger(from) &&
        isPositiveInteger(to) &&
        from <= to &&
        to <= getSurahAyahCount(mushafData, surah);
      return valid ? null : "invalidAyahRange";
    }
  }
}
