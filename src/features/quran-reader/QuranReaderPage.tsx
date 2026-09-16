import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useParams } from "react-router-dom";
import { useLocale } from "@/app/i18n";
import {
  MushafPageSkeleton,
  preloadQcfFontsForReaderPage,
  useQuranData,
} from "@/domain/quran";
import { AyahSearchDialog } from "@/features/quran-reader/components/AyahSearchDialog";
import { ListenOptionsDialog } from "@/features/quran-reader/components/ListenOptionsDialog";
import { MushafAudioBar } from "@/features/quran-reader/components/MushafAudioBar";
import { MushafBottomChrome } from "@/features/quran-reader/components/MushafBottomChrome";
import { MushafReaderBar } from "@/features/quran-reader/components/MushafReaderBar";
import { ReadingPreferencesSheet } from "@/features/quran-reader/components/ReadingPreferencesSheet";
import { MushafSurahViewer } from "@/features/quran-reader/components/MushafSurahViewer";
import { MushafViewer } from "@/features/quran-reader/components/MushafViewer";
import { PageControls } from "@/features/quran-reader/components/PageControls";
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
import { useReaderOverlays } from "@/features/quran-reader/hooks/useReaderOverlays";
import { useReaderMetadata } from "@/features/quran-reader/hooks/useReaderMetadata";
import { useReaderNavigation } from "@/features/quran-reader/hooks/useReaderNavigation";
import { useReaderChrome } from "@/features/quran-reader/hooks/useReaderChrome";
import { useReaderPositionPersistence } from "@/features/quran-reader/hooks/useReaderPositionPersistence";
import { useReaderGestures } from "@/features/quran-reader/hooks/useReaderGestures";
import { useReaderPreferences } from "@/features/quran-reader/hooks/useReaderPreferences";
import { useSurahPageNavigation } from "@/features/quran-reader/hooks/useSurahPageNavigation";
import { useVerseHighlight } from "@/features/quran-reader/hooks/useVerseHighlight";
import {
  RECITATION_PRACTICE_AVAILABLE as RECITATION_PRACTICE_ENABLED,
  useRecitationPractice,
} from "@practice/runtime";
import { Button } from "@/shared/components/ui/button";
import { useTheme } from "@/shared/hooks/use-theme";
import { cn } from "@/shared/lib/utils";
import "./quran-reader.css";

const DEFAULT_TOTAL_PAGES = 604;

export function QuranReaderPage() {
  const { t } = useTranslation("reader");
  const { t: tErrors } = useTranslation("errors");
  const { locale } = useLocale();
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
  const swipeNavigationRef = useRef({
    onNext: () => {},
    onPrevious: () => {},
  });
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
  const layoutReady =
    route.layoutMode === "page"
      ? currentPageLayout !== null
      : surahLayout.pageLayouts.length > 0;
  const awaitingLayout = mushafData.length > 0 && !layoutReady;
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
  // Practice takes over the page surface, so it stops the page responding to
  // taps and swipes. Listening does not: page turns stay live while a recitation
  // plays, otherwise the whole page reads as unresponsive.
  const practiceMode = RECITATION_PRACTICE_ENABLED && practiceActive;
  const readerChrome = useReaderChrome(!practiceMode);
  const [pageAnnouncement, setPageAnnouncement] = useState("");
  const skipPageAnnouncementRef = useRef(true);

  const currentAyah =
    route.routeContext.type === "ayah" ? route.routeContext.ayah : undefined;

  useReaderPositionPersistence({
    layoutMode: route.layoutMode,
    page: route.currentPage,
    surah: route.currentSurahNumber,
    ayah: currentAyah,
    scrollContainerRef: mushafStageRef,
  });

  useEffect(() => {
    layoutRef.current?.style.setProperty(
      "--mushaf-scale",
      String(preferences.mushafScale),
    );
  }, [preferences.mushafScale]);

  const statusPage =
    route.layoutMode === "page"
      ? route.currentPage
      : surahNavigation.visiblePage;
  const statusSurahLabel =
    metadata.surahNames.length > 0
      ? metadata.surahNames.join(locale === "ar" ? "، " : ", ")
      : "";

  useEffect(() => {
    if (skipPageAnnouncementRef.current) {
      skipPageAnnouncementRef.current = false;
      return;
    }
    setPageAnnouncement(
      t("status.pageTurn", {
        page: statusPage,
      }),
    );
  }, [statusPage, t]);

  swipeNavigationRef.current = {
    onNext: () => navigation.changePage(route.currentPage + 1),
    onPrevious: () => navigation.changePage(route.currentPage - 1),
  };

  const handleSwipeNext = useCallback(() => {
    swipeNavigationRef.current.onNext();
  }, []);
  const handleSwipePrevious = useCallback(() => {
    swipeNavigationRef.current.onPrevious();
  }, []);

  const handleStageTap = useCallback(() => {
    readerChrome.toggleControls();
  }, [readerChrome]);

  useReaderGestures({
    containerRef: mushafStageRef,
    swipeEnabled:
      !practiceMode && route.layoutMode === "page" && !loading && !error,
    tapEnabled: !practiceMode,
    onTap: handleStageTap,
    onSwipeNext: handleSwipeNext,
    onSwipePrevious: handleSwipePrevious,
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

  const selectSurah = (surahIndex: number) => {
    navigation.changeSurah(surahIndex + 1);
    overlays.setSurahDrawerOpen(false);
  };

  useReaderHeaderSync({
    // The header is driven by the route, not by Quran data, so it renders while
    // the page loads. Waiting would swap the shorter fallback bar for the full
    // header and push the mushaf down as it appears.
    enabled: !error,
    setHeader,
    surahLabel: statusSurahLabel,
    page: statusPage,
    layoutMode: route.layoutMode,
    currentSurah: route.currentSurahIndex,
    mushafData,
    practiceActive,
    practiceLoading,
    onLayoutModeChange: navigation.changeLayoutMode,
    onSurahSelect: selectSurah,
    onOpenSurahDrawer: overlays.openSurahDrawer,
    onOpenAyahSearch: overlays.openAyahSearch,
    onOpenListenOptions: overlays.openListenOptions,
    onOpenReadingPreferences: overlays.openReadingPreferences,
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

  // Page navigation travels with whichever bar owns the bottom strip.
  const pageControls =
    route.layoutMode === "page" ? (
      <PageControls
        compact
        currentPage={route.currentPage}
        totalPages={totalPages}
        onPageChange={navigation.changePage}
      />
    ) : (
      <PageControls
        compact
        currentPage={surahNavigation.visiblePage}
        totalPages={totalPages}
        minPage={surahLayout.bounds.min}
        maxPage={surahLayout.bounds.max}
        pageSequence={surahLayout.pages}
        onPageChange={surahNavigation.changePage}
      />
    );

  // The strip always says where the page sits in the mushaf and, unless the
  // reader has asked for a bare page, carries its navigation too. Playback and
  // practice take the strip over entirely and supply their own.
  let bottomBar: ReactNode = (
    <MushafReaderBar
      page={statusPage}
      juzNumber={
        typeof metadata.juzNumber === "number" ? metadata.juzNumber : null
      }
      hizbNumber={
        typeof metadata.hizbNumber === "number" ? metadata.hizbNumber : null
      }
      pageControls={pageControls}
      showControls={readerChrome.controlsVisible}
    />
  );
  if (practiceMode) {
    bottomBar = <PracticeAudioBar pageControls={pageControls} />;
  } else if (active) {
    // The playback row owns the strip and carries page navigation itself.
    bottomBar = <MushafAudioBar pageControls={pageControls} />;
  }

  const bottomChromeClassName = cn(
    !practiceMode && !active && "mushaf-bottom-chrome--controls",
  );

  // The dock stays mounted in every reader state so the space it reserves at the
  // foot of the page never jumps; only its surface comes and goes.
  const bottomChrome = (
    <MushafBottomChrome
      layoutRef={layoutRef}
      chromeClassName={bottomChromeClassName}
    >
      {bottomBar}
    </MushafBottomChrome>
  );

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

  // The stage, the dock and the overlays render in every state. Swapping the
  // whole tree for a loading branch used to unmount an open dialog mid-flight,
  // which left its modal layer holding pointer events for the rest of the visit.
  const showSkeleton = loading || awaitingLayout;

  return (
    <div
      ref={layoutRef}
      className={cn(
        "mushaf-reader-layout",
        preferences.mushafWarmth && "mushaf-reader-layout--sepia",
      )}
    >
      {/* Pointer handling lives in useReaderGestures, which decides in one
          place whether a press was a tap or a page turn. */}
      <div ref={mushafStageRef} className="mushaf-stage">
        <div
          className={cn(
            "mushaf-stage-inner",
            route.layoutMode === "surah" && "mushaf-stage-inner--surah",
          )}
        >
          {showSkeleton && (
            // The placeholder shares the stage with the mushaf, so the page
            // frame is already in place before the layout and glyphs arrive.
            <div className="relative mx-auto w-fit max-w-full px-2">
              <MushafPageSkeleton
                page={route.currentPage}
                label={t("loading")}
              />
            </div>
          )}

          {!showSkeleton &&
            route.layoutMode === "page" &&
            currentPageLayout && (
              <MushafViewer
                mushafData={mushafData}
                pageLayout={currentPageLayout}
                tajweedColored={preferences.tajweedColored}
                highlightVerseKey={highlight.highlightVerseKey}
              />
            )}

          {!showSkeleton && route.layoutMode === "surah" && (
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

      {bottomChrome}

      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {pageAnnouncement}
      </div>

      <ReadingPreferencesSheet
        open={overlays.readingPreferencesOpen}
        onOpenChange={overlays.setReadingPreferencesOpen}
        tajweedColored={preferences.tajweedColored}
        onTajweedColoredChange={preferences.changeTajweedColored}
        onOpenTajweedLegend={overlays.openLegendGuide}
        mushafWarmth={preferences.mushafWarmth}
        onMushafWarmthChange={preferences.changeMushafWarmth}
        mushafScale={preferences.mushafScale}
        onMushafScaleChange={preferences.changeMushafScale}
      />

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
        currentPage={route.currentPage}
        currentSurah={route.currentSurahIndex}
        layoutMode={route.layoutMode}
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
