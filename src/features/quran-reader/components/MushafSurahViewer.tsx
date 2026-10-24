import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type RefObject,
} from "react";
import { useTranslation } from "react-i18next";
import { formatNumber, useLocale } from "@/app/i18n";
import { MushafPageBlock } from "@/features/quran-reader/components/MushafPageBlock";

import { MushafSurahEndNav } from "@/features/quran-reader/components/MushafSurahEndNav";
import { VerseInteractionOverlays } from "@/features/quran-reader/components/VerseInteractionOverlays";
import {
  useQuranPlaybackHighlight,
  useQuranPlaybackState,
} from "@/features/quran-reader/context/QuranPlaybackContext";
import { useRecitationPractice } from "@/features/recitation-practice";
import { useMushafVerseInteractions } from "@/features/quran-reader/hooks/useMushafVerseInteractions";
import {
  scrollMushafToPage,
  useMushafScrollPageSpy,
} from "@/features/quran-reader/hooks/useMushafScrollPageSpy";
import { scrollTopForVerse } from "@/features/quran-reader/model/followScroll";
import {
  maxScrollTopOf,
  measureVerse,
  readStageGeometry,
} from "@/features/quran-reader/model/verseGeometry";
import { loadReaderPosition } from "@/features/quran-reader/services/readerPositionStorage";
import { useTheme } from "@/shared/hooks/use-theme";
import {
  MushafPageSkeleton,
  buildMushafPageItemsForSurah,
  preloadQcfPageFont,
  type MushafPageLayout,
  type MushafVerse as MushafVerseType,
  type MushafWord,
} from "@/domain/quran";

/**
 * Pages mounted at a time.
 *
 * Three filled a tall screen with one in reserve, which is the least that
 * works and left the reader meeting the end of what was mounted often. Five
 * costs little - the pages are already fetched and a page is ~100 glyph
 * spans - and puts two more pages of slack in front of the reader.
 */
const PAGE_MOUNT_STEP = 5;

interface MushafSurahViewerProps {
  mushafData: MushafVerseType[];
  pageLayouts: MushafPageLayout[];
  surahNumber: number;
  tajweedColored: boolean;
  highlightVerseKey?: string | null;
  scrollContainerRef?: RefObject<HTMLElement | null>;
  onVisiblePageChange?: (page: number) => void;
  scrollToPageRef?: MutableRefObject<((page: number) => void) | null>;
  scrollLockRef?: MutableRefObject<number | null>;
  onSurahChange?: (surahNumber: number) => void;
}

export function MushafSurahViewer({
  mushafData,
  pageLayouts,
  surahNumber,
  tajweedColored,
  highlightVerseKey = null,
  scrollContainerRef,
  onVisiblePageChange,
  scrollToPageRef,
  scrollLockRef,
  onSurahChange,
}: MushafSurahViewerProps) {
  const { t } = useTranslation("reader");
  const { locale } = useLocale();
  const mushafRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const playback = useQuranPlaybackState();
  const { activeWordLocation } = useQuranPlaybackHighlight();
  const practice = useRecitationPractice();
  /* Memoised for identity, not for cost: the page below turns this into a
     Set, and a fresh array every render would rebuild it every render. */
  /*
   * The word the reciter is stuck on carries the same red line as one they
   * got wrong earlier. The flash beside it is a moment; being held at a word
   * needs a mark that lasts until they get past it.
   */
  /*
   * Which page each word sits on, so a run can blank its own page and no
   * others.
   *
   * Surah view mounts several pages at once, and `hideAyat` was applied to
   * every one of them - while only the page being recited can ever be
   * revealed, because `revealedLocations` holds that page's words alone. The
   * pages around it were therefore blanked for the whole run with nothing
   * able to bring them back. Built from the layouts rather than per word, so
   * following the cursor does not rebuild it every 480ms.
   */
  const pageOfLocation = useMemo(() => {
    const pages = new Map<string, number>();
    for (const layout of pageLayouts) {
      for (const line of layout.lines) {
        for (const word of line.words) pages.set(word.location, word.page);
      }
    }
    return pages;
  }, [pageLayouts]);

  /* Null between the last word and the verdict, where hiding is already off
     because the run is complete. */
  const practicePage = practice.currentWordLocation
    ? (pageOfLocation.get(practice.currentWordLocation) ?? null)
    : null;

  const misreadLocations = useMemo(
    () => [
      ...practice.misreadWords.map((word) => word.location),
      ...(practice.wrongFlashLocation ? [practice.wrongFlashLocation] : []),
      /* The streaming engine holds the run at the word instead of flashing
         it, so the mark has to follow the hold as well. */
      ...(practice.heldAtLocation ? [practice.heldAtLocation] : []),
    ],
    [
      practice.misreadWords,
      practice.wrongFlashLocation,
      practice.heldAtLocation,
    ],
  );

  const surahPageLayouts = useMemo(
    () =>
      pageLayouts
        .filter(
          (layout) =>
            buildMushafPageItemsForSurah(layout, surahNumber).length > 0,
        )
        .sort((left, right) => left.page - right.page),
    [pageLayouts, surahNumber],
  );
  const surahPages = useMemo(
    () => surahPageLayouts.map((layout) => layout.page),
    [surahPageLayouts],
  );

  /*
   * Surah mode used to mount every page of the surah at once. Al-Baqarah is
   * 48 of them: 49 layout requests and 48 font requests fired together, 6402
   * glyph spans and 15,956 DOM nodes in the document, 5.4 seconds before a
   * word of Quran appeared - and every later style change paying for all of
   * it, which is why switching theme took 236ms here against 44ms on a single
   * page.
   *
   * Pages mount a few at a time instead, extending as the reader reaches the
   * end of what is mounted. A surah is read downwards, so the next pages are
   * wanted in the order they are reached.
   */
  const pageIndexForVerse = useMemo(() => {
    if (!highlightVerseKey) return 0;
    const index = surahPageLayouts.findIndex((layout) =>
      layout.lines.some((line) =>
        line.words.some((word) => word.verse_key === highlightVerseKey),
      ),
    );
    return index < 0 ? 0 : index;
  }, [highlightVerseKey, surahPageLayouts]);

  const [mountedCount, setMountedCount] = useState(PAGE_MOUNT_STEP);
  /* A jump held until the page it asks for exists. See the effect below. */
  const [pendingScrollPage, setPendingScrollPage] = useState<number | null>(
    null,
  );

  // Somewhere to jump to has to exist before the jump.
  useEffect(() => {
    setMountedCount((current) =>
      Math.max(current, pageIndexForVerse + PAGE_MOUNT_STEP),
    );
  }, [pageIndexForVerse]);

  useEffect(() => {
    setMountedCount(PAGE_MOUNT_STEP);
    setPendingScrollPage(null);
  }, [surahNumber]);

  const mountedLayouts = useMemo(
    () => surahPageLayouts.slice(0, mountedCount),
    [surahPageLayouts, mountedCount],
  );
  const hasMorePages = mountedCount < surahPageLayouts.length;

  /*
   * A callback ref, not a useRef.
   *
   * The viewer returns a loading tree before the pages exist, so an effect
   * reading a ref ran once while the sentinel was still null - and its
   * dependencies never changed afterwards, so it never ran again and no
   * listener was ever attached. Scrolling to the very bottom of Al-Baqarah
   * mounted nothing. Holding the node in state makes its arrival the thing
   * that starts the effect.
   */
  const [sentinel, setSentinel] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    const stage = sentinel?.closest<HTMLElement>(".mushaf-stage");
    if (!sentinel || !stage || !hasMorePages) return;

    const LOOKAHEAD_PX = 800;
    const grow = () => {
      const remaining =
        stage.scrollHeight - stage.scrollTop - stage.clientHeight;
      if (remaining > LOOKAHEAD_PX) return;
      setMountedCount((current) =>
        Math.min(current + PAGE_MOUNT_STEP, surahPageLayouts.length),
      );
    };

    grow();
    stage.addEventListener("scroll", grow, { passive: true });
    return () => stage.removeEventListener("scroll", grow);
  }, [sentinel, hasMorePages, mountedCount, surahPageLayouts.length]);

  const wordsByLocation = useMemo(() => {
    const words = new Map<string, MushafWord>();
    for (const layout of surahPageLayouts) {
      for (const line of layout.lines) {
        for (const word of line.words) words.set(word.location, word);
      }
    }
    return words;
  }, [surahPageLayouts]);

  const interactions = useMushafVerseInteractions({
    mushafRef,
    mushafData,
    wordsByLocation,
    highlightVerseKey,
    resetKey: surahNumber,
  });
  /* The overlays take the whole object; the page below needs these by name. */
  const {
    selection,
    activateWord,
    handlePointerDown,
    handlePointerUp,
    bookmarkedSet,
  } = interactions;

  /*
   * Only the pages that are mounted, and the next step's worth. This used to
   * warm every page of the surah at once - 48 font files for Al-Baqarah,
   * fetched before a word was read, for pages the reader might never reach.
   */
  useEffect(() => {
    const upTo = Math.min(mountedCount + PAGE_MOUNT_STEP, surahPages.length);
    for (const page of surahPages.slice(0, upTo)) {
      void preloadQcfPageFont(page, theme, tajweedColored);
    }
  }, [surahPages, mountedCount, theme, tajweedColored]);

  const [surahFontsLoading, setSurahFontsLoading] = useState(true);

  useEffect(() => {
    if (surahPages.length === 0) {
      setSurahFontsLoading(false);
      return;
    }

    let cancelled = false;
    setSurahFontsLoading(true);

    const pagesToLoad = surahPages.slice(0, Math.min(2, surahPages.length));
    void Promise.all(
      pagesToLoad.map((page) =>
        preloadQcfPageFont(page, theme, tajweedColored),
      ),
    ).then(() => {
      if (!cancelled) {
        setSurahFontsLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [surahNumber, theme, tajweedColored, surahPages]);

  useMushafScrollPageSpy(
    scrollContainerRef ?? { current: null },
    mushafRef,
    "[data-mushaf-page]",
    (page) => onVisiblePageChange?.(page),
    Boolean(scrollContainerRef && onVisiblePageChange && !surahFontsLoading),
    scrollLockRef,
    /* Re-subscribes when pages mount, which is what changes the sections
       the spy watches - the surah's own page list never does. */
    `${surahNumber}:${mountedCount}`,
  );

  /*
   * A jump asks for a page that may not be mounted yet, and a page that is
   * not mounted has no position to scroll to. Every such request used to be
   * dropped in silence: asking for page 40 of Al-Baqarah from the top left
   * the reader exactly where it was, with the page number briefly showing 40
   * before the scroll spy put it back. That is the whole of "it stops
   * responding" in surah mode - typing a page, picking one from the rail, or
   * turning pages faster than reading down the surah would mount them.
   *
   * The request now mounts what it needs and is held until it lands, so it
   * survives both the mount it triggers and the font load that gates the
   * page tree existing at all.
   *
   * A page that is already there is scrolled to on the spot, in the click's
   * own turn. Routing every request through state cost a whole render before
   * the first pixel moved - 140ms of nothing after a press, on a control
   * whose entire job is to feel immediate.
   *
   * Turning a page is a command, not a reading movement, so it lands at once
   * rather than gliding: the smooth default spent another ~530ms travelling.
   * Following a recitation still glides - that is scrollIntoView elsewhere in
   * this file, and it is a different thing.
   */
  useEffect(() => {
    if (!scrollToPageRef) return;

    scrollToPageRef.current = (page: number) => {
      const index = surahPages.indexOf(page);
      if (index < 0) return;
      const container = scrollContainerRef ?? { current: null };
      if (scrollMushafToPage(mushafRef, container, page, "auto")) return;

      setMountedCount((current) =>
        Math.max(current, Math.min(surahPages.length, index + PAGE_MOUNT_STEP)),
      );
      setPendingScrollPage(page);
    };

    return () => {
      scrollToPageRef.current = null;
    };
  }, [scrollToPageRef, scrollContainerRef, surahPages]);

  useEffect(() => {
    if (pendingScrollPage === null) return;
    const landed = scrollMushafToPage(
      mushafRef,
      scrollContainerRef ?? { current: null },
      pendingScrollPage,
      "auto",
    );
    if (landed) setPendingScrollPage(null);
  }, [pendingScrollPage, mountedCount, surahFontsLoading, scrollContainerRef]);

  /*
   * Where a surah opens: the position it was left at, or its start.
   *
   * highlightVerseKey is read through a ref rather than depended on. It is a
   * flash that clears itself after a few seconds, and as a dependency that
   * expiry re-ran this effect and scrolled the reader back to the top of the
   * surah - a few seconds after every jump to an ayah, and mid-recitation.
   */
  const highlightVerseKeyRef = useRef(highlightVerseKey);
  highlightVerseKeyRef.current = highlightVerseKey;

  useEffect(() => {
    const container = scrollContainerRef?.current;
    if (!container || surahFontsLoading) return;

    const saved = loadReaderPosition();
    if (
      saved?.layout === "surah" &&
      saved.surah === surahNumber &&
      saved.scrollRatio !== undefined &&
      !highlightVerseKeyRef.current
    ) {
      const maxScroll = container.scrollHeight - container.clientHeight;
      container.scrollTo({
        top: Math.max(0, maxScroll * saved.scrollRatio),
        behavior: "auto",
      });
      return;
    }

    if (highlightVerseKeyRef.current) return;
    container.scrollTo({ top: 0, behavior: "auto" });
  }, [surahNumber, scrollContainerRef, surahFontsLoading]);

  /*
   * Take the reader to the ayah they asked for.
   *
   * scrollIntoView on the first `data-verse-key` match moved nothing at all:
   * that match is the ayah run, which a full mushaf page lays out as
   * `display: contents`, so it has no box to bring into view. Opening a link
   * to 2:100 left the reader at the top of the surah with the ayah 8755px
   * below them. Measuring every part of the verse finds where it really is,
   * and it lands where a followed recitation lands.
   */
  const landedOnRef = useRef<string | null>(null);

  useEffect(() => {
    if (!highlightVerseKey) {
      landedOnRef.current = null;
      return;
    }
    if (landedOnRef.current === highlightVerseKey || surahFontsLoading) return;

    const geometry = readStageGeometry(scrollContainerRef?.current);
    if (!mushafRef.current || !geometry) return;

    /*
     * Nothing to measure yet means the page holding it is still mounting -
     * pageIndexForVerse has already asked for it. Leaving the ref unset lets
     * the next mount, or the font load, try again.
     */
    const verse = measureVerse(mushafRef.current, highlightVerseKey);
    if (!verse) return;

    landedOnRef.current = highlightVerseKey;
    const { stage, box, bottomInset } = geometry;
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
  }, [
    highlightVerseKey,
    surahNumber,
    scrollContainerRef,
    surahFontsLoading,
    mountedCount,
  ]);

  useEffect(() => {
    if (!practice.active || !practice.currentWordLocation) return;

    const selector = practice.hideAyat
      ? `.mushaf-word--practice-hidden[data-location="${practice.currentWordLocation}"]`
      : `[data-location="${practice.currentWordLocation}"]`;
    const target = mushafRef.current?.querySelector(selector);
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [
    practice.active,
    practice.hideAyat,
    practice.currentWordLocation,
    practice.progressIndex,
  ]);

  if (surahPages.length === 0) {
    return (
      <p className="py-12 text-center text-muted-foreground">
        {t("emptySurah")}
      </p>
    );
  }

  if (surahFontsLoading) {
    return (
      <div className="flex w-full flex-col items-stretch">
        <section className="mushaf-surah-page">
          <div className="relative mx-auto w-fit max-w-full px-2">
            <MushafPageSkeleton
              pageLayout={surahPageLayouts[0]}
              surahFilter={surahNumber}
              label={t("loadingSurah")}
            />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div ref={mushafRef} className="flex w-full flex-col items-stretch">
      {mountedLayouts.map((pageLayout, index) => (
        <section
          key={pageLayout.page}
          className="mushaf-surah-page"
          data-mushaf-page={pageLayout.page}
          aria-label={t("pageLabel", {
            page: formatNumber(pageLayout.page, locale),
          })}
        >
          {index > 0 && (
            <div className="mushaf-surah-page__divider" aria-hidden>
              <span className="mushaf-surah-page__label">
                {formatNumber(pageLayout.page, locale)}
              </span>
            </div>
          )}

          <MushafPageBlock
            pageLayout={pageLayout}
            mushafData={mushafData}
            tajweedColored={tajweedColored}
            theme={theme}
            surahFilter={surahNumber}
            highlightVerseKey={highlightVerseKey}
            selection={selection}
            recitationVerseKey={
              practice.active ? null : playback.activeVerseKey
            }
            recitationWordLocation={activeWordLocation}
            practiceMode={practice.active && !practice.completed}
            practiceHideAyat={
              practice.hideAyat &&
              practice.active &&
              !practice.completed &&
              pageLayout.page === practicePage
            }
            practiceRevealedLocations={practice.revealedLocations}
            practiceTargetWordLocation={practice.currentWordLocation}
            practiceWrongFlashLocation={practice.wrongFlashLocation}
            practiceMisreadLocations={misreadLocations}
            bookmarkedVerseKeys={bookmarkedSet}
            onWordActivate={activateWord}
            onWordPointerDown={handlePointerDown}
            onWordPointerUp={handlePointerUp}
            onWordPointerCancel={handlePointerUp}
          />
        </section>
      ))}

      {/* Asks for the next pages a little before the reader reaches them. */}
      {hasMorePages ? (
        <div ref={setSentinel} className="h-px w-full" aria-hidden="true" />
      ) : null}

      {onSurahChange ? (
        <MushafSurahEndNav
          currentSurah={surahNumber}
          mushafData={mushafData}
          onSurahChange={onSurahChange}
        />
      ) : null}

      <VerseInteractionOverlays
        interactions={interactions}
        playingAyah={playback.active && playback.playing}
      />
    </div>
  );
}
