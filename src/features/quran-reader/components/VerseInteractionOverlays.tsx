import { VerseActionsPopover } from "@/features/quran-reader/components/VerseActionsPopover";
import { VerseDialog } from "@/features/quran-reader/components/VerseDialog";
import type { useMushafVerseInteractions } from "@/features/quran-reader/hooks/useMushafVerseInteractions";

type VerseInteractions = ReturnType<typeof useMushafVerseInteractions>;

interface VerseInteractionOverlaysProps {
  interactions: VerseInteractions;
  /** True while the reader's own playback owns the audio, not a single ayah. */
  playingAyah: boolean;
}

/**
 * The popover and the tafsir dialog that follow a verse selection.
 *
 * Both viewers rendered these themselves, in blocks that had drifted into
 * being identical, so the wiring between a selection and its six actions
 * existed twice and had to be changed twice.
 */
export function VerseInteractionOverlays({
  interactions,
  playingAyah,
}: VerseInteractionOverlaysProps) {
  const {
    selection,
    anchorRect,
    playingTarget,
    tafseerVerse,
    setTafseerVerse,
    popoverRef,
    clearSelection,
    handleListenWord,
    handleListenAyah,
    handleTafseer,
    handleCopyVerse,
    handleShareVerse,
    handleBookmarkToggle,
    selectionBookmarked,
  } = interactions;

  return (
    <>
      {selection && anchorRect && (
        <VerseActionsPopover
          verseKey={selection.verseKey}
          wordLocation={selection.word.location}
          mode={selection.mode}
          anchor={anchorRect}
          playingTarget={playingAyah ? "ayah" : playingTarget}
          onListenWord={
            selection.mode === "word" ? handleListenWord : undefined
          }
          onListenAyah={handleListenAyah}
          onTafseer={handleTafseer}
          onCopy={handleCopyVerse}
          onShare={handleShareVerse}
          isBookmarked={selectionBookmarked}
          onBookmarkToggle={handleBookmarkToggle}
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
    </>
  );
}
