import { useMemo, type MouseEvent, type PointerEvent } from "react";
import type { Theme } from "@/shared/hooks/use-theme";
import { cn } from "@/shared/lib/utils";
import {
  buildSurahNameIndex,
  buildVerseTextIndex,
  type MushafPageLayout,
  type MushafVerse,
  type MushafWord,
} from "../model";
import { MushafPage } from "./MushafPage";
import { MushafPageSkeleton } from "./MushafPageSkeleton";
import { useQcfPageFont } from "./qcfFonts";

const EMPTY_MUSHAF_DATA: MushafVerse[] = [];
const EMPTY_LOCATIONS: string[] = [];

interface MushafPageViewProps {
  pageLayout: MushafPageLayout;
  mushafData?: MushafVerse[];
  tajweedColored: boolean;
  theme: Theme;
  loadingMessage: string;
  loadFont?: boolean;
  highlightVerseKey?: string | null;
  /** A pulse says "it is here"; a steady tint says "this is the ayah". */
  highlightPulse?: boolean;
  selectedWordLocation?: string | null;
  activeVerseKey?: string | null;
  activeWordLocation?: string | null;
  practiceMode?: boolean;
  hidePracticeWords?: boolean;
  revealedWordLocations?: string[];
  practiceTargetWordLocation?: string | null;
  incorrectWordLocation?: string | null;
  incorrectWordLabel?: string;
  bookmarkedVerseKeys?: ReadonlySet<string>;
  getSurahAccessibleLabel?: (surahName: string) => string;
  onWordActivate?: (
    word: MushafWord,
    event: MouseEvent<HTMLButtonElement>,
  ) => void;
  onWordPointerDown?: (
    word: MushafWord,
    event: PointerEvent<HTMLButtonElement>,
  ) => void;
  onWordPointerUp?: () => void;
  onWordPointerCancel?: () => void;
  className?: string;
  id?: string;
  surahFilter?: number;
}

export function MushafPageView({
  pageLayout,
  mushafData = EMPTY_MUSHAF_DATA,
  tajweedColored,
  theme,
  loadingMessage,
  loadFont = true,
  highlightVerseKey = null,
  highlightPulse = true,
  selectedWordLocation = null,
  activeVerseKey = null,
  activeWordLocation = null,
  practiceMode = false,
  hidePracticeWords = false,
  revealedWordLocations = EMPTY_LOCATIONS,
  practiceTargetWordLocation = null,
  incorrectWordLocation = null,
  incorrectWordLabel,
  bookmarkedVerseKeys,
  getSurahAccessibleLabel,
  onWordActivate,
  onWordPointerDown,
  onWordPointerUp,
  onWordPointerCancel,
  className,
  id,
  surahFilter,
}: MushafPageViewProps) {
  const {
    fontFamily,
    fontPalette,
    ready: fontReady,
    colored,
    failed: fontLoadFailed,
  } = useQcfPageFont(pageLayout.page, {
    colored: tajweedColored,
    theme,
    enabled: loadFont,
  });
  const surahNames = useMemo(
    () => buildSurahNameIndex(mushafData),
    [mushafData],
  );
  const verseTextByKey = useMemo(
    () => buildVerseTextIndex(mushafData),
    [mushafData],
  );
  const revealedLocations = useMemo(
    () => new Set(revealedWordLocations),
    [revealedWordLocations],
  );

  if (loadFont && !fontReady && !fontLoadFailed) {
    // Same wrapper as the loaded page so only the glyphs are pending.
    return (
      <div className={cn("relative mx-auto w-fit max-w-full px-2", className)}>
        <MushafPageSkeleton
          pageLayout={pageLayout}
          surahFilter={surahFilter}
          label={loadingMessage}
        />
      </div>
    );
  }

  const resolvedFontFamily = fontLoadFailed ? "var(--font-quran)" : fontFamily;
  const resolvedFontPalette = fontLoadFailed ? undefined : fontPalette;

  return (
    <div className={cn("relative mx-auto w-fit max-w-full px-2", className)}>
      <MushafPage
        pageLayout={pageLayout}
        surahNames={surahNames}
        fontFamily={resolvedFontFamily}
        fontPalette={resolvedFontPalette}
        fontReady={fontReady || fontLoadFailed}
        colored={colored}
        surahFilter={surahFilter}
        selectedWordLocation={selectedWordLocation}
        highlightVerseKey={highlightVerseKey}
        highlightPulse={highlightPulse}
        activeVerseKey={activeVerseKey}
        activeWordLocation={activeWordLocation}
        practiceMode={practiceMode}
        hidePracticeWords={hidePracticeWords}
        revealedWordLocations={revealedLocations}
        practiceTargetWordLocation={practiceTargetWordLocation}
        incorrectWordLocation={incorrectWordLocation}
        incorrectWordLabel={incorrectWordLabel}
        getSurahAccessibleLabel={getSurahAccessibleLabel}
        verseTextByKey={verseTextByKey}
        bookmarkedVerseKeys={bookmarkedVerseKeys}
        onWordActivate={onWordActivate}
        onWordPointerDown={onWordPointerDown}
        onWordPointerUp={onWordPointerUp}
        onWordPointerCancel={onWordPointerCancel}
        id={id}
      />
    </div>
  );
}
