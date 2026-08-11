import { Check, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/utils";
import { useQuizFormatters } from "../hooks/useQuizFormatters";
import type { QuizChoice } from "../model/types";

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
  const { formatNumber } = useQuizFormatters();
  const showResults = correctId !== null && selectedId !== null;

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-3 sm:grid-cols-2">
      {choices.map((choice) => {
        const isSelected = selectedId === choice.id;
        const isCorrect = showResults && choice.id === correctId;
        const isWrong = showResults && isSelected && !isCorrect;
        const numericLabel = /^\d+$/.test(choice.label)
          ? formatNumber(Number.parseInt(choice.label, 10))
          : choice.label;

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
                "border-emerald-600 bg-emerald-50 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-50",
              isWrong &&
                "border-destructive bg-destructive/10 text-destructive",
            )}
          >
            <span className="flex items-start gap-2">
              <span className="flex-1" dir="rtl" lang="ar">
                {numericLabel}
              </span>
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
