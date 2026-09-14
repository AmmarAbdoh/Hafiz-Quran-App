import { useEffect, useRef } from "react";
import type { MushafReaderHeaderState } from "@/features/quran-reader/context/MushafReaderContext";

interface UseReaderHeaderSyncOptions {
  enabled: boolean;
  setHeader: (header: MushafReaderHeaderState | null) => void;
  surahLabel: string;
  page: number;
  practiceActive: boolean;
  practiceLoading: boolean;
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
  practiceActive,
  practiceLoading,
  onOpenSurahDrawer,
  onOpenAyahSearch,
  onOpenListenOptions,
  onOpenReadingPreferences,
  onTogglePractice,
}: UseReaderHeaderSyncOptions): void {
  const callbacksRef = useRef({
    onOpenSurahDrawer,
    onOpenAyahSearch,
    onOpenListenOptions,
    onOpenReadingPreferences,
    onTogglePractice,
  });
  callbacksRef.current = {
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
      practiceActive,
      practiceLoading,
      onOpenSurahDrawer: callbacks.onOpenSurahDrawer,
      onOpenAyahSearch: callbacks.onOpenAyahSearch,
      onOpenListenOptions: callbacks.onOpenListenOptions,
      onOpenReadingPreferences: callbacks.onOpenReadingPreferences,
      onTogglePractice: () => {
        void callbacks.onTogglePractice();
      },
    });
  }, [enabled, page, practiceActive, practiceLoading, setHeader, surahLabel]);

  useEffect(() => () => setHeader(null), [setHeader]);
}
