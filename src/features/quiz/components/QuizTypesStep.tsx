import {
  BookOpen,
  FileText,
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
import { useQuizFormatters } from "../hooks/useQuizFormatters";
import {
  LOCATION_QUESTION_TYPES,
  QUIZ_PRESETS,
  RECALL_QUESTION_TYPES,
  getPresetQuestionTypes,
  matchesPreset,
  type QuizPreset,
} from "../model/questionTypes";
import {
  getQuestionTypeAvailability,
  type ScopeCoverage,
} from "../model/scopeCoverage";
import type { QuestionType } from "../model/types";

const TYPE_ICONS: Record<QuestionType, typeof BookOpen> = {
  fill_blank: PenLine,
  complete_ayah: Sparkles,
  audio_identify: Headphones,
  surah_name: BookOpen,
  ayah_number: Hash,
  juz_number: Layers,
  hizb_number: ListOrdered,
  page_number: FileText,
};

interface QuizTypesStepProps {
  coverage: ScopeCoverage;
  selectedTypes: QuestionType[];
  onTypesChange: (types: QuestionType[]) => void;
  onBack: () => void;
  onNext: () => void;
}

export function QuizTypesStep({
  coverage,
  selectedTypes,
  onTypesChange,
  onBack,
  onNext,
}: QuizTypesStepProps) {
  const { t } = useTranslation("quiz");
  const { formatNumber, formatQuestionType } = useQuizFormatters();

  function renderGroup(
    titleKey: "types.groups.recall" | "types.groups.location",
    descriptionKey:
      | "types.groups.recallDescription"
      | "types.groups.locationDescription",
    types: readonly QuestionType[],
  ) {
    return (
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">{t(titleKey)}</legend>
        <p className="text-caption text-muted-foreground">
          {t(descriptionKey)}
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {types.map((type) => {
            const Icon = TYPE_ICONS[type];
            const availability = getQuestionTypeAvailability(type, coverage);
            const checked =
              selectedTypes.includes(type) && availability.available;
            return (
              <label
                key={type}
                htmlFor={`quiz-question-type-${type}`}
                className={cn(
                  "flex gap-2.5 rounded-xl border p-3 transition-colors",
                  availability.available
                    ? "cursor-pointer"
                    : "cursor-not-allowed opacity-60",
                  checked && "border-primary bg-primary/5",
                  availability.available &&
                    !checked &&
                    "hover:border-primary/40 hover:bg-muted/40",
                )}
              >
                <Checkbox
                  id={`quiz-question-type-${type}`}
                  className="mt-0.5"
                  checked={checked}
                  disabled={!availability.available}
                  onCheckedChange={() =>
                    onTypesChange(
                      selectedTypes.includes(type)
                        ? selectedTypes.filter((item) => item !== type)
                        : [...selectedTypes, type],
                    )
                  }
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <Icon
                      className="h-4 w-4 shrink-0 text-primary"
                      aria-hidden
                    />
                    <span className="font-semibold">
                      {formatQuestionType(type)}
                    </span>
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {t(`types.descriptions.${type}`)}
                  </span>
                  <span className="mt-1 block text-xs italic text-muted-foreground">
                    {t(`types.examples.${type}`)}
                  </span>
                  {!availability.available && (
                    <span className="mt-1.5 block text-xs font-medium text-destructive">
                      {t(`types.unavailable.${availability.reason}`)}
                    </span>
                  )}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
    );
  }

  const availableSelectedTypes = selectedTypes.filter(
    (type) => getQuestionTypeAvailability(type, coverage).available,
  );

  function handleContinue(): void {
    onTypesChange(availableSelectedTypes);
    onNext();
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 tabIndex={-1} className="text-xl font-semibold outline-none">
          {t("types.title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("types.description")}
        </p>
      </div>

      <div
        role="group"
        aria-label={t("types.presetsLabel")}
        className="flex flex-wrap items-center gap-2"
      >
        <span className="text-caption font-semibold text-muted-foreground">
          {t("types.presetsLabel")}
        </span>
        {QUIZ_PRESETS.map((preset: QuizPreset) => {
          const active = matchesPreset(selectedTypes, preset, coverage);
          return (
            <Button
              key={preset}
              type="button"
              size="sm"
              variant={active ? "default" : "outline"}
              aria-pressed={active}
              className="min-h-11 rounded-full"
              onClick={() =>
                onTypesChange(getPresetQuestionTypes(preset, coverage))
              }
            >
              {t(`types.presets.${preset}`)}
            </Button>
          );
        })}
      </div>

      {renderGroup(
        "types.groups.recall",
        "types.groups.recallDescription",
        RECALL_QUESTION_TYPES,
      )}
      {renderGroup(
        "types.groups.location",
        "types.groups.locationDescription",
        LOCATION_QUESTION_TYPES,
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {t("types.selectedCount", {
            count: availableSelectedTypes.length,
            formattedCount: formatNumber(availableSelectedTypes.length),
          })}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="min-h-11" onClick={onBack}>
            {t("actions.back")}
          </Button>
          <Button
            className="min-h-11"
            disabled={availableSelectedTypes.length === 0}
            onClick={handleContinue}
          >
            {t("types.continue")}
          </Button>
        </div>
      </div>
    </div>
  );
}
