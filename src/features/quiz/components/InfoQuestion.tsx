import { useTranslation } from "react-i18next";
import type { InfoQuizQuestion } from "../model/types";
import { QuizChoiceGrid } from "./QuizChoiceGrid";
import { QuizFeedback } from "./QuizFeedback";
import { QuizMushafPreview } from "./QuizMushafPreview";
import type { QuizQuestionViewProps } from "./questionViewTypes";

interface InfoQuestionProps extends QuizQuestionViewProps {
  question: InfoQuizQuestion;
}

export function InfoQuestion({
  question,
  mushafData,
  verseInfoRecords,
  answered,
  isCorrect,
  selectedChoiceId,
  streak,
  onSubmit,
  onNext,
}: InfoQuestionProps) {
  const { t } = useTranslation("quiz");
  return (
    <div className="space-y-6">
      <div className="space-y-3 text-center">
        <p className="text-sm text-muted-foreground">
          {t(`prompts.${question.type}`)}
        </p>
        <QuizMushafPreview
          page={question.verse.page}
          mushafData={mushafData}
          highlightVerseKey={question.verseKey}
        />
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
