import { useEffect, useMemo, useRef } from "react";
import { MushafPageBlock } from "@/features/quran-reader/components/MushafPageBlock";
import { VerseActionsPopover } from "@/features/quran-reader/components/VerseActionsPopover";
import { VerseDialog } from "@/features/quran-reader/components/VerseDialog";
import {
  useQuranPlaybackHighlight,
  useQuranPlaybackState,
} from "@/features/quran-reader/context/QuranPlaybackContext";
import { useRecitationPractice } from "@practice/runtime";
import { useMushafVerseInteractions } from "@/features/quran-reader/hooks/useMushafVerseInteractions";
import { useTheme } from "@/shared/hooks/use-theme";
import {
  buildMushafPageItems,
  type MushafPageLayout,
  type MushafWord,
} from "@/domain/quran";
import type { MushafVerse as MushafVerseType } from "@/domain/quran";

interface MushafViewerProps {
  mushafData: MushafVerseType[];
  pageLayout: MushafPageLayout;
  tajweedColored: boolean;
  highlightVerseKey?: string | null;
}

export function MushafViewer({
  mushafData,
  pageLayout,
  tajweedColored,
  highlightVerseKey = null,
}: MushafViewerProps) {
  const mushafRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const playback = useQuranPlaybackState();
  const { activeWordLocation } = useQuranPlaybackHighlight();
  const practice = useRecitationPractice();

  const wordsByLocation = useMemo(() => {
    const map = new Map<string, MushafWord>();
    for (const item of buildMushafPageItems(pageLayout)) {
      if (item.type !== "line") continue;
      for (const word of item.line.words) {
        map.set(word.location, word);
      }
    }
    return map;
  }, [pageLayout]);

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
    resetKey: pageLayout.page,
  });

  useEffect(() => {
    if (!highlightVerseKey || !mushafRef.current) return;

    const target = mushafRef.current.querySelector(
      `[data-verse-key="${highlightVerseKey}"]`,
    );
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightVerseKey, pageLayout.page]);

  useEffect(() => {
    if (
      !practice.active ||
      !practice.currentWordLocation ||
      !mushafRef.current
    ) {
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

  return (
    <div ref={mushafRef} className="flex w-full flex-col items-center">
      <MushafPageBlock
        pageLayout={pageLayout}
        mushafData={mushafData}
        tajweedColored={tajweedColored}
        theme={theme}
        highlightVerseKey={highlightVerseKey}
        selection={selection}
        recitationVerseKey={practice.active ? null : playback.activeVerseKey}
        recitationWordLocation={activeWordLocation}
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
