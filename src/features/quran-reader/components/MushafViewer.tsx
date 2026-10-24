import { useEffect, useMemo, useRef } from "react";
import { MushafPageBlock } from "@/features/quran-reader/components/MushafPageBlock";
import { VerseInteractionOverlays } from "@/features/quran-reader/components/VerseInteractionOverlays";
import {
  useQuranPlaybackHighlight,
  useQuranPlaybackState,
} from "@/features/quran-reader/context/QuranPlaybackContext";
import { useRecitationPractice } from "@/features/recitation-practice";
import { useMushafVerseInteractions } from "@/features/quran-reader/hooks/useMushafVerseInteractions";
import {
  isComfortablyVisible,
  scrollTopForVerse,
} from "@/features/quran-reader/model/followScroll";
import {
  maxScrollTopOf,
  measureVerse,
  readStageGeometry,
} from "@/features/quran-reader/model/verseGeometry";
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
  /* Memoised for identity, not for cost: the page below turns this into a
     Set, and a fresh array every render would rebuild it every render. */
  /*
   * The word the reciter is stuck on carries the same red line as one they
   * got wrong earlier. The flash beside it is a moment; being held at a word
   * needs a mark that lasts until they get past it.
   */
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

  const interactions = useMushafVerseInteractions({
    mushafRef,
    mushafData,
    wordsByLocation,
    highlightVerseKey,
    resetKey: pageLayout.page,
  });
  /* The overlays take the whole object; the page below needs these by name. */
  const {
    selection,
    activateWord,
    handlePointerDown,
    handlePointerUp,
    bookmarkedSet,
  } = interactions;

  /* The first `data-verse-key` match is the `display: contents` ayah run,
     which has no box to bring into view. See measureVerse. */
  useEffect(() => {
    if (!highlightVerseKey || !mushafRef.current) return;

    const verse = measureVerse(mushafRef.current, highlightVerseKey);
    const geometry = readStageGeometry();
    if (!verse || !geometry) return;

    const { stage, box, bottomInset } = geometry;
    if (isComfortablyVisible(verse, box, bottomInset)) return;

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
        /* For the whole run, not only once it is listening: gated on
           `listening` the text sat in plain view for the entire model
           download, which is the one thing someone memorising must not
           see. */
        practiceHideAyat={
          practice.hideAyat && practice.active && !practice.completed
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

      <VerseInteractionOverlays
        interactions={interactions}
        playingAyah={playback.active && playback.playing}
      />
    </div>
  );
}
