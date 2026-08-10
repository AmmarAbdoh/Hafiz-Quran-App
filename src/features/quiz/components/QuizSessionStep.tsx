import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { summarizeQuizScope } from "@/features/quiz/lib/versePool";
import {
  QUESTION_TYPE_LABELS,
} from "@/shared/constants/quran";
import type { QuestionType, QuizScope, QuizSessionMode } from "@/shared/types/quran";

interface QuizSessionStepProps {
  scope: QuizScope;
  questionTypes: QuestionType[];
  sessionMode: QuizSessionMode;
  questionCount: number;
  onSessionModeChange: (mode: QuizSessionMode) => void;
  onQuestionCountChange: (count: number) => void;
  onBack: () => void;
  onStart: () => void;
}

const PRESET_COUNTS = [10, 20, 30];

export function QuizSessionStep({
  scope,
  questionTypes,
  sessionMode,
  questionCount,
  onSessionModeChange,
  onQuestionCountChange,
  onBack,
  onStart,
}: QuizSessionStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">إعداد الجلسة</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          اختر عدد الأسئلة أو استمر بدون حد.
        </p>
      </div>

      <div className="rounded-xl border bg-muted/20 p-4 text-sm">
        <p>
          <span className="font-semibold">النطاق:</span>{" "}
          {summarizeQuizScope(scope)}
        </p>
        <p className="mt-2">
          <span className="font-semibold">الأنواع:</span>{" "}
          {questionTypes.map((type) => QUESTION_TYPE_LABELS[type]).join("، ")}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          className={`rounded-xl border p-4 text-start transition-colors ${
            sessionMode === "fixed"
              ? "border-primary bg-primary/5"
              : "hover:bg-muted/40"
          }`}
          onClick={() => onSessionModeChange("fixed")}
        >
          <p className="font-semibold">عدد محدد</p>
          <p className="mt-1 text-xs text-muted-foreground">
            اختبار بـ 10 أو 20 أو 30 سؤالاً أو عدد مخصص.
          </p>
        </button>
        <button
          type="button"
          className={`rounded-xl border p-4 text-start transition-colors ${
            sessionMode === "endless"
              ? "border-primary bg-primary/5"
              : "hover:bg-muted/40"
          }`}
          onClick={() => onSessionModeChange("endless")}
        >
          <p className="font-semibold">بدون حد</p>
          <p className="mt-1 text-xs text-muted-foreground">
            استمر حتى تنهي الاختبار بنفسك.
          </p>
        </button>
      </div>

      {sessionMode === "fixed" && (
        <div className="space-y-3">
          <Label>عدد الأسئلة</Label>
          <div className="flex flex-wrap gap-2">
            {PRESET_COUNTS.map((count) => (
              <Button
                key={count}
                type="button"
                variant={questionCount === count ? "default" : "outline"}
                onClick={() => onQuestionCountChange(count)}
              >
                {count}
              </Button>
            ))}
          </div>
          <Input
            inputMode="numeric"
            value={String(questionCount)}
            onChange={(event) => {
              const value = Number.parseInt(event.target.value, 10);
              if (Number.isFinite(value) && value > 0) {
                onQuestionCountChange(value);
              }
            }}
          />
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={onBack}>
          رجوع
        </Button>
        <Button size="lg" onClick={onStart}>
          ابدأ الاختبار
        </Button>
      </div>
    </div>
  );
}
