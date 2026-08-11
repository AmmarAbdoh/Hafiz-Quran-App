import type { MushafVerse } from "@/domain/quran";
import type { QuizScope } from "./types";

export function toVerseKey(verse: MushafVerse): string {
  return `${verse.sura_no}:${verse.aya_no}`;
}

export function parseVerseKey(key: string): { surah: number; ayah: number } {
  const [surahPart, ayahPart] = key.split(":");
  return {
    surah: Number.parseInt(surahPart ?? "0", 10),
    ayah: Number.parseInt(ayahPart ?? "0", 10),
  };
}

export function buildVersePool(
  mushafData: MushafVerse[],
  scope: QuizScope,
): MushafVerse[] {
  switch (scope.mode) {
    case "surah": {
      const selected = new Set(scope.surahIndices ?? []);
      return mushafData.filter((verse) => selected.has(verse.sura_no));
    }
    case "juz": {
      const selected = new Set(scope.juzIndices ?? []);
      return mushafData.filter((verse) => selected.has(verse.jozz));
    }
    case "page": {
      const from = scope.pageFrom ?? 1;
      const to = scope.pageTo ?? from;
      return mushafData.filter(
        (verse) => verse.page >= from && verse.page <= to,
      );
    }
    case "ayah_range": {
      const surah = scope.ayahRangeSurah ?? 1;
      const from = scope.ayahFrom ?? 1;
      const to = scope.ayahTo ?? from;
      return mushafData.filter(
        (verse) =>
          verse.sura_no === surah && verse.aya_no >= from && verse.aya_no <= to,
      );
    }
  }
}

export function getAdjacentVersesInSurah(
  pool: MushafVerse[],
  mushafData: MushafVerse[],
  verse: MushafVerse,
): { previous: MushafVerse | null; next: MushafVerse | null } {
  const surahVerses = mushafData
    .filter((item) => item.sura_no === verse.sura_no)
    .sort((left, right) => left.aya_no - right.aya_no);
  const index = surahVerses.findIndex((item) => item.aya_no === verse.aya_no);
  if (index < 0) return { previous: null, next: null };

  const poolKeys = new Set(pool.map(toVerseKey));
  const previousCandidate = surahVerses[index - 1] ?? null;
  const nextCandidate = surahVerses[index + 1] ?? null;
  return {
    previous:
      previousCandidate && poolKeys.has(toVerseKey(previousCandidate))
        ? previousCandidate
        : null,
    next:
      nextCandidate && poolKeys.has(toVerseKey(nextCandidate))
        ? nextCandidate
        : null,
  };
}

export function shuffleArray<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex]!, copy[index]!];
  }
  return copy;
}
