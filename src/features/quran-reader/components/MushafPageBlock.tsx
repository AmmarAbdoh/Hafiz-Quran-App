import { useLayoutEffect, useMemo, useRef } from "react";
import { MushafLine } from "@/features/quran-reader/components/MushafLine";
import { MushafSurahHeader } from "@/features/quran-reader/components/MushafSurahHeader";
import { useQcfPageFont } from "@/features/quran-reader/hooks/useQcfPageFont";
import type { VerseSelection } from "@/features/quran-reader/types/selection";
import { isCenterAlignedPage } from "@/features/quran-reader/utils/pageUtils";
import { measureLineOverflowFit } from "@/features/quran-reader/utils/pageFit";
import { cn } from "@/shared/lib/utils";
import type { Theme } from "@/shared/hooks/use-theme";
import {
  buildMushafPageItems,
  buildMushafPageItemsForSurah,
  getSurahTashkeelName,
  getWordLayoutForPage,
} from "@/shared/services/quran-data";
import type {
  MushafVerse as MushafVerseType,
  MushafWord as MushafWordType,
  MushafWordLayoutData,
} from "@/shared/types/quran";

interface MushafPageBlockProps {
  page: number;
  mushafData: MushafVerseType[];
  wordLayout: MushafWordLayoutData;
  tajweedColored: boolean;
  theme: Theme;
  loadFont?: boolean;
  highlightVerseKey?: string | null;
  selection: VerseSelection | null;
  recitationVerseKey: string | null;
  recitationWordLocation: string | null;
  practiceMode: boolean;
  practiceHideAyat: boolean;
  practiceRevealedLocations: string[];
  practiceTargetWordLocation: string | null;
  practiceWrongFlashLocation: string | null;
  onWordActivate: (
    word: MushafWordType,
    event: React.MouseEvent<HTMLElement>,
  ) => void;
  className?: string;
  id?: string;
  /** When set, only lines and headers for this surah are shown. */
  surahFilter?: number;
}

export function MushafPageBlock({
  page,
  mushafData,
  wordLayout,
  tajweedColored,
  theme,
  loadFont = true,
  highlightVerseKey = null,
  selection,
  recitationVerseKey,
  recitationWordLocation,
  practiceMode,
  practiceHideAyat,
  practiceRevealedLocations,
  practiceTargetWordLocation,
  practiceWrongFlashLocation,
  onWordActivate,
  className,
  id,
  surahFilter,
}: MushafPageBlockProps) {
  const pageRef = useRef<HTMLDivElement>(null);
  const { fontFamily, fontPalette, ready: fontReady, colored } =
    useQcfPageFont(page, {
      colored: tajweedColored,
      theme,
      enabled: loadFont,
    });

  const pageLayout = getWordLayoutForPage(wordLayout, page);
  const pageItems = useMemo(() => {
    if (!pageLayout) return [];
    if (surahFilter !== undefined) {
      return buildMushafPageItemsForSurah(pageLayout, surahFilter);
    }
    return buildMushafPageItems(pageLayout);
  }, [pageLayout, surahFilter]);
  const visibleLines = useMemo(
    () =>
      pageItems
        .filter((item) => item.type === "line")
        .map((item) => item.line),
    [pageItems],
  );

  if (!pageLayout || pageItems.length === 0) {
    return null;
  }

  const isSparsePage = isCenterAlignedPage(page);
  const useSpreadLayout = !isSparsePage;

  useLayoutEffect(() => {
    const pageEl = pageRef.current;
    if (!pageEl || !useSpreadLayout || !fontReady) return;

    const measurePageFit = () => {
      pageEl.style.setProperty("--mushaf-page-fit", "1");

      const verses = pageEl.querySelectorAll<HTMLElement>(".mushaf-line__verse");
      let fit = measureLineOverflowFit(verses);

      if (fit < 0.998) {
        pageEl.style.setProperty("--mushaf-page-fit", String(fit));
        pageEl.getBoundingClientRect();
        fit = measureLineOverflowFit(verses);
        pageEl.style.setProperty("--mushaf-page-fit", String(fit));
      } else {
        pageEl.style.removeProperty("--mushaf-page-fit");
      }
    };

    measurePageFit();
    const observer = new ResizeObserver(measurePageFit);
    observer.observe(pageEl);
    return () => observer.disconnect();
  }, [page, fontReady, visibleLines, useSpreadLayout, fontFamily]);

  return (
    <div className={cn("relative mx-auto w-fit max-w-full px-2", className)}>
      {loadFont && !fontReady && (
        <div className="absolute inset-0 z-10 flex min-h-[6rem] items-center justify-center text-sm text-muted-foreground">
          جاري تحميل خط الصفحة...
        </div>
      )}

      <div
        ref={pageRef}
        id={id}
        className={cn("mushaf-page", useSpreadLayout && "mushaf-page--full")}
      >
        {pageItems.map((item) =>
          item.type === "surah-header" ? (
            <MushafSurahHeader
              key={item.key}
              surahName={getSurahTashkeelName(mushafData, item.surahNumber)}
              headerLines={item.headerLines}
            />
          ) : (
            <MushafLine
              key={item.key}
              lineNumber={item.line.line}
              words={item.line.words}
              spreadLayout={useSpreadLayout}
              fontFamily={fontFamily}
              fontPalette={fontPalette}
              fontReady={fontReady}
              colored={colored}
              selection={selection}
              highlightVerseKey={highlightVerseKey}
              recitationVerseKey={recitationVerseKey}
              recitationWordLocation={recitationWordLocation}
              practiceMode={practiceMode}
              practiceHideAyat={practiceHideAyat}
              practiceRevealedLocations={practiceRevealedLocations}
              practiceTargetWordLocation={practiceTargetWordLocation}
              practiceWrongFlashLocation={practiceWrongFlashLocation}
              onWordActivate={onWordActivate}
            />
          ),
        )}
      </div>
    </div>
  );
}
