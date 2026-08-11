import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useParams } from "react-router-dom";
import { preloadQcfFontsForReaderPage, useQuranData } from "@/domain/quran";
import { AyahSearchDialog } from "@/features/quran-reader/components/AyahSearchDialog";
import { ListenOptionsDialog } from "@/features/quran-reader/components/ListenOptionsDialog";
import { MushafAudioBar } from "@/features/quran-reader/components/MushafAudioBar";
import { MushafBottomChrome } from "@/features/quran-reader/components/MushafBottomChrome";
import { MushafFooter } from "@/features/quran-reader/components/MushafFooter";
import { MushafSurahFooter } from "@/features/quran-reader/components/MushafSurahFooter";
import { MushafSurahPlaybackDock } from "@/features/quran-reader/components/MushafSurahPlaybackDock";
import { MushafSurahViewer } from "@/features/quran-reader/components/MushafSurahViewer";
import { MushafViewer } from "@/features/quran-reader/components/MushafViewer";
import { PracticeAudioBar } from "@/features/quran-reader/components/PracticeAudioBar";
import { SurahDrawer } from "@/features/quran-reader/components/SurahDrawer";
import { TajweedLegendDialog } from "@/features/quran-reader/components/TajweedLegendDialog";
import { useMushafReader } from "@/features/quran-reader/context/MushafReaderContext";
import {
  useQuranPlaybackActions,
  useQuranPlaybackState,
} from "@/features/quran-reader/context/QuranPlaybackContext";
import { usePlaybackNavigationSync } from "@/features/quran-reader/hooks/usePlaybackNavigationSync";
import { useReaderDerivedState } from "@/features/quran-reader/hooks/useReaderDerivedState";
import { useReaderHeaderSync } from "@/features/quran-reader/hooks/useReaderHeaderSync";
import { useReaderKeyboardNavigation } from "@/features/quran-reader/hooks/useReaderKeyboardNavigation";
import { useReaderMetadata } from "@/features/quran-reader/hooks/useReaderMetadata";
import { useReaderNavigation } from "@/features/quran-reader/hooks/useReaderNavigation";
import { useReaderOverlays } from "@/features/quran-reader/hooks/useReaderOverlays";
import { useReaderPreferences } from "@/features/quran-reader/hooks/useReaderPreferences";
import { useSurahPageNavigation } from "@/features/quran-reader/hooks/useSurahPageNavigation";
import { useVerseHighlight } from "@/features/quran-reader/hooks/useVerseHighlight";
import {
  RECITATION_PRACTICE_AVAILABLE as RECITATION_PRACTICE_ENABLED,
  useRecitationPractice,
} from "@practice/runtime";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useTheme } from "@/shared/hooks/use-theme";
import { cn } from "@/shared/lib/utils";
import "./quran-reader.css";

const DEFAULT_TOTAL_PAGES = 604;

export function QuranReaderPage() {
  const { t } = useTranslation("reader");
  const { t: tErrors } = useTranslation("errors");
  const location = useLocation();
  const params = useParams<
    "first" | "second" | "pageNumber" | "surahNumber" | "ayahNumber"
  >();
  const { setHeader } = useMushafReader();
  const {
    mushafData,
    loadedPageLayouts,
    verseInfoRecords,
    loading: coreLoading,
    layoutLoading,
    error,
    errorRetryable,
    loadPageLayout,
    loadSurahLayouts,
    retryCoreData,
    clearError,
  } = useQuranData();
  const { active, activeVerseKey, autoFollowPages } = useQuranPlaybackState();
  const {
    registerPageNavigator,
    setActiveVerseInView,
    setAutoFollowPages,
    stop: stopPlayback,
  } = useQuranPlaybackActions();
  const {
    active: practiceActive,
    loadingModel: practiceLoading,
    startPractice,
    stopPractice,
  } = useRecitationPractice();
  const { theme } = useTheme();

  const layoutRef = useRef<HTMLDivElement>(null);
  const mushafStageRef = useRef<HTMLDivElement>(null);
  const totalPages = DEFAULT_TOTAL_PAGES;
  const loading = coreLoading || layoutLoading;

  const preferences = useReaderPreferences();
  const { route, surahLayout, currentPageLayout } = useReaderDerivedState({
    pathname: location.pathname,
    params,
    mushafData,
    loadedPageLayouts,
    totalPages,
  });
  const surahNavigation = useSurahPageNavigation({
    loading,
    layoutMode: route.layoutMode,
    currentSurahNumber: route.currentSurahNumber,
    routeContext: route.routeContext,
    locationKey: location.key,
    pages: surahLayout.pages,
    mushafData,
  });
  const metadata = useReaderMetadata({
    layoutMode: route.layoutMode,
    currentPage: route.currentPage,
    currentSurahNumber: route.currentSurahNumber,
    visibleSurahPage: surahNavigation.visiblePage,
    mushafData,
    verseInfoRecords,
  });
  const highlight = useVerseHighlight({
    loading,
    mushafData,
    routeContext: route.routeContext,
    locationKey: location.key,
  });
  const navigation = useReaderNavigation({
    loading,
    pathname: location.pathname,
    params,
    routeContext: route.routeContext,
    layoutMode: route.layoutMode,
    currentPage: route.currentPage,
    currentSurahNumber: route.currentSurahNumber,
    totalPages,
    mushafData,
    playbackActive: active,
    activeVerseKey,
    setAutoFollowPages,
    practiceActive,
    stopPractice,
    clearHighlight: highlight.clearHighlight,
    queueHighlight: highlight.queueHighlight,
  });
  const overlays = useReaderOverlays({
    layoutMode: route.layoutMode,
    currentPage: route.currentPage,
    currentSurahNumber: route.currentSurahNumber,
    practiceActive,
    stopPractice,
  });

  const togglePractice = useCallback(async () => {
    if (!RECITATION_PRACTICE_ENABLED || !currentPageLayout) return;

    if (practiceActive) {
      stopPractice();
      return;
    }

    stopPlayback();
    const pageWords = currentPageLayout.lines
      .flatMap((line) => line.words)
      .filter((word) => word.char_type !== "end");
    await startPractice(pageWords);
  }, [
    currentPageLayout,
    practiceActive,
    startPractice,
    stopPlayback,
    stopPractice,
  ]);

  useEffect(() => {
    if (route.layoutMode !== "page") return;
    preloadQcfFontsForReaderPage(
      route.currentPage,
      totalPages,
      theme,
      preferences.tajweedColored,
    );
  }, [
    preferences.tajweedColored,
    route.currentPage,
    route.layoutMode,
    theme,
    totalPages,
  ]);

  useReaderHeaderSync({
    enabled: !loading && !error,
    setHeader,
    tajweedColored: preferences.tajweedColored,
    legendPinned: preferences.legendPinned,
    layoutMode: route.layoutMode,
    practiceActive,
    practiceLoading,
    onTajweedColoredChange: preferences.changeTajweedColored,
    onLegendPinnedChange: preferences.changeLegendPinned,
    onLayoutModeChange: navigation.changeLayoutMode,
    onOpenLegendGuide: overlays.openLegendGuide,
    onOpenSurahDrawer: overlays.openSurahDrawer,
    onOpenAyahSearch: overlays.openAyahSearch,
    onOpenListenOptions: overlays.openListenOptions,
    onTogglePractice: togglePractice,
  });

  useReaderKeyboardNavigation({
    enabled: !loading,
    layoutMode: route.layoutMode,
    currentPage: route.currentPage,
    surahPages: surahLayout.pages,
    visibleSurahPage: surahNavigation.visiblePage,
    changePage: navigation.changePage,
    changeSurahPage: surahNavigation.changePage,
  });

  usePlaybackNavigationSync({
    layoutMode: route.layoutMode,
    currentPage: route.currentPage,
    surahPages: surahLayout.pages,
    mushafData,
    active,
    activeVerseKey,
    autoFollowPages,
    registerPageNavigator,
    setActiveVerseInView,
  });

  if (loading) {
    return (
      <div
        className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-4"
        aria-live="polite"
      >
        <Skeleton className="h-[30vh] w-full max-w-3xl" />
        <p className="text-center text-sm text-muted-foreground">
          {t("loading")}
        </p>
      </div>
    );
  }

  if (error) {
    const retry = () => {
      clearError();
      retryCoreData();
      const request =
        route.layoutMode === "page"
          ? loadPageLayout(route.currentPage)
          : loadSurahLayouts(route.currentSurahNumber);
      void request.catch(() => undefined);
    };

    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4">
        <p className="text-center text-destructive" role="alert">
          {tErrors("generic")} {error}
        </p>
        {errorRetryable && (
          <Button type="button" onClick={retry}>
            {tErrors("retry")}
          </Button>
        )}
      </div>
    );
  }

  const listenToSurah = (surahNumber: number) => {
    overlays.setSurahDrawerOpen(false);
    overlays.openListenOptions({ surah: surahNumber, scope: "surah" });
  };

  const selectSurah = (surahIndex: number) => {
    navigation.changeSurah(surahIndex + 1);
    overlays.setSurahDrawerOpen(false);
  };

  return (
    <div ref={layoutRef} className="mushaf-reader-layout">
      <div ref={mushafStageRef} className="mushaf-stage">
        <div
          className={cn(
            "mushaf-stage-inner",
            route.layoutMode === "surah" && "mushaf-stage-inner--surah",
          )}
        >
          {route.layoutMode === "page" && currentPageLayout && (
            <MushafViewer
              mushafData={mushafData}
              pageLayout={currentPageLayout}
              tajweedColored={preferences.tajweedColored}
              highlightVerseKey={highlight.highlightVerseKey}
            />
          )}

          {route.layoutMode === "surah" && (
            <MushafSurahViewer
              key={route.currentSurahNumber}
              mushafData={mushafData}
              pageLayouts={surahLayout.pageLayouts}
              surahNumber={route.currentSurahNumber}
              tajweedColored={preferences.tajweedColored}
              highlightVerseKey={highlight.highlightVerseKey}
              scrollContainerRef={mushafStageRef}
              onVisiblePageChange={surahNavigation.setVisiblePage}
              scrollToPageRef={surahNavigation.scrollToPageRef}
              scrollLockRef={surahNavigation.scrollLockRef}
              onSurahChange={navigation.changeSurah}
            />
          )}
        </div>
      </div>

      {(active || (RECITATION_PRACTICE_ENABLED && practiceActive)) && (
        <MushafSurahPlaybackDock layoutRef={layoutRef}>
          {RECITATION_PRACTICE_ENABLED && practiceActive ? (
            <PracticeAudioBar />
          ) : (
            <MushafAudioBar />
          )}
        </MushafSurahPlaybackDock>
      )}

      <MushafBottomChrome
        layoutRef={layoutRef}
        collapsePeekPx={route.layoutMode === "surah" ? 0 : undefined}
        pinned={preferences.footerPinned}
      >
        {route.layoutMode === "page" ? (
          <MushafFooter
            currentPage={route.currentPage}
            totalPages={totalPages}
            onPageChange={navigation.changePage}
            surahNames={metadata.surahNames}
            surahAyahCount={metadata.surahAyahCount}
            juzNumber={metadata.juzNumber}
            hizbNumber={metadata.hizbNumber}
            pinned={preferences.footerPinned}
            onPinnedChange={preferences.changeFooterPinned}
          />
        ) : (
          <MushafSurahFooter
            surahName={metadata.surahNames[0] ?? ""}
            ayahCount={metadata.surahAyahCount}
            currentSurah={route.currentSurahNumber}
            mushafData={mushafData}
            currentPage={surahNavigation.visiblePage}
            totalPages={totalPages}
            minPage={surahLayout.bounds.min}
            maxPage={surahLayout.bounds.max}
            pageSequence={surahLayout.pages}
            juzNumber={metadata.juzNumber}
            onPageChange={surahNavigation.changePage}
            onSurahChange={navigation.changeSurah}
            pinned={preferences.footerPinned}
            onPinnedChange={preferences.changeFooterPinned}
          />
        )}
      </MushafBottomChrome>

      <TajweedLegendDialog
        open={overlays.legendGuideOpen}
        onOpenChange={overlays.setLegendGuideOpen}
      />
      <AyahSearchDialog
        open={overlays.ayahSearchOpen}
        onOpenChange={overlays.setAyahSearchOpen}
        mushafData={mushafData}
        onAyahSelect={navigation.selectAyah}
      />
      <ListenOptionsDialog
        open={overlays.listenOpen}
        onOpenChange={overlays.setListenOpen}
        mushafData={mushafData}
        totalPages={totalPages}
        preset={overlays.listenPreset}
      />
      <SurahDrawer
        open={overlays.surahDrawerOpen}
        onOpenChange={overlays.setSurahDrawerOpen}
        mushafData={mushafData}
        currentSurah={route.currentSurahIndex}
        onSurahSelect={selectSurah}
        onListenToSurah={listenToSurah}
      />
    </div>
  );
}
