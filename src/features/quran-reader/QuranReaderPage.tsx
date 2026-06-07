import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { AyahSearchDialog } from "@/features/quran-reader/components/AyahSearchDialog";
import { ListenOptionsDialog } from "@/features/quran-reader/components/ListenOptionsDialog";
import { MushafBottomChrome } from "@/features/quran-reader/components/MushafBottomChrome";
import { MushafSurahPlaybackDock } from "@/features/quran-reader/components/MushafSurahPlaybackDock";
import { MushafAudioBar } from "@/features/quran-reader/components/MushafAudioBar";
import { PracticeAudioBar } from "@/features/quran-reader/components/PracticeAudioBar";
import { MushafFooter } from "@/features/quran-reader/components/MushafFooter";
import { MushafSurahFooter } from "@/features/quran-reader/components/MushafSurahFooter";
import { MushafSurahViewer } from "@/features/quran-reader/components/MushafSurahViewer";
import { MushafViewer } from "@/features/quran-reader/components/MushafViewer";
import { SurahDrawer } from "@/features/quran-reader/components/SurahDrawer";
import { TajweedLegendDialog } from "@/features/quran-reader/components/TajweedLegendDialog";
import { useMushafReader } from "@/features/quran-reader/context/MushafReaderContext";
import { useQuranData } from "@/features/quran-reader/context/QuranDataContext";
import { useQuranPlayback } from "@/features/quran-reader/context/QuranPlaybackContext";
import { useRecitationPractice } from "@/features/quran-reader/context/RecitationPracticeContext";
import { useMushafData } from "@/features/quran-reader/hooks/useMushafData";
import { useMushafWordLayout } from "@/features/quran-reader/hooks/useMushafWordLayout";
import { preloadQcfFontsForReaderPage } from "@/features/quran-reader/hooks/useQcfPageFont";
import { getAdjacentPageInSequence } from "@/features/quran-reader/hooks/useMushafScrollPageSpy";
import { getPageContentWords } from "@/features/quran-reader/lib/pageWordText";
import {
  assignQuranReaderLayout,
  buildCanonicalReaderPath,
  buildQuranAyahPath,
  buildQuranReaderPath,
  buildQuranSurahPath,
  clampSurah,
  getQuranRouteContext,
  isLegacyAyahRoute,
  parseExplicitAyahPath,
  primarySurahOnPage,
  resolveLayoutMode,
  resolveReaderPage,
  resolveReaderSurahNumber,
} from "@/features/quran-reader/lib/quranReaderRoutes";
import type { ListenPreset } from "@/features/quran-reader/types/listenPlan";
import type { MushafLayoutMode } from "@/features/quran-reader/lib/quranReaderRoutes";
import { findPageForVerse } from "@/features/quran-reader/utils/playbackUtils";
import { RECITATION_PRACTICE_ENABLED } from "@/shared/constants/feature-flags";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useTheme } from "@/shared/hooks/use-theme";
import { cn } from "@/shared/lib/utils";
import {
  findMushafVerse,
  getFirstVerseOnPage,
  getPageSurahNumbers,
  getSurahAyahCount,
  getSurahPages,
  getSurahTashkeelName,
  getVerseInfo,
  getWordLayoutForPage,
  getWordLayoutTotalPages,
  buildMushafPageItemsForSurah,
} from "@/shared/services/quran-data";

const TAJWEED_STORAGE_KEY = "mushaf-tajweed-colored";
const FOOTER_PINNED_STORAGE_KEY = "mushaf-footer-pinned";
const HIGHLIGHT_DURATION_MS = 3500;
const HIGHLIGHT_READY_DELAY_MS = 200;

function readTajweedPreference(): boolean {
  return localStorage.getItem(TAJWEED_STORAGE_KEY) === "true";
}

function readFooterPinnedPreference(): boolean {
  return localStorage.getItem(FOOTER_PINNED_STORAGE_KEY) === "true";
}

export function QuranReaderPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{
    first?: string;
    second?: string;
    surahNumber?: string;
    ayahNumber?: string;
  }>();

  const routeContext = useMemo(
    () => getQuranRouteContext(location.pathname, params),
    [
      location.pathname,
      params.first,
      params.second,
      params.surahNumber,
      params.ayahNumber,
    ],
  );

  const layoutMode: MushafLayoutMode = useMemo(
    () => resolveLayoutMode(params, location.pathname),
    [params, location.pathname],
  );
  const { setHeader } = useMushafReader();
  const { verseInfoRecords } = useQuranData();
  const {
    registerPageNavigator,
    setActiveVerseInView,
    active,
    activeVerseKey,
    autoFollowPages,
    setAutoFollowPages,
    stop: stopPlayback,
  } = useQuranPlayback();
  const practice = useRecitationPractice();

  const { data: mushafData, loading: metaLoading, error: metaError } =
    useMushafData();
  const {
    data: wordLayout,
    loading: layoutLoading,
    error: layoutError,
  } = useMushafWordLayout();

  const totalPages = wordLayout ? getWordLayoutTotalPages(wordLayout) : 604;

  const currentPage = useMemo(
    () => resolveReaderPage(params, mushafData, totalPages, location.pathname),
    [params, mushafData, totalPages, location.pathname],
  );

  const currentSurahNumber = useMemo(
    () =>
      resolveReaderSurahNumber(
        params,
        mushafData,
        currentPage,
        location.pathname,
      ),
    [params, mushafData, currentPage, location.pathname],
  );

  const currentSurahIndex = currentSurahNumber - 1;

  const surahPages = useMemo(() => {
    if (!mushafData.length || !wordLayout) return [];
    return getSurahPages(mushafData, currentSurahNumber).filter((page) => {
      const layout = getWordLayoutForPage(wordLayout, page);
      if (!layout) return false;
      return buildMushafPageItemsForSurah(layout, currentSurahNumber).length > 0;
    });
  }, [mushafData, wordLayout, currentSurahNumber]);

  const surahPageBounds = useMemo(() => {
    if (surahPages.length === 0) {
      return { min: 1, max: totalPages };
    }
    return {
      min: surahPages[0]!,
      max: surahPages[surahPages.length - 1]!,
    };
  }, [surahPages, totalPages]);

  const [surahDrawerOpen, setSurahDrawerOpen] = useState(false);
  const [ayahSearchOpen, setAyahSearchOpen] = useState(false);
  const [listenOpen, setListenOpen] = useState(false);
  const [listenPreset, setListenPreset] = useState<ListenPreset | null>(null);
  const [legendPinned, setLegendPinned] = useState(false);
  const [footerPinned, setFooterPinned] = useState(readFooterPinnedPreference);
  const [legendGuideOpen, setLegendGuideOpen] = useState(false);
  const [tajweedColored, setTajweedColored] = useState(readTajweedPreference);
  const { theme } = useTheme();
  const [pageSurahNames, setPageSurahNames] = useState<string[]>([]);
  const [surahAyahCount, setSurahAyahCount] = useState<number | undefined>();
  const [juzNumber, setJuzNumber] = useState<number | string | undefined>();
  const [hizbNumber, setHizbNumber] = useState<number | string | undefined>();
  const [highlightVerseKey, setHighlightVerseKey] = useState<string | null>(
    null,
  );
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingHighlightVerseKeyRef = useRef<string | null>(null);
  const layoutRef = useRef<HTMLDivElement>(null);
  const mushafStageRef = useRef<HTMLDivElement>(null);
  const scrollToSurahPageRef = useRef<((page: number) => void) | null>(null);
  const surahScrollLockRef = useRef<number | null>(null);
  const surahScrollUnlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [surahVisiblePage, setSurahVisiblePage] = useState(1);

  const loading = metaLoading || layoutLoading;
  const error = metaError ?? layoutError;

  useEffect(() => {
    if (layoutMode === "page") {
      preloadQcfFontsForReaderPage(
        currentPage,
        totalPages,
        theme,
        tajweedColored,
      );
    }
  }, [layoutMode, currentPage, totalPages, theme, tajweedColored]);

  const openListenOptions = useCallback(
    (preset?: ListenPreset) => {
      if (practice.active) practice.stopPractice();
      setListenPreset(
        preset ?? {
          page: layoutMode === "page" ? currentPage : undefined,
          surah: currentSurahNumber,
        },
      );
      setListenOpen(true);
    },
    [practice, layoutMode, currentPage, currentSurahNumber],
  );

  const handleListenToSurah = useCallback(
    (surahNumber: number) => {
      setSurahDrawerOpen(false);
      openListenOptions({ surah: surahNumber, scope: "surah" });
    },
    [openListenOptions],
  );

  const clearHighlightTimer = useCallback(() => {
    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = null;
    }
  }, []);

  const flashVerseHighlight = useCallback(
    (verseKey: string) => {
      clearHighlightTimer();
      setHighlightVerseKey(verseKey);
      highlightTimerRef.current = setTimeout(() => {
        setHighlightVerseKey(null);
        highlightTimerRef.current = null;
      }, HIGHLIGHT_DURATION_MS);
    },
    [clearHighlightTimer],
  );

  const handlePageChange = useCallback(
    (page: number) => {
      if (page < 1 || page > totalPages) return;

      if (active && activeVerseKey && wordLayout) {
        const playbackPage = findPageForVerse(wordLayout, activeVerseKey);
        if (playbackPage !== null && page !== playbackPage) {
          setAutoFollowPages(false);
        }
      }

      clearHighlightTimer();
      setHighlightVerseKey(null);
      if (practice.active) practice.stopPractice();

      navigate(
        buildQuranReaderPath(page, primarySurahOnPage(mushafData, page)),
      );
    },
    [
      totalPages,
      active,
      activeVerseKey,
      wordLayout,
      setAutoFollowPages,
      clearHighlightTimer,
      practice,
      navigate,
      mushafData,
    ],
  );

  const handleSurahChange = useCallback(
    (surahNumber: number) => {
      const surah = clampSurah(surahNumber);
      if (surah === currentSurahNumber) return;

      clearHighlightTimer();
      setHighlightVerseKey(null);
      if (practice.active) practice.stopPractice();

      if (layoutMode === "surah") {
        navigate(buildQuranSurahPath(surah));
        return;
      }

      const firstVerse = mushafData.find(
        (verse) => verse.sura_no === surah && verse.aya_no === 1,
      );
      if (firstVerse) {
        navigate(buildQuranReaderPath(firstVerse.page, surah));
      }
    },
    [
      currentSurahNumber,
      clearHighlightTimer,
      practice,
      navigate,
      layoutMode,
      mushafData,
    ],
  );

  const handleSurahSelect = useCallback(
    (surahIndex: number) => {
      handleSurahChange(surahIndex + 1);
      setSurahDrawerOpen(false);
    },
    [handleSurahChange],
  );

  const handleAyahSelect = useCallback(
    (surah: number, ayah: number) => {
      const verse = findMushafVerse(mushafData, surah, ayah);
      if (!verse) return;

      if (practice.active) practice.stopPractice();

      pendingHighlightVerseKeyRef.current = `${surah}:${ayah}`;

      if (layoutMode === "page") {
        navigate(buildQuranReaderPath(verse.page, surah));
        return;
      }

      navigate(buildQuranAyahPath(surah, ayah));
    },
    [mushafData, layoutMode, practice, navigate],
  );

  const handleTajweedColoredChange = useCallback((value: boolean) => {
    setTajweedColored(value);
    localStorage.setItem(TAJWEED_STORAGE_KEY, String(value));
    if (!value) setLegendPinned(false);
  }, []);

  const handleLayoutModeChange = useCallback(
    (mode: MushafLayoutMode) => {
      if (mode === layoutMode) return;

      assignQuranReaderLayout(mode, currentPage, currentSurahNumber);
    },
    [layoutMode, currentPage, currentSurahNumber],
  );

  const handleLegendPinnedChange = useCallback((pinned: boolean) => {
    setLegendPinned(pinned);
  }, []);

  const handleFooterPinnedChange = useCallback((pinned: boolean) => {
    setFooterPinned(pinned);
    localStorage.setItem(FOOTER_PINNED_STORAGE_KEY, String(pinned));
  }, []);

  const handleTogglePractice = useCallback(async () => {
    if (!RECITATION_PRACTICE_ENABLED || !wordLayout) return;

    if (practice.active) {
      practice.stopPractice();
      return;
    }

    stopPlayback();
    const pageWords = getPageContentWords(wordLayout, currentPage);
    await practice.startPractice(pageWords);
  }, [wordLayout, practice, stopPlayback, currentPage]);

  useEffect(() => {
    if (layoutMode === "surah") {
      setPageSurahNames([
        getSurahTashkeelName(mushafData, currentSurahNumber),
      ]);
      setSurahAyahCount(getSurahAyahCount(mushafData, currentSurahNumber));

      const firstVerse =
        getFirstVerseOnPage(mushafData, surahVisiblePage) ??
        mushafData.find(
          (verse) =>
            verse.sura_no === currentSurahNumber && verse.aya_no === 1,
        );
      if (!firstVerse) return;

      const info = getVerseInfo(firstVerse.id, verseInfoRecords);
      setJuzNumber(info.find((item) => item.key === "رقم الجزء")?.value);
      setHizbNumber(undefined);
      return;
    }

    const firstVerse = getFirstVerseOnPage(mushafData, currentPage);
    if (!firstVerse) return;

    const pageSurahs = getPageSurahNumbers(mushafData, currentPage);
    setPageSurahNames(
      pageSurahs.map((surahNumber) =>
        getSurahTashkeelName(mushafData, surahNumber),
      ),
    );
    setSurahAyahCount(
      pageSurahs.length === 1
        ? getSurahAyahCount(mushafData, pageSurahs[0]!)
        : undefined,
    );

    const info = getVerseInfo(firstVerse.id, verseInfoRecords);
    setJuzNumber(info.find((item) => item.key === "رقم الجزء")?.value);
    setHizbNumber(info.find((item) => item.key === "رقم الحزب")?.value);
  }, [
    layoutMode,
    currentPage,
    currentSurahNumber,
    surahVisiblePage,
    mushafData,
    verseInfoRecords,
  ]);

  useEffect(() => {
    if (layoutMode !== "surah" || surahPages.length === 0) return;
    if (
      routeContext.type === "ayah" &&
      routeContext.surah === currentSurahNumber
    ) {
      return;
    }
    setSurahVisiblePage(surahPages[0]!);
  }, [layoutMode, currentSurahNumber, surahPages, routeContext]);

  const handleSurahPageChange = useCallback(
    (page: number) => {
      if (!surahPages.includes(page)) return;

      if (surahScrollUnlockTimerRef.current) {
        clearTimeout(surahScrollUnlockTimerRef.current);
      }

      surahScrollLockRef.current = page;
      setSurahVisiblePage(page);
      scrollToSurahPageRef.current?.(page);

      surahScrollUnlockTimerRef.current = setTimeout(() => {
        surahScrollLockRef.current = null;
      }, 1200);
    },
    [surahPages],
  );

  useEffect(() => {
    if (loading || error) {
      setHeader(null);
      return;
    }

    setHeader({
      tajweedColored,
      legendPinned,
      layoutMode,
      practiceActive: practice.active,
      practiceLoading: practice.loadingModel,
      onTajweedColoredChange: handleTajweedColoredChange,
      onLegendPinnedChange: handleLegendPinnedChange,
      onLayoutModeChange: handleLayoutModeChange,
      onOpenLegendGuide: () => setLegendGuideOpen(true),
      onOpenSurahDrawer: () => setSurahDrawerOpen(true),
      onOpenAyahSearch: () => setAyahSearchOpen(true),
      onOpenListenOptions: () => openListenOptions(),
      onTogglePractice: () => {
        void handleTogglePractice();
      },
    });

    return () => setHeader(null);
  }, [
    loading,
    error,
    tajweedColored,
    legendPinned,
    layoutMode,
    handleTajweedColoredChange,
    handleLegendPinnedChange,
    handleLayoutModeChange,
    handleTogglePractice,
    openListenOptions,
    practice.active,
    practice.loadingModel,
    setHeader,
  ]);

  useEffect(() => {
    if (loading) return;
    if (!isLegacyAyahRoute(params.first, params.second)) return;
    if (parseExplicitAyahPath(location.pathname)) return;

    navigate(
      buildQuranAyahPath(
        Number.parseInt(params.first!, 10),
        Number.parseInt(params.second!, 10),
      ),
      { replace: true },
    );
  }, [
    loading,
    params.first,
    params.second,
    location.pathname,
    navigate,
  ]);

  useEffect(() => {
    if (loading || !mushafData.length) return;
    if (layoutMode !== "surah" || routeContext.type !== "ayah") return;

    const verse = findMushafVerse(
      mushafData,
      routeContext.surah,
      routeContext.ayah,
    );
    if (!verse || !surahPages.includes(verse.page)) return;

    if (surahScrollUnlockTimerRef.current) {
      clearTimeout(surahScrollUnlockTimerRef.current);
    }

    surahScrollLockRef.current = verse.page;
    setSurahVisiblePage(verse.page);

    const scrollTimer = setTimeout(() => {
      scrollToSurahPageRef.current?.(verse.page);
    }, 50);

    surahScrollUnlockTimerRef.current = setTimeout(() => {
      surahScrollLockRef.current = null;
    }, 1200);

    return () => clearTimeout(scrollTimer);
  }, [
    loading,
    mushafData,
    layoutMode,
    routeContext,
    surahPages,
    location.key,
  ]);

  useEffect(() => {
    if (loading || !mushafData.length) return;

    let verseKey: string | null = null;

    if (routeContext.type === "ayah") {
      verseKey = `${routeContext.surah}:${routeContext.ayah}`;
    } else if (pendingHighlightVerseKeyRef.current) {
      verseKey = pendingHighlightVerseKeyRef.current;
      pendingHighlightVerseKeyRef.current = null;
    }

    if (!verseKey) return;

    const [surahPart, ayahPart] = verseKey.split(":");
    const surah = Number.parseInt(surahPart ?? "", 10);
    const ayah = Number.parseInt(ayahPart ?? "", 10);
    if (!findMushafVerse(mushafData, surah, ayah)) return;

    const timer = window.setTimeout(() => {
      flashVerseHighlight(verseKey!);
    }, HIGHLIGHT_READY_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [
    loading,
    mushafData,
    routeContext,
    location.key,
    flashVerseHighlight,
  ]);

  useEffect(() => {
    if (loading || !mushafData.length) return;
    if (routeContext.type === "ayah") return;
    if (isLegacyAyahRoute(params.first, params.second)) return;

    const canonicalPath = buildCanonicalReaderPath(
      params,
      mushafData,
      totalPages,
      location.pathname,
    );

    if (location.pathname !== canonicalPath) {
      navigate(canonicalPath, { replace: true });
    }
  }, [
    loading,
    mushafData,
    location.pathname,
    navigate,
    params.first,
    params.second,
    routeContext.type,
    totalPages,
  ]);

  useEffect(() => {
    if (loading) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      if (layoutMode === "surah") {
        if (event.key === "ArrowRight") {
          event.preventDefault();
          const page = getAdjacentPageInSequence(
            surahPages,
            surahVisiblePage,
            "prev",
          );
          if (page !== null) handleSurahPageChange(page);
        } else if (event.key === "ArrowLeft") {
          event.preventDefault();
          const page = getAdjacentPageInSequence(
            surahPages,
            surahVisiblePage,
            "next",
          );
          if (page !== null) handleSurahPageChange(page);
        }
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        handlePageChange(currentPage - 1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        handlePageChange(currentPage + 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    loading,
    currentPage,
    handlePageChange,
    handleSurahPageChange,
    layoutMode,
    surahPages,
    surahVisiblePage,
  ]);

  useEffect(() => {
    if (!wordLayout) return;

    registerPageNavigator((verseKey) => {
      const page = findPageForVerse(wordLayout, verseKey);
      if (!page) return;

      const [surahPart] = verseKey.split(":");
      const surahNumber = Number.parseInt(surahPart ?? "1", 10);

      if (layoutMode === "surah") {
        navigate(buildQuranSurahPath(surahNumber), { replace: true });
        return;
      }

      navigate(
        buildQuranReaderPath(
          page,
          Number.isFinite(surahNumber)
            ? surahNumber
            : primarySurahOnPage(mushafData, page),
        ),
        { replace: true },
      );
    });

    return () => registerPageNavigator(null);
  }, [wordLayout, registerPageNavigator, navigate, mushafData, layoutMode]);

  useEffect(() => {
    if (
      layoutMode !== "page" ||
      !wordLayout ||
      !active ||
      !activeVerseKey ||
      !autoFollowPages
    ) {
      return;
    }

    const targetPage = findPageForVerse(wordLayout, activeVerseKey);
    if (!targetPage || targetPage === currentPage) return;

    navigate(
      buildQuranReaderPath(
        targetPage,
        primarySurahOnPage(mushafData, targetPage),
      ),
      { replace: true },
    );
  }, [
    layoutMode,
    wordLayout,
    active,
    activeVerseKey,
    autoFollowPages,
    currentPage,
    mushafData,
    navigate,
  ]);

  useEffect(() => {
    if (!wordLayout || !active || !activeVerseKey) {
      setActiveVerseInView(false);
      return;
    }

    const page = findPageForVerse(wordLayout, activeVerseKey);

    if (layoutMode === "surah") {
      const surahPages = getSurahPages(mushafData, currentSurahNumber);
      setActiveVerseInView(page !== null && surahPages.includes(page));
      return;
    }

    setActiveVerseInView(page === currentPage);
  }, [
    wordLayout,
    active,
    activeVerseKey,
    currentPage,
    currentSurahNumber,
    layoutMode,
    mushafData,
    setActiveVerseInView,
  ]);

  useEffect(
    () => () => setActiveVerseInView(false),
    [setActiveVerseInView],
  );

  useEffect(() => () => clearHighlightTimer(), [clearHighlightTimer]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-4">
        <Skeleton className="h-[30vh] w-full max-w-3xl" />
        {layoutMode === "surah" && (
          <p className="text-center text-sm text-muted-foreground">
            جاري تحميل السورة…
          </p>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4">
        <p className="text-center text-destructive">
          تعذر تحميل بيانات المصحف: {error}
        </p>
      </div>
    );
  }

  return (
    <div ref={layoutRef} className="mushaf-reader-layout">
      <div ref={mushafStageRef} className="mushaf-stage">
        <div
          className={cn(
            "mushaf-stage-inner",
            layoutMode === "surah" && "mushaf-stage-inner--surah",
          )}
        >
          {wordLayout && layoutMode === "page" && (
            <MushafViewer
              mushafData={mushafData}
              wordLayout={wordLayout}
              currentPage={currentPage}
              tajweedColored={tajweedColored}
              highlightVerseKey={highlightVerseKey}
            />
          )}

          {wordLayout && layoutMode === "surah" && (
            <MushafSurahViewer
              mushafData={mushafData}
              wordLayout={wordLayout}
              surahNumber={currentSurahNumber}
              tajweedColored={tajweedColored}
              highlightVerseKey={highlightVerseKey}
              scrollContainerRef={mushafStageRef}
              onVisiblePageChange={setSurahVisiblePage}
              scrollToPageRef={scrollToSurahPageRef}
              scrollLockRef={surahScrollLockRef}
              onSurahChange={handleSurahChange}
            />
          )}
        </div>
      </div>

      {(active ||
        (RECITATION_PRACTICE_ENABLED && practice.active)) && (
        <MushafSurahPlaybackDock layoutRef={layoutRef}>
          {RECITATION_PRACTICE_ENABLED && practice.active ? (
            <PracticeAudioBar />
          ) : (
            <MushafAudioBar />
          )}
        </MushafSurahPlaybackDock>
      )}

      <MushafBottomChrome
        layoutRef={layoutRef}
        collapsePeekPx={layoutMode === "surah" ? 0 : undefined}
        pinned={footerPinned}
      >
        {layoutMode === "page" ? (
          <MushafFooter
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            surahNames={pageSurahNames}
            surahAyahCount={surahAyahCount}
            juzNumber={juzNumber}
            hizbNumber={hizbNumber}
            pinned={footerPinned}
            onPinnedChange={handleFooterPinnedChange}
          />
        ) : (
          <MushafSurahFooter
            surahName={pageSurahNames[0] ?? ""}
            ayahCount={surahAyahCount}
            currentPage={surahVisiblePage}
            totalPages={totalPages}
            minPage={surahPageBounds.min}
            maxPage={surahPageBounds.max}
            pageSequence={surahPages}
            juzNumber={juzNumber}
            onPageChange={handleSurahPageChange}
            pinned={footerPinned}
            onPinnedChange={handleFooterPinnedChange}
          />
        )}
      </MushafBottomChrome>

      <TajweedLegendDialog
        open={legendGuideOpen}
        onOpenChange={setLegendGuideOpen}
      />

      <AyahSearchDialog
        open={ayahSearchOpen}
        onOpenChange={setAyahSearchOpen}
        mushafData={mushafData}
        onAyahSelect={handleAyahSelect}
      />

      <ListenOptionsDialog
        open={listenOpen}
        onOpenChange={setListenOpen}
        mushafData={mushafData}
        totalPages={totalPages}
        preset={listenPreset}
      />

      <SurahDrawer
        open={surahDrawerOpen}
        onOpenChange={setSurahDrawerOpen}
        mushafData={mushafData}
        currentSurah={currentSurahIndex}
        onSurahSelect={handleSurahSelect}
        onListenToSurah={handleListenToSurah}
      />
    </div>
  );
}
