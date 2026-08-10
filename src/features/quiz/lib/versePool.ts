import type { MushafVerse, QuizScope } from "@/shared/types/quran";

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
      const indices = new Set(scope.surahIndices ?? []);
      return mushafData.filter((verse) => indices.has(verse.sura_no));
    }
    case "juz": {
      const indices = new Set(scope.juzIndices ?? []);
      return mushafData.filter((verse) => indices.has(verse.jozz));
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
          verse.sura_no === surah &&
          verse.aya_no >= from &&
          verse.aya_no <= to,
      );
    }
    default:
      return [];
  }
}

export function getAdjacentVersesInSurah(
  pool: MushafVerse[],
  mushafData: MushafVerse[],
  verse: MushafVerse,
): { prev: MushafVerse | null; next: MushafVerse | null } {
  const surahVerses = mushafData
    .filter((item) => item.sura_no === verse.sura_no)
    .sort((a, b) => a.aya_no - b.aya_no);

  const index = surahVerses.findIndex(
    (item) => item.sura_no === verse.sura_no && item.aya_no === verse.aya_no,
  );

  if (index === -1) {
    return { prev: null, next: null };
  }

  const prevCandidate = surahVerses[index - 1] ?? null;
  const nextCandidate = surahVerses[index + 1] ?? null;
  const poolKeys = new Set(pool.map(toVerseKey));

  return {
    prev:
      prevCandidate && poolKeys.has(toVerseKey(prevCandidate))
        ? prevCandidate
        : null,
    next:
      nextCandidate && poolKeys.has(toVerseKey(nextCandidate))
        ? nextCandidate
        : null,
  };
}

export function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex]!, copy[index]!];
  }
  return copy;
}

export function summarizeQuizScope(scope: QuizScope): string {
  switch (scope.mode) {
    case "surah":
      return `${scope.surahIndices?.length ?? 0} سورة`;
    case "juz":
      return `${scope.juzIndices?.length ?? 0} جزء`;
    case "page":
      return scope.pageFrom === scope.pageTo
        ? `صفحة ${scope.pageFrom}`
        : `صفحات ${scope.pageFrom}–${scope.pageTo}`;
    case "ayah_range":
      return `سورة ${scope.ayahRangeSurah} (${scope.ayahFrom}–${scope.ayahTo})`;
    default:
      return "نطاق مخصص";
  }
}
