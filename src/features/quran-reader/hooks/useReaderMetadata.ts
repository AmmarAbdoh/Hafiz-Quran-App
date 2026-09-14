import { useMemo } from "react";
import type { MushafVerse, VerseInfoRecord } from "@/domain/quran";
import { useReaderSurahName } from "@/features/quran-reader/hooks/useReaderSurahName";
import type { MushafLayoutMode } from "@/features/quran-reader/model/quranReaderRoutes";
import { selectReaderMetadata } from "@/features/quran-reader/model/readerPageModel";

interface UseReaderMetadataOptions {
  layoutMode: MushafLayoutMode;
  currentPage: number;
  currentSurahNumber: number;
  visibleSurahPage: number;
  mushafData: MushafVerse[];
  verseInfoRecords: VerseInfoRecord[];
}

export function useReaderMetadata(options: UseReaderMetadataOptions) {
  const {
    layoutMode,
    currentPage,
    currentSurahNumber,
    visibleSurahPage,
    mushafData,
    verseInfoRecords,
  } = options;
  const surahName = useReaderSurahName(mushafData);

  // Metadata lookup scans the corpus and verse information. It only needs to
  // change when the visible page, its source data, or the language changes.
  return useMemo(
    () =>
      selectReaderMetadata({
        layoutMode,
        currentPage,
        currentSurahNumber,
        visibleSurahPage,
        mushafData,
        verseInfoRecords,
        surahName,
      }),
    [
      currentPage,
      currentSurahNumber,
      layoutMode,
      mushafData,
      surahName,
      verseInfoRecords,
      visibleSurahPage,
    ],
  );
}
