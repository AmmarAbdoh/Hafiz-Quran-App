import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import type { MushafVerse, VerseInfoRecord } from "@/domain/quran";
import type { useQuizEngine } from "../hooks/useQuizEngine";
import { useQuizFormatters } from "../hooks/useQuizFormatters";
import { AudioQuestion } from "./AudioQuestion";
import { CompleteAyahQuestion } from "./CompleteAyahQuestion";
import { FillBlankQuestion } from "./FillBlankQuestion";
import { InfoQuestion } from "./InfoQuestion";

type QuizEngine = ReturnType<typeof useQuizEngine>;

interface ActiveQuizProps {
  engine: QuizEngine;
  mushafData: MushafVerse[];
  verseInfoRecords: VerseInfoRecord[];
  onFinish: () => void;
  onExit: () => void;
}

export function ActiveQuiz({
  engine,
  mushafData,
  verseInfoRecords,
  onFinish,
  onExit,
}: ActiveQuizProps) {
  const { t } = useTranslation("quiz");
  const { formatNumber, formatQuestionType } = useQuizFormatters();
  const questionHeadingRef = useRef<HTMLHeadingElement>(null);
  const {
    currentQuestion,
    error,
    phase,
    answered,
    lastIsCorrect,
    lastSelectedChoiceId,
    streak,
    progress,
    score,
    submitAnswer,
    goToNextQuestion,
  } = engine;

  useEffect(() => {
    if (currentQuestion && !answered) questionHeadingRef.current?.focus();
  }, [answered, currentQuestion]);

  const progressText =
    progress.total > 0
      ? t("active.questionProgress", {
          current: formatNumber(progress.current),
          total: formatNumber(progress.total),
        })
      : t("active.questionProgressEndless", {
          current: formatNumber(progress.current),
        });
  const progressPercentage =
    progress.total > 0
      ? Math.min(100, (engine.answers.length / progress.total) * 100)
      : 0;
  const sharedProps = {
    mushafData,
    verseInfoRecords,
    answered,
    isCorrect: lastIsCorrect,
    selectedChoiceId: lastSelectedChoiceId,
    streak,
    onSubmit: submitAnswer,
    onNext: goToNextQuestion,
  };

  return (
    <div className="space-y-6">
      {/* One row: where you are, what is being asked, and how to stop. */}
      <header className="editorial-panel editorial-panel--inset sticky top-0 z-10 rounded-xl shadow-sm backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{progressText}</p>
            <p className="truncate text-label text-muted-foreground">
              {t("active.score", {
                score: `${formatNumber(score.correct)}/${formatNumber(score.total)}`,
              })}
              {currentQuestion &&
                ` · ${formatQuestionType(currentQuestion.type)}`}
            </p>
          </div>
          {streak > 1 && (
            <Badge variant="secondary" className="shrink-0">
              {t("active.streak", { count: formatNumber(streak) })}
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            className="min-h-11 shrink-0"
            onClick={onFinish}
          >
            {t("actions.finish")}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="min-h-11 min-w-11 shrink-0"
            onClick={onExit}
            aria-label={t("actions.exit")}
            title={t("actions.exit")}
          >
            <X className="h-4 w-4" aria-hidden />
          </Button>
        </div>
        {progress.total > 0 && (
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label={t("active.progressLabel")}
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-valuenow={engine.answers.length}
            aria-valuetext={progressText}
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] motion-reduce:transition-none"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        )}
      </header>

      {error && (
        <div
          className="editorial-panel--inset rounded-xl border border-destructive/30 bg-destructive/5 text-center"
          role="alert"
        >
          <p className="text-destructive">{t(`errors.${error}`)}</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {currentQuestion === null && phase === "feedback" ? (
              <Button
                className="min-h-11"
                variant="default"
                onClick={goToNextQuestion}
              >
                {t("feedback.next")}
              </Button>
            ) : null}
            <Button className="min-h-11" variant="outline" onClick={onExit}>
              {t("actions.newSetup")}
            </Button>
          </div>
        </div>
      )}

      {currentQuestion && !error && (
        <section
          key={currentQuestion.id}
          aria-labelledby="current-quiz-question"
        >
          <h2
            id="current-quiz-question"
            ref={questionHeadingRef}
            tabIndex={-1}
            className="sr-only"
          >
            {progressText}
          </h2>
          {currentQuestion.type === "fill_blank" && (
            <FillBlankQuestion question={currentQuestion} {...sharedProps} />
          )}
          {currentQuestion.type === "complete_ayah" && (
            <CompleteAyahQuestion question={currentQuestion} {...sharedProps} />
          )}
          {currentQuestion.type === "audio_identify" && (
            <AudioQuestion question={currentQuestion} {...sharedProps} />
          )}
          {(currentQuestion.type === "surah_name" ||
            currentQuestion.type === "ayah_number" ||
            currentQuestion.type === "juz_number" ||
            currentQuestion.type === "hizb_number" ||
            currentQuestion.type === "page_number") && (
            <InfoQuestion question={currentQuestion} {...sharedProps} />
          )}
        </section>
      )}
    </div>
  );
}
