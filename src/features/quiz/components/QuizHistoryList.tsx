import { useTranslation } from "react-i18next";
import { Badge } from "@/shared/components/ui/badge";
import { useQuizFormatters } from "../hooks/useQuizFormatters";
import type { QuizSessionSummaryV2 } from "../model/types";

interface QuizHistoryListProps {
  history: QuizSessionSummaryV2[];
}

export function QuizHistoryList({ history }: QuizHistoryListProps) {
  const { t } = useTranslation("quiz");
  const { formatDate, formatNumber, formatScopeSnapshot } = useQuizFormatters();

  if (history.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{t("history.empty")}</p>
    );
  }

  return (
    <ol className="space-y-3">
      {history.slice(0, 5).map((session) => {
        const percentage =
          session.questionCount === 0
            ? 0
            : Math.round((session.correctCount / session.questionCount) * 100);
        return (
          <li
            key={session.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
          >
            <div>
              <p className="font-medium">
                {formatScopeSnapshot(session.scope, session.legacyScopeSummary)}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDate(session.completedAt)} ·{" "}
                {session.sessionMode === "endless"
                  ? t("history.endless")
                  : t("history.fixed")}
              </p>
            </div>
            <Badge variant={percentage >= 70 ? "success" : "secondary"}>
              {t("history.scoreLabel", {
                correct: formatNumber(session.correctCount),
                total: formatNumber(session.questionCount),
              })}{" "}
              ({t("results.percentage", { count: formatNumber(percentage) })})
            </Badge>
          </li>
        );
      })}
    </ol>
  );
}
