import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import type { MushafVerse } from "@/domain/quran";
import type {
  MushafLayoutMode,
  QuranRouteContext,
} from "@/features/quran-reader/model/quranReaderRoutes";
import { findMushafVerse } from "@/domain/quran";

const SCROLL_LOCK_DURATION_MS = 1_200;
const ROUTE_SCROLL_DELAY_MS = 50;

interface UseSurahPageNavigationOptions {
  loading: boolean;
  layoutMode: MushafLayoutMode;
  currentSurahNumber: number;
  routeContext: QuranRouteContext;
  locationKey: string;
  pages: number[];
  mushafData: MushafVerse[];
}

interface SurahPageNavigation {
  visiblePage: number;
  setVisiblePage: (page: number) => void;
  changePage: (page: number) => void;
  scrollToPageRef: MutableRefObject<((page: number) => void) | null>;
  scrollLockRef: MutableRefObject<number | null>;
}

export function useSurahPageNavigation({
  loading,
  layoutMode,
  currentSurahNumber,
  routeContext,
  locationKey,
  pages,
  mushafData,
}: UseSurahPageNavigationOptions): SurahPageNavigation {
  const [selectedPage, setSelectedPage] = useState(1);
  const scrollToPageRef = useRef<((page: number) => void) | null>(null);
  const scrollLockRef = useRef<number | null>(null);
  const unlockTimerRef = useRef<number | null>(null);

  const lockAndScroll = useCallback((page: number) => {
    if (unlockTimerRef.current) window.clearTimeout(unlockTimerRef.current);

    scrollLockRef.current = page;
    setSelectedPage(page);
    scrollToPageRef.current?.(page);
    unlockTimerRef.current = window.setTimeout(() => {
      scrollLockRef.current = null;
      unlockTimerRef.current = null;
    }, SCROLL_LOCK_DURATION_MS);
  }, []);

  const changePage = useCallback(
    (page: number) => {
      if (pages.includes(page)) lockAndScroll(page);
    },
    [lockAndScroll, pages],
  );

  useEffect(() => {
    if (
      loading ||
      layoutMode !== "surah" ||
      routeContext.type !== "ayah" ||
      routeContext.surah !== currentSurahNumber
    ) {
      return;
    }

    const verse = findMushafVerse(
      mushafData,
      routeContext.surah,
      routeContext.ayah,
    );
    if (!verse || !pages.includes(verse.page)) return;

    if (unlockTimerRef.current) window.clearTimeout(unlockTimerRef.current);
    scrollLockRef.current = verse.page;
    setSelectedPage(verse.page);

    const scrollTimer = window.setTimeout(() => {
      scrollToPageRef.current?.(verse.page);
    }, ROUTE_SCROLL_DELAY_MS);
    unlockTimerRef.current = window.setTimeout(() => {
      scrollLockRef.current = null;
      unlockTimerRef.current = null;
    }, SCROLL_LOCK_DURATION_MS);

    return () => window.clearTimeout(scrollTimer);
  }, [
    currentSurahNumber,
    layoutMode,
    loading,
    locationKey,
    mushafData,
    pages,
    routeContext,
  ]);

  useEffect(
    () => () => {
      if (unlockTimerRef.current) window.clearTimeout(unlockTimerRef.current);
    },
    [],
  );

  const visiblePage = pages.includes(selectedPage)
    ? selectedPage
    : (pages[0] ?? 1);

  return {
    visiblePage,
    setVisiblePage: setSelectedPage,
    changePage,
    scrollToPageRef,
    scrollLockRef,
  };
}
