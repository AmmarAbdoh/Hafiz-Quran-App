import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { MushafVerse } from "@/domain/quran";
import {
  buildQuranReaderPath,
  buildQuranSurahPath,
  type MushafLayoutMode,
} from "@/features/quran-reader/model/quranReaderRoutes";
import { isComfortablyVisible } from "@/features/quran-reader/model/followScroll";
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
   * A reader who scrolls themselves has taken the page in hand, and the next
   * ayah must not drag them back. Following is done by `PlaybackScrollFollower`;
   * this is how it learns to stop. Wheel and touch say so plainly - watching
   * scrollTop instead would have to tell the reader's scrolling from our own
   * smooth scroll, and would guess wrong at every ayah boundary.
   *
   * In page view only when the page scrolls at all: a page that fits its
   * screen has nothing to scroll, and a swipe there turns the page instead,
   * which `changePage` already accounts for.
   */
  useEffect(() => {
    if (!active || !autoFollowPages) return;

    const stage = document.querySelector<HTMLElement>(STAGE_SELECTOR);
    if (!stage) return;

    const release = () => {
      if (layoutMode === "page" && maxScrollTopOf(stage) <= 1) return;
      setAutoFollowPages(false);
    };
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

    if (
      layoutMode !== "surah" &&
      findVersePage(mushafData, activeVerseKey) !== currentPage
    ) {
      setActiveVerseInView(false);
      return;
    }

    /*
     * On screen, not merely on the page. Surah mode mounts the whole surah,
     * so "is it on the page" was yes for every ayah and the button offering
     * to take the reader back could never appear; a page made tall by a
     * larger font has the same problem in page view.
     */
    let queued = 0;
    const report = () => {
      const geometry = readStageGeometry();
      if (!geometry) return;

      const verse = measureVerse(geometry.stage, activeVerseKey);
      /* Not laid out yet on the page it belongs to: it will be in a moment,
         and offering to take the reader there would flash the button. */
      if (verse === null) {
        setActiveVerseInView(layoutMode !== "surah");
        return;
      }
      setActiveVerseInView(
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
