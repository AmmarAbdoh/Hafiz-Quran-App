import { useMemo } from "react";
import type { MushafVerse, VerseInfoRecord } from "@/domain/quran";
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

  // Metadata lookup scans the corpus and verse information. It only needs to
  // change when the visible page or its source data changes.
  return useMemo(
    () =>
      selectReaderMetadata({
        layoutMode,
        currentPage,
        currentSurahNumber,
        visibleSurahPage,
        mushafData,
        verseInfoRecords,
      }),
    [
      currentPage,
      currentSurahNumber,
      layoutMode,
      mushafData,
      verseInfoRecords,
      visibleSurahPage,
    ],
  );
}
