import { useCallback, useState } from "react";
import type { MushafLayoutMode } from "@/features/quran-reader/model/quranReaderRoutes";
import type { ListenPreset } from "@/features/quran-reader/model/listenPlanTypes";

interface UseReaderOverlaysOptions {
  layoutMode: MushafLayoutMode;
  currentPage: number;
  currentSurahNumber: number;
  practiceActive: boolean;
  stopPractice: () => void;
}

export function useReaderOverlays({
  layoutMode,
  currentPage,
  currentSurahNumber,
  practiceActive,
  stopPractice,
}: UseReaderOverlaysOptions) {
  const [surahDrawerOpen, setSurahDrawerOpen] = useState(false);
  const [ayahSearchOpen, setAyahSearchOpen] = useState(false);
  const [listenOpen, setListenOpen] = useState(false);
  const [listenPreset, setListenPreset] = useState<ListenPreset | null>(null);
  const [legendGuideOpen, setLegendGuideOpen] = useState(false);

  // Header actions live in context; stable identities keep header
  // synchronization from feeding back into the provider on every render.
  const openSurahDrawer = useCallback(() => setSurahDrawerOpen(true), []);
  const openAyahSearch = useCallback(() => setAyahSearchOpen(true), []);
  const openLegendGuide = useCallback(() => setLegendGuideOpen(true), []);
  const openListenOptions = useCallback(
    (preset?: ListenPreset) => {
      if (practiceActive) stopPractice();
      setListenPreset(
        preset ?? {
          page: layoutMode === "page" ? currentPage : undefined,
          surah: currentSurahNumber,
        },
      );
      setListenOpen(true);
    },
    [currentPage, currentSurahNumber, layoutMode, practiceActive, stopPractice],
  );

  return {
    surahDrawerOpen,
    setSurahDrawerOpen,
    ayahSearchOpen,
    setAyahSearchOpen,
    listenOpen,
    setListenOpen,
    listenPreset,
    legendGuideOpen,
    setLegendGuideOpen,
    openSurahDrawer,
    openAyahSearch,
    openLegendGuide,
    openListenOptions,
  };
}
