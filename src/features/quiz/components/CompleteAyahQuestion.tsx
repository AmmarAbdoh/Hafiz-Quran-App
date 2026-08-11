import { useTranslation } from "react-i18next";
import type { CompleteAyahQuizQuestion } from "../model/types";
import { QuizChoiceGrid } from "./QuizChoiceGrid";
import { QuizFeedback } from "./QuizFeedback";
import { QuizMushafPreview } from "./QuizMushafPreview";
import type { QuizQuestionViewProps } from "./questionViewTypes";

interface CompleteAyahQuestionProps extends QuizQuestionViewProps {
  question: CompleteAyahQuizQuestion;
}

export function CompleteAyahQuestion({
  question,
  mushafData,
  verseInfoRecords,
  answered,
  isCorrect,
  selectedChoiceId,
  streak,
  onSubmit,
  onNext,
}: CompleteAyahQuestionProps) {
  const { t } = useTranslation("quiz");
  return (
    <div className="space-y-6">
      <div className="space-y-3 text-center">
        <p className="text-sm text-muted-foreground">
          {t("prompts.completeAyah")}
        </p>
        <QuizMushafPreview
          page={question.verse.page}
          mushafData={mushafData}
          highlightVerseKey={question.verseKey}
        />
        <p
          className="quran-text font-mushaf text-lg leading-loose text-muted-foreground"
          dir="rtl"
          lang="ar"
        >
          {question.promptText} …
        </p>
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
