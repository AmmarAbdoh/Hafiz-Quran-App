import { useCallback } from "react";
import { getSurahTashkeelName, useSurahNames } from "@/domain/quran";
import type { MushafVerse } from "@/domain/quran";

/**
 * Reader chrome sits next to the page, so in Arabic it repeats the vocalized
 * name printed on it and in English it uses the transliteration.
 */
export function useReaderSurahName(
  mushafData: MushafVerse[],
): (surahNumber: number) => string {
  const { surahName, language } = useSurahNames();

  // Metadata selection memoizes on this lookup, so it may only change with the
  // language or the corpus.
  return useCallback(
    (surahNumber: number) =>
      language === "en"
        ? surahName(surahNumber)
        : getSurahTashkeelName(mushafData, surahNumber),
    [language, mushafData, surahName],
  );
}
