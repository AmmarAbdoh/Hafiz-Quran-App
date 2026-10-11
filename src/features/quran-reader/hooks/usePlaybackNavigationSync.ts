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
import {
  maxScrollTopOf,
  measureVerse,
  readStageGeometry,
} from "@/features/quran-reader/model/verseGeometry";
import { findVersePage } from "@/features/quran-reader/model/readerPageModel";

const STAGE_SELECTOR = ".mushaf-stage";

interface UsePlaybackNavigationSyncOptions {
  layoutMode: MushafLayoutMode;
  currentPage: number;
  mushafData: MushafVerse[];
  active: boolean;
  activeVerseKey: string | null;
  autoFollowPages: boolean;
  registerPageNavigator: (
    navigator: ((verseKey: string) => void) | null,
  ) => void;
  setActiveVerseInView: (inView: boolean) => void;
  setAutoFollowPages: (follow: boolean) => void;
}

export function usePlaybackNavigationSync({
  layoutMode,
  currentPage,
  mushafData,
  active,
  activeVerseKey,
  autoFollowPages,
  registerPageNavigator,
  setActiveVerseInView,
  setAutoFollowPages,
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
      const geometry = readStageGeometry();
      if (!geometry) return;

      const { stage, box, bottomInset } = geometry;
      const verse = measureVerse(stage, activeVerseKey);
      if (!verse || isComfortablyVisible(verse, box, bottomInset)) return;

      stage.scrollTo({
        top: scrollTopForVerse(
          verse,
          box,
          stage.scrollTop,
          maxScrollTopOf(stage),
          bottomInset,
        ),
        behavior: "smooth",
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [active, activeVerseKey, autoFollowPages, layoutMode]);

  /*
   * A reader who scrolls the surah themselves has taken the page in hand, and
   * the next ayah must not drag them back. Page mode learns this from
   * changePage; surah mode turns no pages, so it listens for the gestures
   * that scroll. Wheel and touch say so plainly - watching scrollTop instead
   * would have to tell the reader's scrolling from our own smooth scroll, and
   * would guess wrong at every ayah boundary.
   */
  useEffect(() => {
    if (layoutMode !== "surah" || !active || !autoFollowPages) return;

    const stage = document.querySelector<HTMLElement>(STAGE_SELECTOR);
    if (!stage) return;

    const release = () => setAutoFollowPages(false);
    stage.addEventListener("wheel", release, { passive: true });
    stage.addEventListener("touchmove", release, { passive: true });

    return () => {
      stage.removeEventListener("wheel", release);
      stage.removeEventListener("touchmove", release);
    };
  }, [active, autoFollowPages, layoutMode, setAutoFollowPages]);

  useEffect(() => {
    if (!active || !activeVerseKey) {
      setActiveVerseInView(false);
      return;
    }

    if (layoutMode !== "surah") {
      const page = findVersePage(mushafData, activeVerseKey);
      setActiveVerseInView(page === currentPage);
      return;
    }

    /*
     * Surah mode mounts the whole surah, so "is it on the page you are
     * looking at" was yes for every ayah of it and the button offering to
     * take the reader back to the reciter could never appear. On screen is
     * what the question means here, and the answer changes as they scroll.
     */
    let queued = 0;
    const report = () => {
      const geometry = readStageGeometry();
      if (!geometry) return;

      const verse = measureVerse(geometry.stage, activeVerseKey);
      setActiveVerseInView(
        verse !== null &&
          isComfortablyVisible(verse, geometry.box, geometry.bottomInset),
      );
    };

    const onScroll = () => {
      cancelAnimationFrame(queued);
      queued = requestAnimationFrame(report);
    };

    queued = requestAnimationFrame(report);
    const stage = document.querySelector<HTMLElement>(STAGE_SELECTOR);
    stage?.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      cancelAnimationFrame(queued);
      stage?.removeEventListener("scroll", onScroll);
    };
  }, [
    active,
    activeVerseKey,
    currentPage,
    layoutMode,
    mushafData,
    setActiveVerseInView,
  ]);

  useEffect(() => () => setActiveVerseInView(false), [setActiveVerseInView]);
}
