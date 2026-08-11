import { Loader2, RotateCcw, TriangleAlert, Volume2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { getAyahAudioUrl, useReciter } from "@/domain/quran";
import { useAyahAudio } from "../hooks/useAyahAudio";
import type { AudioIdentifyQuizQuestion } from "../model/types";
import { QuizChoiceGrid } from "./QuizChoiceGrid";
import { QuizFeedback } from "./QuizFeedback";
import { QuizMushafPreview } from "./QuizMushafPreview";
import type { QuizQuestionViewProps } from "./questionViewTypes";

interface AudioQuestionProps extends QuizQuestionViewProps {
  question: AudioIdentifyQuizQuestion;
}

export function AudioQuestion({
  question,
  mushafData,
  verseInfoRecords,
  answered,
  isCorrect,
  selectedChoiceId,
  streak,
  onSubmit,
  onNext,
}: AudioQuestionProps) {
  const { t } = useTranslation("quiz");
  const { reciter } = useReciter();
  const audioUrl = getAyahAudioUrl(
    reciter,
    question.verse.sura_no,
    question.verse.aya_no,
  );
  const { status, play } = useAyahAudio(audioUrl);
  const statusLabel = t(`audio.${status}`);

  return (
    <div className="space-y-6">
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 rounded-xl border bg-muted/20 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          {question.audioPrompt === "surah"
            ? t("prompts.audioSurah")
            : t("prompts.audioNext")}
        </p>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 gap-2"
          onClick={play}
          aria-label={statusLabel}
        >
          {status === "loading" && (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          )}
          {status === "playing" && (
            <Volume2 className="h-4 w-4 text-primary" aria-hidden />
          )}
          {status === "idle" && <Volume2 className="h-4 w-4" aria-hidden />}
          {status === "error" && <RotateCcw className="h-4 w-4" aria-hidden />}
          {statusLabel}
        </Button>
        <span className="sr-only" role="status" aria-live="polite">
          {statusLabel}
        </span>
        {status === "error" && (
          <p
            className="flex items-center gap-1.5 text-sm text-destructive"
            role="alert"
          >
            <TriangleAlert className="h-4 w-4" aria-hidden />
            {t("audio.error")}
          </p>
        )}
        {answered && (
          <QuizMushafPreview
            page={question.verse.page}
            mushafData={mushafData}
            highlightVerseKey={question.verseKey}
          />
        )}
      </div>

      <QuizChoiceGrid
        choices={question.choices}
        selectedId={selectedChoiceId}
        correctId={answered ? question.correctChoiceId : null}
        disabled={answered}
        onSelect={onSubmit}
      />
      {answered && isCorrect !== null && (
        <QuizFeedback
          isCorrect={isCorrect}
          verse={question.verse}
          verseInfoRecords={verseInfoRecords}
          mushafData={mushafData}
          streak={streak}
          onNext={onNext}
        />
      )}
    </div>
  );
}
