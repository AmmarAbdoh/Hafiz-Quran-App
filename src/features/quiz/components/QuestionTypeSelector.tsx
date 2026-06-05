import { Checkbox } from "@/shared/components/ui/checkbox";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { QUESTION_TYPE_LABELS } from "@/shared/constants/quran";
import {
  isJuzNameDisabled,
  isSurahNameDisabled,
} from "@/features/quiz/lib/question-utils";
import type { QuestionType, QuizSelection } from "@/shared/types/quran";

const ALL_TYPES: QuestionType[] = [
  "fill_blank",
  "surah_name",
  "ayah_number",
  "juz_number",
  "hizb_number",
  "page_number",
];

interface QuestionTypeSelectorProps {
  selection: QuizSelection;
  selectedTypes: QuestionType[];
  onTypesChange: (types: QuestionType[]) => void;
  onStart: () => void;
  onBack: () => void;
}

export function QuestionTypeSelector({
  selection,
  selectedTypes,
  onTypesChange,
  onStart,
  onBack,
}: QuestionTypeSelectorProps) {
  const toggle = (type: QuestionType) => {
    onTypesChange(
      selectedTypes.includes(type)
        ? selectedTypes.filter((t) => t !== type)
        : [...selectedTypes, type],
    );
  };

  const isDisabled = (type: QuestionType): boolean => {
    if (type === "surah_name")
      return isSurahNameDisabled(selection.mode, selection.indices);
    if (type === "juz_number")
      return isJuzNameDisabled(selection.mode, selection.indices);
    return false;
  };

  return (
    <div className="mx-auto max-w-md space-y-6 text-center">
      <h3 className="text-xl font-semibold">الرجاء اختيار نوع الأسئلة</h3>

      <div className="space-y-3 text-start">
        {ALL_TYPES.map((type) => (
          <label
            key={type}
            className="flex items-center gap-3 rounded-lg border p-3"
          >
            <Checkbox
              checked={selectedTypes.includes(type)}
              disabled={isDisabled(type)}
              onCheckedChange={() => toggle(type)}
            />
            <Label className="cursor-pointer">{QUESTION_TYPE_LABELS[type]}</Label>
          </label>
        ))}
      </div>

      <div className="flex justify-center gap-3">
        <Button variant="outline" onClick={onBack}>
          عودة
        </Button>
        <Button disabled={selectedTypes.length === 0} onClick={onStart}>
          بدء الاختبار
        </Button>
      </div>
    </div>
  );
}
