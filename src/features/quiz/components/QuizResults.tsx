import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import type { MushafVerse } from "@/domain/quran";
import type { QuestionType } from "../model/types";
import { useQuizFormatters } from "../hooks/useQuizFormatters";
import type { QuizAnswerRecord, QuizSessionSummaryV2 } from "../model/types";
import { parseVerseKey } from "../model/versePool";
import { QuizMushafPreview } from "./QuizMushafPreview";

interface QuizResultsProps {
  summary: QuizSessionSummaryV2;
  answers: QuizAnswerRecord[];
  mushafData: MushafVerse[];
  historySaveFailed: boolean;
  onRetry: () => void;
  onNewSetup: () => void;
}

export function QuizResults({
  summary,
  answers,
  mushafData,
  historySaveFailed,
  onRetry,
  onNewSetup,
}: QuizResultsProps) {
  const { t } = useTranslation("quiz");
  const {
    formatDuration,
    formatNumber,
    formatQuestionType,
    formatScopeSnapshot,
  } = useQuizFormatters();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [reviewKey, setReviewKey] = useState<string | null>(null);
  const percentage =
    summary.questionCount === 0
      ? 0
      : Math.round((summary.correctCount / summary.questionCount) * 100);
  const parsedReviewKey = reviewKey ? parseVerseKey(reviewKey) : null;
  const reviewVerse = parsedReviewKey
    ? mushafData.find(
        (verse) =>
          verse.sura_no === parsedReviewKey.surah &&
          verse.aya_no === parsedReviewKey.ayah,
      )
    : undefined;

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className="space-y-6">
      <section className="editorial-panel text-center">
        <h2 ref={headingRef} tabIndex={-1}>
          {t("results.title")}
        </h2>
        <p className="mt-2 text-display font-bold text-primary">
          {t("results.percentage", { count: formatNumber(percentage) })}
        </p>
        <p className="mt-1 text-muted-foreground">
          {t("results.scoreSummary", {
            correct: formatNumber(summary.correctCount),
            total: formatNumber(summary.questionCount),
          })}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("results.scopeDuration", {
            scope: formatScopeSnapshot(
              summary.scope,
              summary.legacyScopeSummary,
            ),
            duration: formatDuration(summary.durationMs),
          })}
        </p>
      </section>

      {historySaveFailed && (
        <p
          className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
          role="alert"
        >
          {t("errors.storage")}
        </p>
      )}

      <section className="space-y-3" aria-labelledby="quiz-accuracy-title">
        <h3 id="quiz-accuracy-title" className="font-semibold">
          {t("results.accuracyTitle")}
        </h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(summary.accuracyByType).map(([type, stats]) => {
            const questionType = type as QuestionType;
            const typePercentage =
              stats.total === 0
                ? 0
                : Math.round((stats.correct / stats.total) * 100);
            return (
              <Badge key={type} variant="outline">
                {formatQuestionType(questionType)}:{" "}
                {formatNumber(stats.correct)}/{formatNumber(stats.total)} (
                {t("results.percentage", {
                  count: formatNumber(typePercentage),
                })}
                )
              </Badge>
            );
          })}
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="quiz-review-title">
        <h3 id="quiz-review-title" className="font-semibold">
          {t("results.reviewTitle")}
        </h3>
        <ol className="space-y-2">
          {answers.map((answer, index) => (
            <li key={`${answer.questionId}-${index}`}>
              <button
                type="button"
                className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-start hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-pressed={reviewKey === answer.verseKey}
                onClick={() => setReviewKey(answer.verseKey)}
              >
                <span>
                  {t("results.questionLabel", {
                    count: formatNumber(index + 1),
                  })}{" "}
                  · {formatQuestionType(answer.questionType)}
                </span>
                <Badge variant={answer.isCorrect ? "success" : "destructive"}>
                  {answer.isCorrect
                    ? t("results.correct")
                    : t("results.incorrect")}
                </Badge>
              </button>
            </li>
          ))}
        </ol>
      </section>

      {reviewVerse && (
        <QuizMushafPreview
          page={reviewVerse.page}
          mushafData={mushafData}
          highlightVerseKey={reviewKey}
        />
      )}

      <div className="flex flex-wrap gap-3">
        <Button className="min-h-11" onClick={onRetry}>
          {t("results.retry")}
        </Button>
        <Button variant="outline" className="min-h-11" onClick={onNewSetup}>
          {t("results.newSetup")}
        </Button>
      </div>
    </div>
  );
}
