import { useEffect, useRef } from "react";
import type { MushafReaderHeaderState } from "@/features/quran-reader/context/MushafReaderContext";

interface UseReaderHeaderSyncOptions {
  enabled: boolean;
  setHeader: (header: MushafReaderHeaderState | null) => void;
  surahLabel: string;
  page: number;
  layoutMode: MushafReaderHeaderState["layoutMode"];
  practiceActive: boolean;
  practiceLoading: boolean;
  onLayoutModeChange: MushafReaderHeaderState["onLayoutModeChange"];
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
  page,
  layoutMode,
  practiceActive,
  practiceLoading,
  onLayoutModeChange,
  onOpenSurahDrawer,
  onOpenAyahSearch,
  onOpenListenOptions,
  onOpenReadingPreferences,
  onTogglePractice,
}: UseReaderHeaderSyncOptions): void {
  const callbacksRef = useRef({
    onLayoutModeChange,
    onOpenSurahDrawer,
    onOpenAyahSearch,
    onOpenListenOptions,
    onOpenReadingPreferences,
    onTogglePractice,
  });
  callbacksRef.current = {
    onLayoutModeChange,
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
      page,
      layoutMode,
      practiceActive,
      practiceLoading,
      onLayoutModeChange: (mode) => callbacks.onLayoutModeChange(mode),
      onOpenSurahDrawer: callbacks.onOpenSurahDrawer,
      onOpenAyahSearch: callbacks.onOpenAyahSearch,
      onOpenListenOptions: callbacks.onOpenListenOptions,
      onOpenReadingPreferences: callbacks.onOpenReadingPreferences,
      onTogglePractice: () => {
        void callbacks.onTogglePractice();
      },
    });
  }, [
    enabled,
    layoutMode,
    page,
    practiceActive,
    practiceLoading,
    setHeader,
    surahLabel,
  ]);

  useEffect(() => () => setHeader(null), [setHeader]);
}
