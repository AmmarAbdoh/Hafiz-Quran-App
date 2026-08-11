import { useMemo, type MouseEvent } from "react";
import type { Theme } from "@/shared/hooks/use-theme";
import { cn } from "@/shared/lib/utils";
import {
  buildSurahNameIndex,
  type MushafPageLayout,
  type MushafVerse,
  type MushafWord,
} from "../model";
import { MushafFontLoadingState } from "./MushafFontLoadingState";
import { MushafPage } from "./MushafPage";
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
  selectedWordLocation?: string | null;
  activeVerseKey?: string | null;
  activeWordLocation?: string | null;
  practiceMode?: boolean;
  hidePracticeWords?: boolean;
  revealedWordLocations?: string[];
  practiceTargetWordLocation?: string | null;
  incorrectWordLocation?: string | null;
  incorrectWordLabel?: string;
  getWordActivationLabel?: (word: MushafWord) => string;
  getSurahAccessibleLabel?: (surahName: string) => string;
  onWordActivate?: (
    word: MushafWord,
    event: MouseEvent<HTMLButtonElement>,
  ) => void;
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
  selectedWordLocation = null,
  activeVerseKey = null,
  activeWordLocation = null,
  practiceMode = false,
  hidePracticeWords = false,
  revealedWordLocations = EMPTY_LOCATIONS,
  practiceTargetWordLocation = null,
  incorrectWordLocation = null,
  incorrectWordLabel,
  getWordActivationLabel,
  getSurahAccessibleLabel,
  onWordActivate,
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
  const revealedLocations = useMemo(
    () => new Set(revealedWordLocations),
    [revealedWordLocations],
  );

  if (loadFont && !fontReady && !fontLoadFailed) {
    return (
      <div className={cn("mx-auto w-full max-w-3xl px-2", className)}>
        <MushafFontLoadingState compact message={loadingMessage} />
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
        activeVerseKey={activeVerseKey}
        activeWordLocation={activeWordLocation}
        practiceMode={practiceMode}
        hidePracticeWords={hidePracticeWords}
        revealedWordLocations={revealedLocations}
        practiceTargetWordLocation={practiceTargetWordLocation}
        incorrectWordLocation={incorrectWordLocation}
        incorrectWordLabel={incorrectWordLabel}
        getWordActivationLabel={getWordActivationLabel}
        getSurahAccessibleLabel={getSurahAccessibleLabel}
        onWordActivate={onWordActivate}
        id={id}
      />
    </div>
  );
}
