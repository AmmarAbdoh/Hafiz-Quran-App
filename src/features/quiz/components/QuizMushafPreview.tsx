import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  MushafFontLoadingState,
  MushafPageView,
  useQuranData,
  type MushafPageLayout,
  type MushafVerse,
} from "@/domain/quran";
import { useTheme } from "@/shared/hooks/use-theme";
import { safeStorage } from "@/shared/storage";

const TAJWEED_STORAGE_KEY = "mushaf-tajweed-colored";

function readTajweedColored(): boolean {
  return safeStorage.getItem(TAJWEED_STORAGE_KEY) === "true";
}

function getRevealedLocations(
  pageLayout: MushafPageLayout | null,
  page: number,
  hiddenVerseKey: string | null,
): string[] {
  if (!pageLayout || !hiddenVerseKey) return [];

  return pageLayout.lines.flatMap((line) =>
    line.words
      .filter(
        (word) =>
          word.page === page &&
          (word.verse_key !== hiddenVerseKey || word.char_type === "end"),
      )
      .map((word) => word.location),
  );
}

interface QuizMushafPreviewProps {
  page: number;
  mushafData: MushafVerse[];
  surahFilter?: number;
  highlightVerseKey?: string | null;
  hiddenVerseKey?: string | null;
  tajweedColored?: boolean;
  className?: string;
}

export function QuizMushafPreview({
  page,
  mushafData,
  surahFilter,
  highlightVerseKey = null,
  hiddenVerseKey = null,
  tajweedColored: tajweedColoredProp,
  className,
}: QuizMushafPreviewProps) {
  const { t } = useTranslation("quiz");
  const { theme } = useTheme();
  const { loadPageLayout } = useQuranData();
  const [pageLayout, setPageLayout] = useState<MushafPageLayout | null>(null);
  const [tajweedColored] = useState(
    () => tajweedColoredProp ?? readTajweedColored(),
  );
  const resolvedTajweed = tajweedColoredProp ?? tajweedColored;

  useEffect(() => {
    let cancelled = false;
    setPageLayout(null);
    void loadPageLayout(page)
      .then((layout) => {
        if (!cancelled) setPageLayout(layout);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [loadPageLayout, page]);

  const revealedLocations = getRevealedLocations(
    pageLayout,
    page,
    hiddenVerseKey,
  );

  return (
    <div
      className={
        className ??
        "quiz-mushaf-preview mx-auto w-full rounded-xl border bg-background p-2 shadow-sm"
      }
      dir="rtl"
      lang="ar"
    >
      {!pageLayout ? (
        <MushafFontLoadingState compact message={t("active.loading")} />
      ) : (
        <MushafPageView
          pageLayout={pageLayout}
          mushafData={mushafData}
          tajweedColored={resolvedTajweed}
          theme={theme}
          loadingMessage={t("active.loading")}
          highlightVerseKey={highlightVerseKey}
          practiceMode={Boolean(hiddenVerseKey)}
          hidePracticeWords={Boolean(hiddenVerseKey)}
          revealedWordLocations={revealedLocations}
          surahFilter={surahFilter}
        />
      )}
    </div>
  );
}
