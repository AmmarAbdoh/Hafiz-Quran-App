import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/utils";
import type { FillBlankQuizQuestion } from "../model/types";
import { QuizChoiceGrid } from "./QuizChoiceGrid";
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
  /*
   * Answering used to mean typing Arabic into a combobox to filter as many as
   * 286 whole-ayah options inside a short popover, then confirming - while
   * every other question type is a tap. It is a grid of options now, with the
   * full list still reachable for anyone who would rather look for something
   * specific.
   */
  const [searching, setSearching] = useState(false);
  const hasChoices = question.choices.length > 1;
  const showSearch = searching || !hasChoices;

  return (
    <div className="space-y-6">
      <QuizMushafPreview
        page={question.page}
        mushafData={mushafData}
        highlightVerseKey={answered ? question.hiddenVerseKey : null}
        hiddenVerseKey={answered ? null : question.hiddenVerseKey}
      />

      {!answered && hasChoices && !showSearch && (
        <QuizChoiceGrid choices={question.choices} onSelect={onSubmit} />
      )}

      {!answered && hasChoices && (
        <div className="flex justify-center">
          <button
            type="button"
            aria-expanded={searching}
            onClick={() => setSearching((open) => !open)}
            className="flex min-h-11 items-center gap-2 rounded-md px-3 text-label font-medium text-muted-foreground transition-colors duration-fast ease-standard hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {searching ? t("actions.back") : t("fillBlank.searchToggle")}
            <ChevronDown
              aria-hidden
              className={cn(
                "h-4 w-4 transition-transform duration-fast ease-standard",
                searching && "rotate-180",
              )}
            />
          </button>
        </div>
      )}

      {!answered && showSearch && (
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
