import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Panel } from "@/shared/components/Panel";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
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
  const { t: tCommon } = useTranslation("common");
  const { formatNumber, formatQuestionType } = useQuizFormatters();
  const questionHeadingRef = useRef<HTMLHeadingElement>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
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
  /*
   * Audio asks one of two things depending on the question, and the info types
   * name themselves; the four question components used to each render this.
   */
  const questionPrompt = !currentQuestion
    ? ""
    : currentQuestion.type === "fill_blank"
      ? t("prompts.fillBlank")
      : currentQuestion.type === "complete_ayah"
        ? t("prompts.completeAyah")
        : currentQuestion.type === "audio_identify"
          ? t(
              currentQuestion.audioPrompt === "surah"
                ? "prompts.audioSurah"
                : "prompts.audioNext",
            )
          : t(`prompts.${currentQuestion.type}`);
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
      <Panel
        as="header"
        variant="inset"
        className="sticky top-0 z-sticky shadow-sm backdrop-blur"
      >
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
            className="shrink-0"
            onClick={onFinish}
          >
            {t("actions.finish")}
          </Button>
          {/*
            This throws the session away, and it sits a few millimetres from
            the button that saves it. Asking first is the difference between
            the two being adjacent and being interchangeable.
          */}
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => setConfirmDiscard(true)}
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
      </Panel>

      {error && (
        <Panel
          variant="inset"
          className="border-destructive/30 bg-destructive/5 text-center"
          role="alert"
        >
          <p className="text-destructive">{t(`errors.${error}`)}</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {currentQuestion === null && phase === "feedback" ? (
              <Button variant="default" onClick={goToNextQuestion}>
                {t("feedback.next")}
              </Button>
            ) : null}
            <Button variant="outline" onClick={onExit}>
              {t("actions.newSetup")}
            </Button>
          </div>
        </Panel>
      )}

      {currentQuestion && !error && (
        <section
          key={currentQuestion.id}
          aria-labelledby="current-quiz-question"
        >
          {/*
            The question itself, as a heading a sighted reader can see. It was
            sr-only and held the progress - which the header already states -
            while the actual question was the smallest, most muted line on the
            screen, inside each question component.
          */}
          <h2
            id="current-quiz-question"
            ref={questionHeadingRef}
            tabIndex={-1}
            className="mb-6 text-balance text-center text-subheading font-semibold focus-visible:outline-none"
          >
            {questionPrompt}
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

      <Dialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <DialogContent
          closeLabel={tCommon("actions.close")}
          className="max-w-md"
        >
          <DialogHeader>
            <DialogTitle>{t("discard.title")}</DialogTitle>
            <DialogDescription>{t("discard.description")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDiscard(false)}>
              {t("discard.cancel")}
            </Button>
            <Button variant="destructive" onClick={onExit}>
              {t("discard.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
