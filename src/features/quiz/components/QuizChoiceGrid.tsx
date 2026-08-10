import { cn } from "@/shared/lib/utils";
import type { QuizChoice } from "@/features/quiz/lib/quiz-types";

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
  const showResults = correctId !== null && selectedId !== null;

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-2 sm:grid-cols-2">
      {choices.map((choice) => {
        const isSelected = selectedId === choice.id;
        const isCorrect = showResults && choice.id === correctId;
        const isWrong = showResults && isSelected && choice.id !== correctId;

        return (
          <button
            key={choice.id}
            type="button"
            disabled={disabled || showResults}
            onClick={() => onSelect(choice.id)}
            className={cn(
              "rounded-xl border px-4 py-3 text-start text-sm font-medium leading-relaxed transition-colors",
              "hover:border-primary/40 hover:bg-muted/50",
              "disabled:cursor-default",
              isSelected && !showResults && "border-primary bg-primary/10",
              isCorrect && "border-green-500 bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-100",
              isWrong && "border-destructive bg-destructive/10 text-destructive line-through",
            )}
          >
            {choice.label}
          </button>
        );
      })}
    </div>
  );
}
