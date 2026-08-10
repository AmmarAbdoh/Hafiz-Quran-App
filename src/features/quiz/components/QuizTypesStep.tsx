import {
  BookOpen,
  Hash,
  Headphones,
  Layers,
  ListOrdered,
  PenLine,
  Sparkles,
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import {
  QUESTION_TYPE_DESCRIPTIONS,
  QUESTION_TYPE_LABELS,
} from "@/shared/constants/quran";
import {
  ALL_QUESTION_TYPES,
  getDefaultQuestionTypes,
  isQuestionTypeDisabled,
} from "@/features/quiz/lib/question-utils";
import { cn } from "@/shared/lib/utils";
import type { QuestionType, QuizScope } from "@/shared/types/quran";

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
  const toggleType = (type: QuestionType) => {
    if (isQuestionTypeDisabled(type, scope)) return;

    if (selectedTypes.includes(type)) {
      onTypesChange(selectedTypes.filter((item) => item !== type));
      return;
    }

    onTypesChange([...selectedTypes, type]);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">أنواع الأسئلة</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            اختر نوعاً واحداً أو أكثر. يمكنك تغيير الاختيار لاحقاً.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onTypesChange(getDefaultQuestionTypes(scope))}
        >
          تحديد الكل
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {ALL_QUESTION_TYPES.map((type) => {
          const Icon = TYPE_ICONS[type];
          const disabled = isQuestionTypeDisabled(type, scope);
          const checked = selectedTypes.includes(type);

          return (
            <label
              key={type}
              className={cn(
                "flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors",
                checked && "border-primary bg-primary/5",
                disabled && "cursor-not-allowed opacity-50",
                !disabled && !checked && "hover:bg-muted/40",
              )}
            >
              <Checkbox
                checked={checked}
                disabled={disabled}
                onCheckedChange={() => toggleType(type)}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 shrink-0 text-primary" />
                  <span className="font-semibold">
                    {QUESTION_TYPE_LABELS[type]}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {QUESTION_TYPE_DESCRIPTIONS[type]}
                </p>
              </div>
            </label>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={onBack}>
          رجوع
        </Button>
        <Button disabled={selectedTypes.length === 0} onClick={onNext}>
          متابعة ({selectedTypes.length})
        </Button>
      </div>
    </div>
  );
}
