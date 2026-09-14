import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { cn } from "@/shared/lib/utils";
import { useQuizFormatters } from "../hooks/useQuizFormatters";
import type { QuestionType, QuizScope, QuizSessionMode } from "../model/types";

interface QuizSessionStepProps {
  scope: QuizScope;
  ayahCount: number;
  questionTypes: QuestionType[];
  sessionMode: QuizSessionMode;
  questionCount: number;
  onSessionModeChange: (mode: QuizSessionMode) => void;
  onQuestionCountChange: (count: number) => void;
  onBack: () => void;
  onStart: () => void;
}

const PRESET_COUNTS = [10, 20, 30];
const MAX_QUESTIONS = 100;

export function QuizSessionStep({
  scope,
  ayahCount,
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
  // Asking more questions than the scope has ayahs is allowed, but the learner
  // should know verses will come round again.
  const repeats =
    sessionMode === "fixed" && ayahCount > 0 && questionCount > ayahCount;

  return (
    <div className="space-y-5">
      <div>
        <h2 tabIndex={-1} className="text-xl font-semibold outline-none">
          {t("session.title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("session.description")}
        </p>
      </div>

      <dl className="grid gap-3 rounded-xl border border-border bg-muted/20 p-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-caption font-semibold text-muted-foreground">
            {t("session.scopeLabel")}
          </dt>
          <dd className="mt-0.5">{formatScope(scope)}</dd>
        </div>
        <div>
          <dt className="text-caption font-semibold text-muted-foreground">
            {t("summary.label")}
          </dt>
          <dd className="mt-0.5">
            {t("summary.ayahs", {
              count: ayahCount,
              formattedCount: formatNumber(ayahCount),
            })}
          </dd>
        </div>
        <div>
          <dt className="text-caption font-semibold text-muted-foreground">
            {t("session.typesLabel")}
          </dt>
          <dd className="mt-0.5">{questionTypeSummary}</dd>
        </div>
      </dl>

      <fieldset className="grid gap-2 sm:grid-cols-2">
        <legend className="sr-only">{t("session.title")}</legend>
        {(["fixed", "endless"] as const).map((mode) => {
          const selected = sessionMode === mode;
          return (
            <label
              key={mode}
              className={cn(
                "min-h-11 cursor-pointer rounded-xl border p-3 text-start transition-colors",
                "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                selected
                  ? "border-primary bg-primary/5"
                  : "hover:border-primary/40 hover:bg-muted/40",
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
        <div className="space-y-2">
          <Label htmlFor="quiz-question-count">
            {t("session.questionCount")}
          </Label>
          <div className="flex flex-wrap items-center gap-2">
            {PRESET_COUNTS.map((count) => (
              <Button
                key={count}
                type="button"
                className="min-h-11 min-w-11 rounded-full"
                variant={questionCount === count ? "default" : "outline"}
                aria-pressed={questionCount === count}
                onClick={() => onQuestionCountChange(count)}
              >
                {formatNumber(count)}
              </Button>
            ))}
            <Input
              id="quiz-question-count"
              className="min-h-11 w-24"
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_QUESTIONS}
              value={questionCount}
              onChange={(event) => {
                const value = Number.parseInt(event.target.value, 10);
                if (value > 0) {
                  onQuestionCountChange(Math.min(value, MAX_QUESTIONS));
                }
              }}
            />
          </div>
          {repeats && (
            <p
              className="flex items-start gap-2 rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground"
              role="status"
            >
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              {t("session.repeatNotice", {
                count: ayahCount,
                formattedCount: formatNumber(ayahCount),
                questions: formatNumber(questionCount),
              })}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <Button variant="outline" className="min-h-11" onClick={onBack}>
          {t("actions.back")}
        </Button>
        <Button size="lg" className="min-h-11" onClick={onStart}>
          {t("session.start")}
        </Button>
      </div>
    </div>
  );
}
