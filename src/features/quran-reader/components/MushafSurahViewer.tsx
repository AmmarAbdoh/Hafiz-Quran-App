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
import { VerseActionsPopover } from "@/features/quran-reader/components/VerseActionsPopover";
import { VerseDialog } from "@/features/quran-reader/components/VerseDialog";
import {
  useQuranPlaybackHighlight,
  useQuranPlaybackState,
} from "@/features/quran-reader/context/QuranPlaybackContext";
import { useRecitationPractice } from "@practice/runtime";
import { useMushafVerseInteractions } from "@/features/quran-reader/hooks/useMushafVerseInteractions";
import {
  scrollMushafToPage,
  useMushafScrollPageSpy,
} from "@/features/quran-reader/hooks/useMushafScrollPageSpy";
import { useTheme } from "@/shared/hooks/use-theme";
import {
  MushafFontLoadingState,
  buildMushafPageItemsForSurah,
  preloadQcfPageFont,
  type MushafPageLayout,
  type MushafVerse as MushafVerseType,
  type MushafWord,
} from "@/domain/quran";

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

  const wordsByLocation = useMemo(() => {
    const words = new Map<string, MushafWord>();
    for (const layout of surahPageLayouts) {
      for (const line of layout.lines) {
        for (const word of line.words) words.set(word.location, word);
      }
    }
    return words;
  }, [surahPageLayouts]);

  const {
    selection,
    anchorRect,
    playingTarget,
    tafseerVerse,
    setTafseerVerse,
    popoverRef,
    activateWord,
    clearSelection,
    handleListenWord,
    handleListenAyah,
    handleTafseer,
  } = useMushafVerseInteractions({
    mushafRef,
    mushafData,
    wordsByLocation,
    highlightVerseKey,
    resetKey: surahNumber,
  });

  useEffect(() => {
    for (const page of surahPages) {
      void preloadQcfPageFont(page, theme, tajweedColored);
    }
  }, [surahPages, theme, tajweedColored]);

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
    `${surahNumber}:${surahPages.join(",")}`,
  );

  useEffect(() => {
    if (!scrollToPageRef) return;

    scrollToPageRef.current = (page: number) => {
      scrollMushafToPage(
        mushafRef,
        scrollContainerRef ?? { current: null },
        page,
      );
    };

    return () => {
      scrollToPageRef.current = null;
    };
  }, [scrollToPageRef, scrollContainerRef, surahNumber]);

  useEffect(() => {
    if (!scrollContainerRef?.current) return;
    scrollContainerRef.current.scrollTo({ top: 0, behavior: "auto" });
  }, [surahNumber, scrollContainerRef]);

  useEffect(() => {
    if (!highlightVerseKey || !mushafRef.current) return;

    const target = mushafRef.current.querySelector(
      `[data-verse-key="${highlightVerseKey}"]`,
    );
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightVerseKey, surahNumber]);

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
    return <MushafFontLoadingState compact message={t("loadingSurah")} />;
  }

  return (
    <div ref={mushafRef} className="flex w-full flex-col items-stretch">
      {surahPageLayouts.map((pageLayout, index) => (
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
            practiceHideAyat={practice.hideAyat}
            practiceRevealedLocations={practice.revealedLocations}
            practiceTargetWordLocation={practice.currentWordLocation}
            practiceWrongFlashLocation={practice.wrongFlashLocation}
            onWordActivate={activateWord}
          />
        </section>
      ))}

      {onSurahChange ? (
        <MushafSurahEndNav
          currentSurah={surahNumber}
          mushafData={mushafData}
          onSurahChange={onSurahChange}
        />
      ) : null}

      {selection && anchorRect && (
        <VerseActionsPopover
          verseKey={selection.verseKey}
          wordLocation={selection.word.location}
          mode={selection.mode}
          anchor={anchorRect}
          playingTarget={
            playback.active && playback.playing ? "ayah" : playingTarget
          }
          onListenWord={
            selection.mode === "word" ? handleListenWord : undefined
          }
          onListenAyah={handleListenAyah}
          onTafseer={handleTafseer}
          onClose={clearSelection}
          popoverRef={popoverRef}
        />
      )}

      <VerseDialog
        verse={tafseerVerse}
        open={tafseerVerse !== null}
        onOpenChange={(open) => {
          if (!open) setTafseerVerse(null);
        }}
      />
    </div>
  );
}
