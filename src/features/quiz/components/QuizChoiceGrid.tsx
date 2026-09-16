import { Check, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/utils";
import type { QuizChoice } from "../model/types";
import { QuizAnswerLabel } from "./QuizAnswerLabel";

interface QuizChoiceGridProps {
  choices: QuizChoice[];
  selectedId?: string | null;
  correctId?: string | null;
  disabled?: boolean;
  onSelect: (choiceId: string) => void;
}

export function QuizChoiceGrid({
  choices,
  selectedId = null,
  correctId = null,
  disabled = false,
  onSelect,
}: QuizChoiceGridProps) {
  const { t } = useTranslation("quiz");
  const showResults = correctId !== null && selectedId !== null;

  return (
    /*
     * The grid scrolls; an option does not truncate. complete_ayah offers whole
     * ayah continuations, and line-clamp-3 could cut one mid-word - asking the
     * learner to choose between texts they cannot finish reading, which makes
     * the question unanswerable rather than merely untidy.
     */
    <div className="app-main-scroll mx-auto grid max-h-[min(32rem,60vh)] w-full max-w-2xl gap-3 overflow-y-auto sm:grid-cols-2">
      {choices.map((choice) => {
        const isSelected = selectedId === choice.id;
        const isCorrect = showResults && choice.id === correctId;
        const isWrong = showResults && isSelected && !isCorrect;

        return (
          <button
            key={choice.id}
            type="button"
            disabled={disabled || showResults}
            aria-pressed={isSelected}
            onClick={() => onSelect(choice.id)}
            className={cn(
              "min-h-11 rounded-xl border px-4 py-3 text-start text-sm font-medium leading-relaxed transition-colors",
              "hover:border-primary/50 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "disabled:cursor-default disabled:opacity-100",
              isSelected && !showResults && "border-primary bg-primary/10",
              isCorrect &&
                "border-success bg-success/15 text-success dark:text-success",
              isWrong &&
                "border-destructive bg-destructive/10 text-destructive",
            )}
          >
            <span className="flex items-start gap-2">
              <QuizAnswerLabel className="flex-1" label={choice.label} />
              {isCorrect && (
                <span className="inline-flex shrink-0 items-center gap-1">
                  <Check className="h-4 w-4" aria-hidden />
                  <span className="sr-only">{t("results.correct")}</span>
                </span>
              )}
              {isWrong && (
                <span className="inline-flex shrink-0 items-center gap-1">
                  <X className="h-4 w-4" aria-hidden />
                  <span className="sr-only">{t("results.incorrect")}</span>
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
