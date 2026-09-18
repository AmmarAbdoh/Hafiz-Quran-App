import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { MushafVerse } from "@/domain/quran";
import {
  buildQuranReaderPath,
  buildQuranSurahPath,
  type MushafLayoutMode,
} from "@/features/quran-reader/model/quranReaderRoutes";
import {
  isComfortablyVisible,
  scrollTopForVerse,
} from "@/features/quran-reader/model/followScroll";
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

  /*
   * Follow the recitation down a surah.
   *
   * This used to call scrollIntoView on every ayah, which moved the page
   * under the reader's eyes even when the ayah being recited was already in
   * front of them - and centred it, so half the screen was verses already
   * read. Now it only moves when the ayah has actually gone out of view, and
   * when it does it puts it in the upper third so what comes next is visible.
   */
  useEffect(() => {
    if (
      layoutMode !== "surah" ||
      !active ||
      !activeVerseKey ||
      !autoFollowPages
    ) {
      return;
    }

    /*
     * A frame late on purpose: the ayah that just became active may be on a
     * page mounted by this same render, and it has no box until it is laid
     * out.
     */
    const frame = requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(
        `[data-verse-key="${CSS.escape(activeVerseKey)}"]`,
      );
      const stage = document.querySelector<HTMLElement>(".mushaf-stage");
      if (!target || !stage) return;

      const verse = target.getBoundingClientRect();
      const box = stage.getBoundingClientRect();
      if (isComfortablyVisible(verse, box)) return;

      stage.scrollTo({
        top: scrollTopForVerse(
          verse,
          box,
          stage.scrollTop,
          stage.scrollHeight - stage.clientHeight,
        ),
        behavior: "smooth",
      });
    });

    return () => cancelAnimationFrame(frame);
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
