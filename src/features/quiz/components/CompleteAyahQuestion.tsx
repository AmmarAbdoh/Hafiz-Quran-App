import { useTranslation } from "react-i18next";
import type { CompleteAyahQuizQuestion } from "../model/types";
import { QuizChoiceGrid } from "./QuizChoiceGrid";
import { QuizFeedback } from "./QuizFeedback";
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
      {/* No mushaf page here: seeing the ayah would answer the question. */}
      <div className="mx-auto w-full max-w-2xl space-y-3 rounded-xl border border-border bg-muted/20 p-5 text-center">
        <p className="text-sm text-muted-foreground">
          {t("prompts.completeAyah")}
        </p>
        <p
          className="quran-text font-mushaf text-xl leading-loose"
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

      {answered && isCorrect !== null && selectedChoiceId !== null && (
        <QuizFeedback
          isCorrect={isCorrect}
          question={question}
          selectedChoiceId={selectedChoiceId}
          verseInfoRecords={verseInfoRecords}
          mushafData={mushafData}
          streak={streak}
          onNext={onNext}
        />
      )}
    </div>
  );
}
