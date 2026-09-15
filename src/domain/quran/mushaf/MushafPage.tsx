import { useMemo } from "react";
import type { MushafPageLayout } from "../model";
import {
  buildMushafPageItems,
  buildMushafPageItemsForSurah,
  isCenterAlignedPage,
  showsStandaloneBismillah,
} from "../model";
import { MushafLine } from "./MushafLine";
import { MushafSurahHeader } from "./MushafSurahHeader";
import type {
  MushafWordActivateHandler,
  MushafWordPointerHandler,
} from "./wordActivation";
import { cn } from "@/shared/lib/utils";
import "./mushaf.css";

interface MushafPageProps {
  pageLayout: MushafPageLayout;
  surahNames?: ReadonlyMap<number, string>;
  fontFamily: string;
  fontPalette?: string;
  fontReady?: boolean;
  colored?: boolean;
  spreadLayout?: boolean;
  surahFilter?: number;
  selectedWordLocation?: string | null;
  highlightVerseKey?: string | null;
  highlightPulse?: boolean;
  activeVerseKey?: string | null;
  activeWordLocation?: string | null;
  practiceMode?: boolean;
  hidePracticeWords?: boolean;
  revealedWordLocations?: ReadonlySet<string>;
  practiceTargetWordLocation?: string | null;
  incorrectWordLocation?: string | null;
  incorrectWordLabel?: string;
  getSurahAccessibleLabel?: (surahName: string) => string;
  verseTextByKey?: ReadonlyMap<string, string>;
  bookmarkedVerseKeys?: ReadonlySet<string>;
  onWordActivate?: MushafWordActivateHandler;
  onWordPointerDown?: MushafWordPointerHandler;
  onWordPointerUp?: () => void;
  onWordPointerCancel?: () => void;
  className?: string;
  id?: string;
}

export function MushafPage({
  pageLayout,
  surahNames,
  fontFamily,
  fontPalette,
  fontReady = true,
  colored = false,
  spreadLayout = !isCenterAlignedPage(pageLayout.page),
  surahFilter,
  selectedWordLocation = null,
  highlightVerseKey = null,
  highlightPulse = true,
  activeVerseKey = null,
  activeWordLocation = null,
  practiceMode = false,
  hidePracticeWords = false,
  revealedWordLocations,
  practiceTargetWordLocation = null,
  incorrectWordLocation = null,
  incorrectWordLabel,
  getSurahAccessibleLabel,
  verseTextByKey,
  bookmarkedVerseKeys,
  onWordActivate,
  onWordPointerDown,
  onWordPointerUp,
  onWordPointerCancel,
  className,
  id,
}: MushafPageProps) {
  // Page item construction is a layout transform, so it stays stable while
  // playback state changes around it.
  const pageItems = useMemo(
    () =>
      surahFilter === undefined
        ? buildMushafPageItems(pageLayout)
        : buildMushafPageItemsForSurah(pageLayout, surahFilter),
    [pageLayout, surahFilter],
  );

  if (pageItems.length === 0) return null;

  return (
    <div
      id={id}
      className={cn(
        "mushaf-page",
        spreadLayout && "mushaf-page--full",
        className,
      )}
      data-page={pageLayout.page}
      dir="rtl"
      lang="ar"
    >
      {pageItems.map((item) =>
        item.type === "surah-header" ? (
          <MushafSurahHeader
            key={item.key}
            surahName={
              surahNames?.get(item.surahNumber) ?? `سورة ${item.surahNumber}`
            }
            headerLines={item.headerLines}
            accessibleLabel={getSurahAccessibleLabel?.(
              surahNames?.get(item.surahNumber) ?? `سورة ${item.surahNumber}`,
            )}
            showBismillah={showsStandaloneBismillah(item.surahNumber)}
          />
        ) : (
          <MushafLine
            key={item.key}
            lineNumber={item.line.line}
            words={item.line.words}
            spreadLayout={spreadLayout}
            fontFamily={fontFamily}
            fontPalette={fontPalette}
            fontReady={fontReady}
            colored={colored}
            selectedWordLocation={selectedWordLocation}
            highlightVerseKey={highlightVerseKey}
            highlightPulse={highlightPulse}
            activeVerseKey={activeVerseKey}
            activeWordLocation={activeWordLocation}
            practiceMode={practiceMode}
            hidePracticeWords={hidePracticeWords}
            revealedWordLocations={revealedWordLocations}
            practiceTargetWordLocation={practiceTargetWordLocation}
            incorrectWordLocation={incorrectWordLocation}
            incorrectWordLabel={incorrectWordLabel}
            verseTextByKey={verseTextByKey}
            bookmarkedVerseKeys={bookmarkedVerseKeys}
            onWordActivate={onWordActivate}
            onWordPointerDown={onWordPointerDown}
            onWordPointerUp={onWordPointerUp}
            onWordPointerCancel={onWordPointerCancel}
          />
        ),
      )}
    </div>
  );
}
