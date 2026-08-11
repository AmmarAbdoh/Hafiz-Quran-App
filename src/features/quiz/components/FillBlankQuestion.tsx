import { useTranslation } from "react-i18next";
import type { FillBlankQuizQuestion } from "../model/types";
import { QuizChoiceSearch } from "./QuizChoiceSearch";
import { QuizFeedback } from "./QuizFeedback";
import { QuizMushafPreview } from "./QuizMushafPreview";
import type { QuizQuestionViewProps } from "./questionViewTypes";

interface FillBlankQuestionProps extends QuizQuestionViewProps {
  question: FillBlankQuizQuestion;
}

export function FillBlankQuestion({
  question,
  mushafData,
  verseInfoRecords,
  answered,
  isCorrect,
  streak,
  onSubmit,
  onNext,
}: FillBlankQuestionProps) {
  const { t } = useTranslation("quiz");
  return (
    <div className="space-y-6">
      <p className="text-center text-sm text-muted-foreground">
        {t("prompts.fillBlank")}
      </p>
      <QuizMushafPreview
        page={question.page}
        mushafData={mushafData}
        highlightVerseKey={answered ? question.hiddenVerseKey : null}
        hiddenVerseKey={answered ? null : question.hiddenVerseKey}
      />

      {!answered && (
        <QuizChoiceSearch
          choices={question.searchOptions}
          onConfirm={onSubmit}
        />
      )}
      {answered && isCorrect !== null && (
        <QuizFeedback
          isCorrect={isCorrect}
          verse={question.hiddenVerse}
          verseInfoRecords={verseInfoRecords}
          mushafData={mushafData}
          streak={streak}
          onNext={onNext}
        />
      )}
    </div>
  );
}
