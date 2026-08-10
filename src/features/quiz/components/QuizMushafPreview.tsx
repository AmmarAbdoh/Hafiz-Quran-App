import { useEffect, useMemo, useState } from "react";
import { MushafFontLoadingState } from "@/features/quran-reader/components/MushafFontLoadingState";
import { MushafPageBlock } from "@/features/quran-reader/components/MushafPageBlock";
import {
  preloadQcfPageFont,
  useMushafPagesFontReady,
} from "@/features/quran-reader/hooks/useQcfPageFont";
import { getWordLayoutForPage } from "@/shared/services/quran-data";
import { useTheme } from "@/shared/hooks/use-theme";
import type {
  MushafVerse,
  MushafWord,
  MushafWordLayoutData,
} from "@/shared/types/quran";

const TAJWEED_STORAGE_KEY = "mushaf-tajweed-colored";

function readTajweedColored(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(TAJWEED_STORAGE_KEY) === "true";
}

interface QuizMushafPreviewProps {
  page: number;
  mushafData: MushafVerse[];
  wordLayout: MushafWordLayoutData;
  /** When false, shows the full mushaf page (better for fill-blank context). */
  surahFilter?: number;
  highlightVerseKey?: string | null;
  hiddenVerseKey?: string | null;
  tajweedColored?: boolean;
  className?: string;
}

function collectRevealedWordLocations(
  wordLayout: MushafWordLayoutData,
  page: number,
  hiddenVerseKey: string,
): string[] {
  const pageLayout = getWordLayoutForPage(wordLayout, page);
  if (!pageLayout) return [];

  const locations: string[] = [];
  for (const line of pageLayout.lines) {
    for (const word of line.words) {
      if (word.page !== page) continue;
      if (word.verse_key === hiddenVerseKey && word.char_type !== "end") {
        continue;
      }
      locations.push(word.location);
    }
  }
  return locations;
}

export function QuizMushafPreview({
  page,
  mushafData,
  wordLayout,
  surahFilter,
  highlightVerseKey = null,
  hiddenVerseKey = null,
  tajweedColored: tajweedColoredProp,
  className,
}: QuizMushafPreviewProps) {
  const { theme } = useTheme();
  const [tajweedColored] = useState(() =>
    tajweedColoredProp ?? readTajweedColored(),
  );
  const resolvedTajweed =
    tajweedColoredProp !== undefined ? tajweedColoredProp : tajweedColored;

  useEffect(() => {
    void preloadQcfPageFont(page, theme, resolvedTajweed);
  }, [page, theme, resolvedTajweed]);

  const fontsReady = useMushafPagesFontReady([page], theme, resolvedTajweed, {
    requiredCount: 1,
    enabled: true,
  });

  const revealedLocations = useMemo(() => {
    if (!hiddenVerseKey) return [];
    return collectRevealedWordLocations(wordLayout, page, hiddenVerseKey);
  }, [wordLayout, page, hiddenVerseKey]);

  const handleWordActivate = (
    _word: MushafWord,
    _event: React.MouseEvent<HTMLElement>,
  ) => {};

  return (
    <div
      className={
        className ??
        "quiz-mushaf-preview mx-auto w-full rounded-xl border bg-background p-2 shadow-sm"
      }
      dir="rtl"
    >
      {!fontsReady ? (
        <MushafFontLoadingState compact message="جاري تحميل خط المصحف…" />
      ) : (
        <MushafPageBlock
          page={page}
          mushafData={mushafData}
          wordLayout={wordLayout}
          tajweedColored={resolvedTajweed}
          theme={theme}
          highlightVerseKey={highlightVerseKey}
          selection={null}
          recitationVerseKey={null}
          recitationWordLocation={null}
          practiceMode={Boolean(hiddenVerseKey)}
          practiceHideAyat={Boolean(hiddenVerseKey)}
          practiceRevealedLocations={revealedLocations}
          practiceTargetWordLocation={null}
          practiceWrongFlashLocation={null}
          onWordActivate={handleWordActivate}
          surahFilter={surahFilter}
        />
      )}
    </div>
  );
}
