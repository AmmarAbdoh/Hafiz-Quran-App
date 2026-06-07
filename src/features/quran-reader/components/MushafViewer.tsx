import { useEffect, useMemo, useRef } from "react";
import { MushafPageBlock } from "@/features/quran-reader/components/MushafPageBlock";
import { VerseActionsPopover } from "@/features/quran-reader/components/VerseActionsPopover";
import { VerseDialog } from "@/features/quran-reader/components/VerseDialog";
import { useQuranPlayback } from "@/features/quran-reader/context/QuranPlaybackContext";
import { useRecitationPractice } from "@/features/quran-reader/context/RecitationPracticeContext";
import { useMushafVerseInteractions } from "@/features/quran-reader/hooks/useMushafVerseInteractions";
import { useTheme } from "@/shared/hooks/use-theme";
import {
  buildMushafPageItems,
  getWordLayoutForPage,
} from "@/shared/services/quran-data";
import type {
  MushafVerse as MushafVerseType,
  MushafWordLayoutData,
} from "@/shared/types/quran";

interface MushafViewerProps {
  mushafData: MushafVerseType[];
  wordLayout: MushafWordLayoutData;
  currentPage: number;
  tajweedColored: boolean;
  highlightVerseKey?: string | null;
}

export function MushafViewer({
  mushafData,
  wordLayout,
  currentPage,
  tajweedColored,
  highlightVerseKey = null,
}: MushafViewerProps) {
  const mushafRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const playback = useQuranPlayback();
  const practice = useRecitationPractice();

  const pageLayout = getWordLayoutForPage(wordLayout, currentPage);
  const pageItems = useMemo(
    () => (pageLayout ? buildMushafPageItems(pageLayout) : []),
    [pageLayout],
  );
  const visibleLines = useMemo(
    () =>
      pageItems
        .filter((item) => item.type === "line")
        .map((item) => item.line.words),
    [pageItems],
  );

  const wordsByLocation = useMemo(() => {
    const map = new Map<string, (typeof visibleLines)[number][number]>();
    for (const line of visibleLines) {
      for (const word of line) {
        map.set(word.location, word);
      }
    }
    return map;
  }, [visibleLines]);

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
    resetKey: currentPage,
  });

  useEffect(() => {
    if (!highlightVerseKey || !mushafRef.current) return;

    const target = mushafRef.current.querySelector(
      `[data-verse-key="${highlightVerseKey}"]`,
    );
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightVerseKey, currentPage]);

  useEffect(() => {
    if (!practice.active || !practice.currentWordLocation || !mushafRef.current) {
      return;
    }

    const selector = practice.hideAyat
      ? `.mushaf-word--practice-hidden[data-location="${practice.currentWordLocation}"]`
      : `[data-location="${practice.currentWordLocation}"]`;
    const target = mushafRef.current.querySelector(selector);
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [
    practice.active,
    practice.hideAyat,
    practice.currentWordLocation,
    practice.progressIndex,
  ]);

  if (!pageLayout) {
    return (
      <p className="py-12 text-center text-muted-foreground">
        لا توجد بيانات لهذه الصفحة.
      </p>
    );
  }

  return (
    <div ref={mushafRef} className="flex w-full flex-col items-center">
      <MushafPageBlock
        page={currentPage}
        mushafData={mushafData}
        wordLayout={wordLayout}
        tajweedColored={tajweedColored}
        theme={theme}
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
