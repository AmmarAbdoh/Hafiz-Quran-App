import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { cn } from "@/shared/lib/utils";
import { useQuizFormatters } from "../hooks/useQuizFormatters";
import type { QuestionType, QuizScope, QuizSessionMode } from "../model/types";

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
  const { t } = useTranslation("quiz");
  const { locale, formatNumber, formatQuestionType, formatScope } =
    useQuizFormatters();
  const questionTypeSummary = new Intl.ListFormat(locale, {
    style: "long",
    type: "conjunction",
  }).format(questionTypes.map(formatQuestionType));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">{t("session.title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("session.description")}
        </p>
      </div>

      <dl className="grid gap-4 rounded-xl border bg-muted/20 p-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-semibold">{t("session.scopeLabel")}</dt>
          <dd className="mt-1 text-muted-foreground">{formatScope(scope)}</dd>
        </div>
        <div>
          <dt className="font-semibold">{t("session.typesLabel")}</dt>
          <dd className="mt-1 text-muted-foreground">{questionTypeSummary}</dd>
        </div>
      </dl>

      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="sr-only">{t("session.title")}</legend>
        {(["fixed", "endless"] as const).map((mode) => {
          const selected = sessionMode === mode;
          return (
            <label
              key={mode}
              className={cn(
                "min-h-11 cursor-pointer rounded-xl border p-4 text-start transition-colors",
                "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                selected ? "border-primary bg-primary/5" : "hover:bg-muted/40",
              )}
            >
              <input
                className="sr-only"
                type="radio"
                name="quiz-session-mode"
                value={mode}
                aria-label={
                  mode === "fixed"
                    ? t("session.fixedTitle")
                    : t("session.endlessTitle")
                }
                checked={selected}
                onChange={() => onSessionModeChange(mode)}
              />
              <span className="block font-semibold">
                {mode === "fixed"
                  ? t("session.fixedTitle")
                  : t("session.endlessTitle")}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {mode === "fixed"
                  ? t("session.fixedDescription")
                  : t("session.endlessDescription")}
              </span>
            </label>
          );
        })}
      </fieldset>

      {sessionMode === "fixed" && (
        <div className="space-y-3">
          <Label htmlFor="quiz-question-count">
            {t("session.questionCount")}
          </Label>
          <div className="flex flex-wrap gap-2">
            {PRESET_COUNTS.map((count) => (
              <Button
                key={count}
                type="button"
                className="min-h-11 min-w-11"
                variant={questionCount === count ? "default" : "outline"}
                aria-pressed={questionCount === count}
                onClick={() => onQuestionCountChange(count)}
              >
                {formatNumber(count)}
              </Button>
            ))}
          </div>
          <Input
            id="quiz-question-count"
            type="number"
            min={1}
            max={100}
            value={questionCount}
            onChange={(event) => {
              const value = Number.parseInt(event.target.value, 10);
              if (value > 0) onQuestionCountChange(Math.min(value, 100));
            }}
          />
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Button variant="outline" className="min-h-11" onClick={onBack}>
          {t("actions.back")}
        </Button>
        <Button size="lg" onClick={onStart}>
          {t("session.start")}
        </Button>
      </div>
    </div>
  );
}
