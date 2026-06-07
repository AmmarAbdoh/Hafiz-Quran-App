import { useEffect, useMemo, useRef, type MutableRefObject, type RefObject } from "react";
import { MushafPageBlock } from "@/features/quran-reader/components/MushafPageBlock";
import { MushafSurahEndNav } from "@/features/quran-reader/components/MushafSurahEndNav";
import { VerseActionsPopover } from "@/features/quran-reader/components/VerseActionsPopover";
import { VerseDialog } from "@/features/quran-reader/components/VerseDialog";
import { useQuranPlayback } from "@/features/quran-reader/context/QuranPlaybackContext";
import { useRecitationPractice } from "@/features/quran-reader/context/RecitationPracticeContext";
import { useMushafVerseInteractions } from "@/features/quran-reader/hooks/useMushafVerseInteractions";
import {
  scrollMushafToPage,
  useMushafScrollPageSpy,
} from "@/features/quran-reader/hooks/useMushafScrollPageSpy";
import { preloadQcfPageFont } from "@/features/quran-reader/hooks/useQcfPageFont";
import { toArabicNumerals } from "@/shared/lib/arabic-numerals";
import { useTheme } from "@/shared/hooks/use-theme";
import {
  buildWordsByLocation,
  buildMushafPageItemsForSurah,
  getSurahPages,
  getWordLayoutForPage,
} from "@/shared/services/quran-data";
import type {
  MushafVerse as MushafVerseType,
  MushafWordLayoutData,
} from "@/shared/types/quran";

interface MushafSurahViewerProps {
  mushafData: MushafVerseType[];
  wordLayout: MushafWordLayoutData;
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
  wordLayout,
  surahNumber,
  tajweedColored,
  highlightVerseKey = null,
  scrollContainerRef,
  onVisiblePageChange,
  scrollToPageRef,
  scrollLockRef,
  onSurahChange,
}: MushafSurahViewerProps) {
  const mushafRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const playback = useQuranPlayback();
  const practice = useRecitationPractice();

  const surahPages = useMemo(() => {
    return getSurahPages(mushafData, surahNumber).filter((page) => {
      const layout = getWordLayoutForPage(wordLayout, page);
      if (!layout) return false;
      return buildMushafPageItemsForSurah(layout, surahNumber).length > 0;
    });
  }, [mushafData, wordLayout, surahNumber]);

  const wordsByLocation = useMemo(
    () => buildWordsByLocation(wordLayout),
    [wordLayout],
  );

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
    playback: playbackState,
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

  useMushafScrollPageSpy(
    scrollContainerRef ?? { current: null },
    mushafRef,
    "[data-mushaf-page]",
    (page) => onVisiblePageChange?.(page),
    Boolean(scrollContainerRef && onVisiblePageChange),
    scrollLockRef,
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
        لا توجد بيانات لهذه السورة.
      </p>
    );
  }

  return (
    <div ref={mushafRef} className="flex w-full flex-col items-stretch">
      {surahPages.map((page, index) => (
        <section
          key={page}
          className="mushaf-surah-page"
          data-mushaf-page={page}
          aria-label={`صفحة ${page}`}
        >
          {index > 0 && (
            <div className="mushaf-surah-page__divider" aria-hidden>
              <span className="mushaf-surah-page__label">
                {toArabicNumerals(page)}
              </span>
            </div>
          )}

          <MushafPageBlock
            page={page}
            mushafData={mushafData}
            wordLayout={wordLayout}
            tajweedColored={tajweedColored}
            theme={theme}
            surahFilter={surahNumber}
            highlightVerseKey={highlightVerseKey}
            selection={selection}
            recitationVerseKey={
              practice.active ? null : playbackState.activeVerseKey
            }
            recitationWordLocation={playbackState.activeWordLocation}
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
