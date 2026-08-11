import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { MushafVerse } from "@/domain/quran";
import {
  buildQuranReaderPath,
  buildQuranSurahPath,
  type MushafLayoutMode,
} from "@/features/quran-reader/model/quranReaderRoutes";
import { findVersePage } from "@/features/quran-reader/model/readerPageModel";

interface UsePlaybackNavigationSyncOptions {
  layoutMode: MushafLayoutMode;
  currentPage: number;
  surahPages: number[];
  mushafData: MushafVerse[];
  active: boolean;
  activeVerseKey: string | null;
  autoFollowPages: boolean;
  registerPageNavigator: (
    navigator: ((verseKey: string) => void) | null,
  ) => void;
  setActiveVerseInView: (inView: boolean) => void;
}

export function usePlaybackNavigationSync({
  layoutMode,
  currentPage,
  surahPages,
  mushafData,
  active,
  activeVerseKey,
  autoFollowPages,
  registerPageNavigator,
  setActiveVerseInView,
}: UsePlaybackNavigationSyncOptions): void {
  const navigate = useNavigate();

  useEffect(() => {
    registerPageNavigator((verseKey) => {
      const page = findVersePage(mushafData, verseKey);
      if (!page) return;

      const [surahPart] = verseKey.split(":");
      const surah = Number.parseInt(surahPart ?? "1", 10);
      const path =
        layoutMode === "surah"
          ? buildQuranSurahPath(surah)
          : buildQuranReaderPath(page);
      void navigate(path, { replace: true });
    });

    return () => registerPageNavigator(null);
  }, [layoutMode, mushafData, navigate, registerPageNavigator]);

  useEffect(() => {
    if (
      layoutMode !== "page" ||
      !active ||
      !activeVerseKey ||
      !autoFollowPages
    ) {
      return;
    }

    const targetPage = findVersePage(mushafData, activeVerseKey);
    if (!targetPage || targetPage === currentPage) return;
    void navigate(buildQuranReaderPath(targetPage), { replace: true });
  }, [
    active,
    activeVerseKey,
    autoFollowPages,
    currentPage,
    layoutMode,
    mushafData,
    navigate,
  ]);

  useEffect(() => {
    if (
      layoutMode !== "surah" ||
      !active ||
      !activeVerseKey ||
      !autoFollowPages
    ) {
      return;
    }

    const target = document.querySelector(
      `[data-verse-key="${activeVerseKey}"]`,
    );
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [active, activeVerseKey, autoFollowPages, layoutMode]);

  useEffect(() => {
    if (!active || !activeVerseKey) {
      setActiveVerseInView(false);
      return;
    }

    const page = findVersePage(mushafData, activeVerseKey);
    const inView =
      layoutMode === "surah"
        ? page !== null && surahPages.includes(page)
        : page === currentPage;
    setActiveVerseInView(inView);
  }, [
    active,
    activeVerseKey,
    currentPage,
    layoutMode,
    mushafData,
    setActiveVerseInView,
    surahPages,
  ]);

  useEffect(() => () => setActiveVerseInView(false), [setActiveVerseInView]);
}
