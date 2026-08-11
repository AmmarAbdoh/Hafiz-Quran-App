import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { VerseMetadata } from "@/domain/quran";
import { getVerseInfo } from "@/domain/quran";
import type { MushafVerse, VerseInfoRecord } from "@/domain/quran";
import { QuizMushafPreview } from "./QuizMushafPreview";

interface QuizFeedbackProps {
  isCorrect: boolean;
  verse: MushafVerse;
  verseInfoRecords: VerseInfoRecord[];
  mushafData: MushafVerse[];
  streak: number;
  onNext: () => void;
}

export function QuizFeedback({
  isCorrect,
  verse,
  verseInfoRecords,
  mushafData,
  streak,
  onNext,
}: QuizFeedbackProps) {
  const { t } = useTranslation("quiz");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const verseInfo = getVerseInfo(verse.id, verseInfoRecords);
  const verseKey = `${verse.sura_no}:${verse.aya_no}`;

  useEffect(() => {
    headingRef.current?.focus();
  }, [verseKey]);

  return (
    <section
      className="mt-8 space-y-5 text-center"
      aria-labelledby="quiz-feedback-heading"
    >
      <div role="status" aria-live="polite" aria-atomic="true">
        <h3
          id="quiz-feedback-heading"
          ref={headingRef}
          tabIndex={-1}
          className="sr-only"
        >
          {isCorrect
            ? t("feedback.correctAnnouncement")
            : t("feedback.incorrectAnnouncement")}
        </h3>
        <div
          className="flex flex-wrap items-center justify-center gap-2"
          aria-hidden="true"
        >
          <Badge
            variant={isCorrect ? "success" : "destructive"}
            className="px-4 py-1 text-base"
          >
            {isCorrect ? t("feedback.correct") : t("feedback.incorrect")}
          </Badge>
          {isCorrect && streak > 1 && (
            <Badge variant="secondary">
              {t("feedback.streak", { count: streak })}
            </Badge>
          )}
        </div>
      </div>

      <QuizMushafPreview
        page={verse.page}
        mushafData={mushafData}
        highlightVerseKey={verseKey}
      />
      <VerseMetadata items={verseInfo} />
      <Button size="lg" onClick={onNext}>
        {t("feedback.next")}
      </Button>
    </section>
  );
}
