import { useMemo } from "react";
import type { MushafPageLayout, MushafVerse } from "@/domain/quran";
import type { QuranRouteParams } from "@/features/quran-reader/model/quranReaderRoutes";
import {
  selectReaderRouteState,
  selectReaderSurahLayout,
} from "@/features/quran-reader/model/readerPageModel";

interface UseReaderDerivedStateOptions {
  pathname: string;
  params: QuranRouteParams;
  mushafData: MushafVerse[];
  loadedPageLayouts: MushafPageLayout[];
  totalPages: number;
}

export function useReaderDerivedState({
  pathname,
  params,
  mushafData,
  loadedPageLayouts,
  totalPages,
}: UseReaderDerivedStateOptions) {
  const { first, second, pageNumber, surahNumber, ayahNumber } = params;

  // These selectors scan the verse corpus and loaded page layouts. Memoizing
  // keeps unrelated playback and dialog state from repeating that work.
  const route = useMemo(
    () =>
      selectReaderRouteState({
        pathname,
        params: { first, second, pageNumber, surahNumber, ayahNumber },
        mushafData,
        totalPages,
      }),
    [
      ayahNumber,
      first,
      mushafData,
      pageNumber,
      pathname,
      second,
      surahNumber,
      totalPages,
    ],
  );

  const surahLayout = useMemo(
    () =>
      selectReaderSurahLayout(
        mushafData,
        loadedPageLayouts,
        route.currentSurahNumber,
        totalPages,
      ),
    [loadedPageLayouts, mushafData, route.currentSurahNumber, totalPages],
  );

  const currentPageLayout =
    loadedPageLayouts.find((layout) => layout.page === route.currentPage) ??
    null;

  return { route, surahLayout, currentPageLayout };
}
