import { useEffect, useRef } from "react";
import type { MushafReaderHeaderState } from "@/features/quran-reader/context/MushafReaderContext";

interface UseReaderHeaderSyncOptions {
  enabled: boolean;
  setHeader: (header: MushafReaderHeaderState | null) => void;
  surahLabel: string;
  layoutMode: MushafReaderHeaderState["layoutMode"];
  currentSurah: MushafReaderHeaderState["currentSurah"];
  mushafData: MushafReaderHeaderState["mushafData"];
  practiceActive: boolean;
  practiceLoading: boolean;
  practiceReady: boolean;
  onLayoutModeChange: MushafReaderHeaderState["onLayoutModeChange"];
  onSurahSelect: MushafReaderHeaderState["onSurahSelect"];
  onOpenSurahDrawer: MushafReaderHeaderState["onOpenSurahDrawer"];
  onOpenAyahSearch: MushafReaderHeaderState["onOpenAyahSearch"];
  onOpenListenOptions: MushafReaderHeaderState["onOpenListenOptions"];
  onOpenReadingPreferences: MushafReaderHeaderState["onOpenReadingPreferences"];
  onTogglePractice: () => void | Promise<void>;
}

export function useReaderHeaderSync({
  enabled,
  setHeader,
  surahLabel,
  layoutMode,
  currentSurah,
  mushafData,
  practiceActive,
  practiceLoading,
  practiceReady,
  onLayoutModeChange,
  onSurahSelect,
  onOpenSurahDrawer,
  onOpenAyahSearch,
  onOpenListenOptions,
  onOpenReadingPreferences,
  onTogglePractice,
}: UseReaderHeaderSyncOptions): void {
  const callbacksRef = useRef({
    onLayoutModeChange,
    onSurahSelect,
    onOpenSurahDrawer,
    onOpenAyahSearch,
    onOpenListenOptions,
    onOpenReadingPreferences,
    onTogglePractice,
  });
  callbacksRef.current = {
    onLayoutModeChange,
    onSurahSelect,
    onOpenSurahDrawer,
    onOpenAyahSearch,
    onOpenListenOptions,
    onOpenReadingPreferences,
    onTogglePractice,
  };

  useEffect(() => {
    if (!enabled) {
      setHeader(null);
      return;
    }

    /*
     * Read through the ref at call time, never at effect time.
     *
     * `callbacksRef.current` is replaced with a fresh object on every render,
     * so capturing it here would hand the header the copy that existed when
     * this effect last ran. The effect does not re-run when only a callback
     * changes - that is the point of the ref - so the header kept calling a
     * stale `onTogglePractice` and started تسميع on the page before the one
     * being read, whenever the new page was already loaded.
     */
    setHeader({
      surahLabel,
      layoutMode,
      currentSurah,
      mushafData,
      practiceActive,
      practiceLoading,
      practiceReady,
      onLayoutModeChange: (mode) =>
        callbacksRef.current.onLayoutModeChange(mode),
      onSurahSelect: (index) => callbacksRef.current.onSurahSelect(index),
      onOpenSurahDrawer: () => callbacksRef.current.onOpenSurahDrawer(),
      onOpenAyahSearch: () => callbacksRef.current.onOpenAyahSearch(),
      onOpenListenOptions: () => callbacksRef.current.onOpenListenOptions(),
      onOpenReadingPreferences: () =>
        callbacksRef.current.onOpenReadingPreferences(),
      onTogglePractice: () => {
        void callbacksRef.current.onTogglePractice();
      },
    });
  }, [
    currentSurah,
    enabled,
    mushafData,
    layoutMode,
    practiceActive,
    practiceLoading,
    practiceReady,
    setHeader,
    surahLabel,
  ]);

  useEffect(() => () => setHeader(null), [setHeader]);
}
