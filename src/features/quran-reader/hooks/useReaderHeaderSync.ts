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

    const callbacks = callbacksRef.current;
    setHeader({
      surahLabel,
      layoutMode,
      currentSurah,
      mushafData,
      practiceActive,
      practiceLoading,
      onLayoutModeChange: (mode) => callbacks.onLayoutModeChange(mode),
      onSurahSelect: (index) => callbacks.onSurahSelect(index),
      onOpenSurahDrawer: callbacks.onOpenSurahDrawer,
      onOpenAyahSearch: callbacks.onOpenAyahSearch,
      onOpenListenOptions: callbacks.onOpenListenOptions,
      onOpenReadingPreferences: callbacks.onOpenReadingPreferences,
      onTogglePractice: () => {
        void callbacks.onTogglePractice();
      },
    });
  }, [
    currentSurah,
    enabled,
    mushafData,
    layoutMode,
    practiceActive,
    practiceLoading,
    setHeader,
    surahLabel,
  ]);

  useEffect(() => () => setHeader(null), [setHeader]);
}
