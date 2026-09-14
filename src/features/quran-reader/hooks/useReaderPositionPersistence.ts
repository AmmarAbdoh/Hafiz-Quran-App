import { useEffect, useRef, type RefObject } from "react";
import type { MushafLayoutMode } from "@/features/quran-reader/model/quranReaderRoutes";
import { saveReaderPosition } from "@/features/quran-reader/services/readerPositionStorage";

const SAVE_DEBOUNCE_MS = 800;

interface UseReaderPositionPersistenceOptions {
  layoutMode: MushafLayoutMode;
  page: number;
  surah: number;
  ayah?: number;
  scrollContainerRef: RefObject<HTMLElement | null>;
}

export function useReaderPositionPersistence({
  layoutMode,
  page,
  surah,
  ayah,
  scrollContainerRef,
}: UseReaderPositionPersistenceOptions) {
  const saveTimerRef = useRef<number | null>(null);
  const pendingRouteSaveRef = useRef({
    layout: layoutMode,
    page,
    surah,
    ayah,
  });
  const pendingScrollSaveRef = useRef<{
    layout: MushafLayoutMode;
    page: number;
    surah: number;
    ayah?: number;
    scrollRatio: number;
  } | null>(null);

  pendingRouteSaveRef.current = {
    layout: layoutMode,
    page,
    surah,
    ayah,
  };

  useEffect(() => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      saveReaderPosition(pendingRouteSaveRef.current);
      saveTimerRef.current = null;
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
        saveReaderPosition(pendingRouteSaveRef.current);
      }
    };
  }, [layoutMode, page, surah, ayah]);

  useEffect(() => {
    if (layoutMode !== "surah") return;

    const container = scrollContainerRef.current;
    if (!container) return;

    let scrollTimer: number | null = null;

    const persistScroll = () => {
      if (scrollTimer !== null) window.clearTimeout(scrollTimer);
      scrollTimer = window.setTimeout(() => {
        const maxScroll = container.scrollHeight - container.clientHeight;
        const scrollRatio = maxScroll > 0 ? container.scrollTop / maxScroll : 0;
        pendingScrollSaveRef.current = {
          layout: layoutMode,
          page,
          surah,
          ayah,
          scrollRatio,
        };
        saveReaderPosition(pendingScrollSaveRef.current);
        scrollTimer = null;
      }, SAVE_DEBOUNCE_MS);
    };

    container.addEventListener("scroll", persistScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", persistScroll);
      if (scrollTimer !== null) {
        window.clearTimeout(scrollTimer);
        if (pendingScrollSaveRef.current) {
          saveReaderPosition(pendingScrollSaveRef.current);
        }
      }
    };
  }, [layoutMode, page, surah, ayah, scrollContainerRef]);
}
