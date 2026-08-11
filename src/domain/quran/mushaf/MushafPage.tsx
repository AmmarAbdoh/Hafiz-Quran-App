import { useLayoutEffect, useMemo, useRef, type MouseEvent } from "react";
import type { MushafPageLayout, MushafWord } from "../model";
import { buildMushafPageItems, buildMushafPageItemsForSurah } from "../model";
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
  activeVerseKey?: string | null;
  activeWordLocation?: string | null;
  practiceMode?: boolean;
  hidePracticeWords?: boolean;
  revealedWordLocations?: ReadonlySet<string>;
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
}

function isCenterAlignedPage(page: number): boolean {
  return page === 1 || page === 2;
}

function measureLineOverflowFit(lines: NodeListOf<HTMLElement>): number {
  let fit = 1;

  for (const line of lines) {
    if (line.childElementCount === 0) continue;
    if (line.scrollWidth > line.clientWidth + 1 && line.clientWidth > 0) {
      fit = Math.min(fit, line.clientWidth / line.scrollWidth);
    }
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
  activeVerseKey = null,
  activeWordLocation = null,
  practiceMode = false,
  hidePracticeWords = false,
  revealedWordLocations,
  practiceTargetWordLocation = null,
  incorrectWordLocation = null,
  incorrectWordLabel,
  getWordActivationLabel,
  getSurahAccessibleLabel,
  onWordActivate,
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
            activeVerseKey={activeVerseKey}
            activeWordLocation={activeWordLocation}
            practiceMode={practiceMode}
            hidePracticeWords={hidePracticeWords}
            revealedWordLocations={revealedWordLocations}
            practiceTargetWordLocation={practiceTargetWordLocation}
            incorrectWordLocation={incorrectWordLocation}
            incorrectWordLabel={incorrectWordLabel}
            getWordActivationLabel={getWordActivationLabel}
            onWordActivate={onWordActivate}
          />
        ),
      )}
    </div>
  );
}
