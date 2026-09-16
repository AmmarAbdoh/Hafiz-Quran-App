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
  return (
    <div className="space-y-6">
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
