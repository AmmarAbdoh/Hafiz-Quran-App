import { useEffect } from "react";
import type { MushafReaderHeaderState } from "@/features/quran-reader/context/MushafReaderContext";

interface UseReaderHeaderSyncOptions extends Omit<
  MushafReaderHeaderState,
  "onTogglePractice"
> {
  enabled: boolean;
  setHeader: (header: MushafReaderHeaderState | null) => void;
  onTogglePractice: () => void | Promise<void>;
}

export function useReaderHeaderSync({
  enabled,
  setHeader,
  tajweedColored,
  legendPinned,
  layoutMode,
  practiceActive,
  practiceLoading,
  onTajweedColoredChange,
  onLegendPinnedChange,
  onLayoutModeChange,
  onOpenLegendGuide,
  onOpenSurahDrawer,
  onOpenAyahSearch,
  onOpenListenOptions,
  onTogglePractice,
}: UseReaderHeaderSyncOptions): void {
  useEffect(() => {
    if (!enabled) {
      setHeader(null);
      return;
    }

    setHeader({
      tajweedColored,
      legendPinned,
      layoutMode,
      practiceActive,
      practiceLoading,
      onTajweedColoredChange,
      onLegendPinnedChange,
      onLayoutModeChange,
      onOpenLegendGuide,
      onOpenSurahDrawer,
      onOpenAyahSearch,
      onOpenListenOptions,
      onTogglePractice: () => {
        void onTogglePractice();
      },
    });

    return () => setHeader(null);
  }, [
    enabled,
    layoutMode,
    legendPinned,
    onLayoutModeChange,
    onLegendPinnedChange,
    onOpenAyahSearch,
    onOpenLegendGuide,
    onOpenListenOptions,
    onOpenSurahDrawer,
    onTajweedColoredChange,
    onTogglePractice,
    practiceActive,
    practiceLoading,
    setHeader,
    tajweedColored,
  ]);
}
