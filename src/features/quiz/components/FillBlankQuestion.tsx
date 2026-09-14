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
  selectedChoiceId,
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
          requiredChoiceId={question.hiddenVerseKey}
          onConfirm={onSubmit}
        />
      )}
      {answered && isCorrect !== null && selectedChoiceId !== null && (
        <QuizFeedback
          isCorrect={isCorrect}
          question={question}
          selectedChoiceId={selectedChoiceId}
          verseInfoRecords={verseInfoRecords}
          mushafData={mushafData}
          streak={streak}
          showMushaf={false}
          onNext={onNext}
        />
      )}
    </div>
  );
}
