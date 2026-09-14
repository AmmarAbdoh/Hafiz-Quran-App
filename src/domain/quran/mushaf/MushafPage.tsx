import {
  useLayoutEffect,
  useMemo,
  useRef,
  type MouseEvent,
  type PointerEvent,
} from "react";
import type { MushafPageLayout, MushafWord } from "../model";
import {
  buildMushafPageItems,
  buildMushafPageItemsForSurah,
  isCenterAlignedPage,
  showsStandaloneBismillah,
} from "../model";
import { MushafLine } from "./MushafLine";
import { MushafSurahHeader } from "./MushafSurahHeader";
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
}

/**
 * Summing the flex items is deliberate: the line is RTL and clipped, so
 * `scrollWidth` cannot be trusted to report the surplus that spills past the
 * inline end, which is exactly the overflow that hides the end of the line.
 */
function measureLineOverflowFit(lines: NodeListOf<HTMLElement>): number {
  let fit = 1;

  for (const line of lines) {
    const available = line.clientWidth;
    if (available <= 0) continue;

    const groups = line.querySelectorAll<HTMLElement>(".mushaf-word-group");
    if (groups.length === 0) continue;

    let content = 0;
    for (const group of groups) {
      content += group.getBoundingClientRect().width;
    }

    if (content > available + 1) fit = Math.min(fit, available / content);
  }

  return fit;
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
  const pageRef = useRef<HTMLDivElement>(null);
  // Page item construction is a layout transform and must stay stable for DOM
  // measurement while playback state changes.
  const pageItems = useMemo(
    () =>
      surahFilter === undefined
        ? buildMushafPageItems(pageLayout)
        : buildMushafPageItemsForSurah(pageLayout, surahFilter),
    [pageLayout, surahFilter],
  );

  useLayoutEffect(() => {
    const page = pageRef.current;
    if (!page || !spreadLayout || !fontReady) return;

    const measurePageFit = () => {
      page.style.setProperty("--mushaf-page-fit", "1");
      const lines = page.querySelectorAll<HTMLElement>(".mushaf-line__verse");
      let fit = measureLineOverflowFit(lines);

      if (fit < 0.998) {
        page.style.setProperty("--mushaf-page-fit", String(fit));
        page.getBoundingClientRect();
        fit = measureLineOverflowFit(lines);
        page.style.setProperty("--mushaf-page-fit", String(fit));
      } else {
        page.style.removeProperty("--mushaf-page-fit");
      }
    };

    measurePageFit();
    const observer = new ResizeObserver(measurePageFit);
    observer.observe(page);
    return () => observer.disconnect();
  }, [fontFamily, fontReady, pageLayout, spreadLayout, surahFilter]);

  if (pageItems.length === 0) return null;

  return (
    <div
      ref={pageRef}
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
