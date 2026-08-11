import { useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { MushafVerse } from "@/domain/quran";
import {
  assignQuranReaderLayout,
  buildCanonicalReaderPath,
  buildQuranAyahPath,
  buildQuranReaderPath,
  buildQuranSurahPath,
  clampSurah,
  type MushafLayoutMode,
  type QuranRouteContext,
  type QuranRouteParams,
} from "@/features/quran-reader/model/quranReaderRoutes";
import { findVersePage } from "@/features/quran-reader/model/readerPageModel";
import { findMushafVerse } from "@/domain/quran";

interface UseReaderNavigationOptions {
  loading: boolean;
  pathname: string;
  params: QuranRouteParams;
  routeContext: QuranRouteContext;
  layoutMode: MushafLayoutMode;
  currentPage: number;
  currentSurahNumber: number;
  totalPages: number;
  mushafData: MushafVerse[];
  playbackActive: boolean;
  activeVerseKey: string | null;
  setAutoFollowPages: (follow: boolean) => void;
  practiceActive: boolean;
  stopPractice: () => void;
  clearHighlight: () => void;
  queueHighlight: (verseKey: string) => void;
}

export function useReaderNavigation({
  loading,
  pathname,
  params,
  routeContext,
  layoutMode,
  currentPage,
  currentSurahNumber,
  totalPages,
  mushafData,
  playbackActive,
  activeVerseKey,
  setAutoFollowPages,
  practiceActive,
  stopPractice,
  clearHighlight,
  queueHighlight,
}: UseReaderNavigationOptions) {
  const navigate = useNavigate();

  // These handlers are consumed by the reader header and keyboard listener;
  // stable identity prevents those subscriptions from being replaced on every
  // playback state update.
  const changePage = useCallback(
    (page: number) => {
      if (page < 1 || page > totalPages) return;

      if (playbackActive && activeVerseKey) {
        const playbackPage = findVersePage(mushafData, activeVerseKey);
        if (playbackPage !== null && page !== playbackPage) {
          setAutoFollowPages(false);
        }
      }

      clearHighlight();
      if (practiceActive) stopPractice();
      void navigate(buildQuranReaderPath(page));
    },
    [
      activeVerseKey,
      clearHighlight,
      mushafData,
      navigate,
      playbackActive,
      practiceActive,
      setAutoFollowPages,
      stopPractice,
      totalPages,
    ],
  );

  const changeSurah = (surahNumber: number) => {
    const surah = clampSurah(surahNumber);
    if (surah === currentSurahNumber) return;

    clearHighlight();
    if (practiceActive) stopPractice();

    if (layoutMode === "surah") {
      void navigate(buildQuranSurahPath(surah));
      return;
    }

    const firstVerse = mushafData.find(
      (verse) => verse.sura_no === surah && verse.aya_no === 1,
    );
    if (firstVerse) void navigate(buildQuranReaderPath(firstVerse.page));
  };

  const selectAyah = (surah: number, ayah: number) => {
    const verse = findMushafVerse(mushafData, surah, ayah);
    if (!verse) return;

    if (practiceActive) stopPractice();
    queueHighlight(`${surah}:${ayah}`);

    const destination =
      layoutMode === "page"
        ? buildQuranReaderPath(verse.page)
        : buildQuranAyahPath(surah, ayah);
    void navigate(destination);
  };

  const changeLayoutMode = useCallback(
    (mode: MushafLayoutMode) => {
      if (mode === layoutMode) return;
      assignQuranReaderLayout(mode, currentPage, currentSurahNumber);
    },
    [currentPage, currentSurahNumber, layoutMode],
  );

  useEffect(() => {
    if (loading || mushafData.length === 0 || routeContext.type === "ayah") {
      return;
    }

    const canonicalPath = buildCanonicalReaderPath(
      {
        first: params.first,
        second: params.second,
        pageNumber: params.pageNumber,
        surahNumber: params.surahNumber,
        ayahNumber: params.ayahNumber,
      },
      mushafData,
      totalPages,
      pathname,
    );

    if (pathname !== canonicalPath) {
      void navigate(canonicalPath, { replace: true });
    }
  }, [
    loading,
    mushafData,
    navigate,
    params.ayahNumber,
    params.first,
    params.pageNumber,
    params.second,
    params.surahNumber,
    pathname,
    routeContext.type,
    totalPages,
  ]);

  return { changePage, changeSurah, selectAyah, changeLayoutMode };
}
