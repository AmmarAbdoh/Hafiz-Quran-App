import {
  BookOpen,
  Hash,
  Headphones,
  Layers,
  ListOrdered,
  PenLine,
  Sparkles,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { cn } from "@/shared/lib/utils";
import type { QuestionType, QuizScope } from "../model/types";
import { useQuizFormatters } from "../hooks/useQuizFormatters";
import {
  ALL_QUESTION_TYPES,
  getDefaultQuestionTypes,
  isQuestionTypeDisabled,
} from "../model/questionTypes";

const TYPE_ICONS: Record<QuestionType, typeof BookOpen> = {
  fill_blank: PenLine,
  complete_ayah: Sparkles,
  audio_identify: Headphones,
  surah_name: BookOpen,
  ayah_number: Hash,
  juz_number: Layers,
  hizb_number: ListOrdered,
  page_number: ListOrdered,
};

interface QuizTypesStepProps {
  scope: QuizScope;
  selectedTypes: QuestionType[];
  onTypesChange: (types: QuestionType[]) => void;
  onBack: () => void;
  onNext: () => void;
}

export function QuizTypesStep({
  scope,
  selectedTypes,
  onTypesChange,
  onBack,
  onNext,
}: QuizTypesStepProps) {
  const { t } = useTranslation("quiz");
  const { formatNumber, formatQuestionType } = useQuizFormatters();

  function toggleType(type: QuestionType): void {
    if (isQuestionTypeDisabled(type, scope)) return;
    onTypesChange(
      selectedTypes.includes(type)
        ? selectedTypes.filter((item) => item !== type)
        : [...selectedTypes, type],
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{t("types.title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("types.description")}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={() => onTypesChange(getDefaultQuestionTypes(scope))}
        >
          {t("types.selectAll")}
        </Button>
      </div>

      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="sr-only">{t("types.title")}</legend>
        {ALL_QUESTION_TYPES.map((type) => {
          const Icon = TYPE_ICONS[type];
          const disabled = isQuestionTypeDisabled(type, scope);
          const checked = selectedTypes.includes(type);
          return (
            <label
              key={type}
              htmlFor={`quiz-question-type-${type}`}
              className={cn(
                "flex min-h-11 cursor-pointer gap-3 rounded-xl border p-4 transition-colors",
                checked && "border-primary bg-primary/5",
                disabled && "cursor-not-allowed opacity-50",
                !disabled && !checked && "hover:bg-muted/40",
              )}
            >
              <Checkbox
                id={`quiz-question-type-${type}`}
                checked={checked}
                disabled={disabled}
                onCheckedChange={() => toggleType(type)}
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <span className="font-semibold">
                    {formatQuestionType(type)}
                  </span>
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {t(`types.descriptions.${type}`)}
                </span>
              </span>
            </label>
          );
        })}
      </fieldset>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {t("types.selectedCount", {
          count: formatNumber(selectedTypes.length),
        })}
      </p>
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" className="min-h-11" onClick={onBack}>
          {t("actions.back")}
        </Button>
        <Button
          className="min-h-11"
          disabled={selectedTypes.length === 0}
          onClick={onNext}
        >
          {t("types.continue")}
        </Button>
      </div>
    </div>
  );
}
