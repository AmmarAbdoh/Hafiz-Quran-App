import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  MushafFontLoadingState,
  MushafPageView,
  useQuranData,
  type MushafPageLayout,
  type MushafVerse,
} from "@/domain/quran";
import { Button } from "@/shared/components/ui/button";
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
  const [loadError, setLoadError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [tajweedColored] = useState(
    () => tajweedColoredProp ?? readTajweedColored(),
  );
  const resolvedTajweed = tajweedColoredProp ?? tajweedColored;

  useEffect(() => {
    let cancelled = false;
    setPageLayout(null);
    setLoadError(false);
    void loadPageLayout(page)
      .then((layout) => {
        if (!cancelled) setPageLayout(layout);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [loadPageLayout, page, reloadToken]);

  const revealedLocations = getRevealedLocations(
    pageLayout,
    page,
    hiddenVerseKey,
  );

  return (
    <div
      className={
        className ??
        "quiz-mushaf-preview editorial-panel--inset mx-auto w-full p-2"
      }
      dir="rtl"
      lang="ar"
    >
      {loadError ? (
        <div className="space-y-3 px-2 py-6 text-center">
          <p className="text-sm text-destructive" role="alert">
            {t("errors.mushafPreviewLoadFailed")}
          </p>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => setReloadToken((value) => value + 1)}
          >
            {t("actions.retry")}
          </Button>
        </div>
      ) : !pageLayout ? (
        <MushafFontLoadingState compact message={t("active.loading")} />
      ) : (
        <MushafPageView
          pageLayout={pageLayout}
          mushafData={mushafData}
          tajweedColored={resolvedTajweed}
          theme={theme}
          loadingMessage={t("active.loading")}
          highlightVerseKey={highlightVerseKey}
          surahFilter={surahFilter}
          hidePracticeWords={Boolean(hiddenVerseKey)}
          revealedWordLocations={revealedLocations}
        />
      )}
    </div>
  );
}
