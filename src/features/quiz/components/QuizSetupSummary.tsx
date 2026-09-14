import {
  BookMarked,
  Infinity as InfinityIcon,
  Layers,
  ListChecks,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQuizFormatters } from "../hooks/useQuizFormatters";
import type { QuestionType, QuizScope, QuizSessionMode } from "../model/types";
import type { SetupStep } from "../model/setupSteps";

interface QuizSetupSummaryProps {
  scope: QuizScope;
  ayahCount: number;
  questionTypes: QuestionType[];
  sessionMode: QuizSessionMode;
  questionCount: number;
  onEditStep: (step: SetupStep) => void;
}

/**
 * The chosen scope, question types and length stay visible on every step, so a
 * selection made two screens ago never becomes invisible state.
 */
export function QuizSetupSummary({
  scope,
  ayahCount,
  questionTypes,
  sessionMode,
  questionCount,
  onEditStep,
}: QuizSetupSummaryProps) {
  const { t } = useTranslation("quiz");
  const { formatNumber, formatScope } = useQuizFormatters();

  const items: Array<{
    step: SetupStep;
    icon: typeof BookMarked;
    label: string;
    value: string;
    hint?: string;
  }> = [
    {
      step: "scope",
      icon: BookMarked,
      label: t("steps.scope"),
      value: formatScope(scope),
      hint: t("summary.ayahs", {
        count: ayahCount,
        formattedCount: formatNumber(ayahCount),
      }),
    },
    {
      step: "types",
      icon: ListChecks,
      label: t("steps.types"),
      value: t("summary.types", {
        count: questionTypes.length,
        formattedCount: formatNumber(questionTypes.length),
      }),
    },
    {
      step: "session",
      icon: sessionMode === "endless" ? InfinityIcon : Layers,
      label: t("steps.session"),
      value:
        sessionMode === "endless"
          ? t("session.endlessTitle")
          : t("summary.questions", {
              count: questionCount,
              formattedCount: formatNumber(questionCount),
            }),
    },
  ];

  return (
    <ul className="grid gap-2 sm:grid-cols-3" aria-label={t("summary.label")}>
      {items.map(({ step, icon: Icon, label, value, hint }) => (
        <li key={step}>
          <button
            type="button"
            onClick={() => onEditStep(step)}
            className="flex min-h-11 w-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 text-start transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-caption text-muted-foreground">
                {label}
              </span>
              <span className="block truncate text-sm font-semibold">
                {value}
              </span>
            </span>
            {hint && (
              <span className="shrink-0 text-caption text-muted-foreground">
                {hint}
              </span>
            )}
            <span className="sr-only">{t("summary.edit")}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
