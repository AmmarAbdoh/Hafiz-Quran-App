import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";
import type { MushafVerse } from "@/domain/quran";
import { useQuizFormatters } from "../hooks/useQuizFormatters";
import type {
  QuestionType,
  QuizAnswerRecord,
  QuizSessionSummaryV3,
} from "../model/types";
import { parseVerseKey } from "../model/versePool";
import { QuizAnswerLabel } from "./QuizAnswerLabel";
import { QuizMushafPreview } from "./QuizMushafPreview";

interface QuizResultsProps {
  summary: QuizSessionSummaryV3;
  answers: QuizAnswerRecord[];
  mushafData: MushafVerse[];
  historySaveFailed: boolean;
  onRetry: () => void;
  onReviewMistakes: (verseKeys: string[]) => void;
  onNewSetup: () => void;
}

export function QuizResults({
  summary,
  answers,
  mushafData,
  historySaveFailed,
  onRetry,
  onReviewMistakes,
  onNewSetup,
}: QuizResultsProps) {
  const { t } = useTranslation("quiz");
  const {
    formatDuration,
    formatNumber,
    formatQuestionType,
    formatScopeSnapshot,
    formatVerseKey,
  } = useQuizFormatters();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const percentage =
    summary.questionCount === 0
      ? 0
      : Math.round((summary.correctCount / summary.questionCount) * 100);
  const missedVerseKeys = [
    ...new Set(
      answers
        .filter((answer) => !answer.isCorrect)
        .map((answer) => answer.testedVerseKey),
    ),
  ];

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  function renderPreview(verseKey: string) {
    const { surah, ayah } = parseVerseKey(verseKey);
    const verse = mushafData.find(
      (item) => item.sura_no === surah && item.aya_no === ayah,
    );
    if (!verse) return null;
    return (
      <QuizMushafPreview
        page={verse.page}
        mushafData={mushafData}
        surahFilter={verse.sura_no}
        highlightVerseKey={verseKey}
      />
    );
  }

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
        <p className="mt-1 flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
          <bdi>
            {formatScopeSnapshot(summary.scope, summary.legacyScopeSummary)}
          </bdi>
          <span aria-hidden>·</span>
          {/* A clock reads left to right even inside Arabic text. */}
          <bdi dir="ltr">{formatDuration(summary.durationMs)}</bdi>
        </p>
        {missedVerseKeys.length > 0 && (
          <p className="mt-3 text-sm">
            {t("results.missedSummary", {
              count: missedVerseKeys.length,
              formattedCount: formatNumber(missedVerseKeys.length),
            })}
          </p>
        )}
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

      <section className="space-y-2" aria-labelledby="quiz-review-title">
        <h3 id="quiz-review-title" className="font-semibold">
          {t("results.reviewTitle")}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t("results.reviewHint")}
        </p>
        <ol className="space-y-2">
          {answers.map((answer, index) => {
            const rowId = `${answer.questionId}-${index}`;
            const expanded = expandedId === rowId;
            return (
              <li
                key={rowId}
                className="overflow-hidden rounded-xl border border-border"
              >
                <button
                  type="button"
                  className="flex min-h-11 w-full items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-expanded={expanded}
                  onClick={() => setExpandedId(expanded ? null : rowId)}
                >
                  {answer.isCorrect ? (
                    <Check
                      className="h-4 w-4 shrink-0 text-success"
                      aria-hidden
                    />
                  ) : (
                    <X
                      className="h-4 w-4 shrink-0 text-destructive"
                      aria-hidden
                    />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">
                      {t("results.questionLabel", {
                        count: formatNumber(index + 1),
                      })}{" "}
                      · {formatQuestionType(answer.questionType)}
                    </span>
                    <span className="block truncate text-caption text-muted-foreground">
                      {formatVerseKey(answer.testedVerseKey)}
                    </span>
                  </span>
                  <Badge variant={answer.isCorrect ? "success" : "destructive"}>
                    {answer.isCorrect
                      ? t("results.correct")
                      : t("results.incorrect")}
                  </Badge>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                      expanded && "rotate-180",
                    )}
                    aria-hidden
                  />
                </button>

                {expanded && (
                  <div className="space-y-3 border-t border-border p-4">
                    <p className="text-sm">
                      <span className="font-semibold">
                        {t("feedback.correctAnswer")}
                      </span>{" "}
                      <QuizAnswerLabel label={answer.correctLabel} />
                    </p>
                    {!answer.isCorrect && (
                      <p className="text-sm">
                        <span className="font-semibold">
                          {t("feedback.yourAnswer")}
                        </span>{" "}
                        <QuizAnswerLabel label={answer.selectedLabel} />
                      </p>
                    )}
                    {renderPreview(answer.testedVerseKey)}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      <div className="flex flex-wrap gap-2">
        <Button className="min-h-11" onClick={onRetry}>
          {t("results.retry")}
        </Button>
        {missedVerseKeys.length > 0 && (
          <Button
            variant="secondary"
            className="min-h-11"
            onClick={() => onReviewMistakes(missedVerseKeys)}
          >
            {t("results.reviewMistakes", {
              count: missedVerseKeys.length,
              formattedCount: formatNumber(missedVerseKeys.length),
            })}
          </Button>
        )}
        <Button variant="outline" className="min-h-11" onClick={onNewSetup}>
          {t("results.newSetup")}
        </Button>
      </div>
    </div>
  );
}
