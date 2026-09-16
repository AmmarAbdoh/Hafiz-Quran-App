import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  MushafPageSkeleton,
  MushafPageView,
  useQuranData,
  type MushafPageLayout,
  type MushafVerse,
} from "@/domain/quran";
import { Panel } from "@/shared/components/Panel";
import { Button } from "@/shared/components/ui/button";
import { useTheme } from "@/shared/hooks/use-theme";
import { cn } from "@/shared/lib/utils";
import { useTajweedColored } from "@/features/quran-reader/hooks/useTajweedColored";
const QUIZ_PREVIEW_SKELETON_LINES = 6;

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
  const { tajweedColored: storedTajweedColored } = useTajweedColored();
  const { loadPageLayout } = useQuranData();
  const [pageLayout, setPageLayout] = useState<MushafPageLayout | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const resolvedTajweed = tajweedColoredProp ?? storedTajweedColored;

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
    <Panel
      variant="inset"
      className={cn("quiz-mushaf-preview mx-auto w-full p-2", className)}
      dir="rtl"
      lang="ar"
      /*
       * The preview scrolls within itself when the page is taller than the
       * room left for it, and a region that scrolls has to be reachable by
       * keyboard or it is content only a mouse can see. Naming it keeps the
       * tab stop meaningful rather than an unexplained halt.
       */
      role="group"
      aria-label={t("mushafPreviewLabel")}
      tabIndex={0}
    >
      {loadError ? (
        <div className="space-y-3 px-2 py-6 text-center">
          <p className="text-sm text-destructive" role="alert">
            {t("errors.mushafPreviewLoadFailed")}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => setReloadToken((value) => value + 1)}
          >
            {t("actions.retry")}
          </Button>
        </div>
      ) : !pageLayout ? (
        <div className="relative mx-auto w-fit max-w-full px-2">
          <MushafPageSkeleton
            page={page}
            lines={QUIZ_PREVIEW_SKELETON_LINES}
            label={t("active.loading")}
          />
        </div>
      ) : (
        <MushafPageView
          pageLayout={pageLayout}
          mushafData={mushafData}
          tajweedColored={resolvedTajweed}
          theme={theme}
          loadingMessage={t("active.loading")}
          highlightVerseKey={highlightVerseKey}
          // Review reads at its own pace, so the tested ayah stays tinted.
          highlightPulse={false}
          surahFilter={surahFilter}
          practiceMode={Boolean(hiddenVerseKey)}
          hidePracticeWords={Boolean(hiddenVerseKey)}
          revealedWordLocations={revealedLocations}
        />
      )}
    </Panel>
  );
}
