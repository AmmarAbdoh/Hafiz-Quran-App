import { Badge } from "@/shared/components/ui/badge";
import type { QuizSessionSummary } from "@/features/quiz/lib/quiz-types";

interface QuizHistoryListProps {
  history: QuizSessionSummary[];
}

function formatSessionDate(iso: string): string {
  return new Intl.DateTimeFormat("ar-SA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

interface QuizHistoryListProps {
  history: QuizSessionSummary[];
}

export function QuizHistoryList({ history }: QuizHistoryListProps) {
  if (history.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        لا توجد جلسات سابقة بعد.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {history.slice(0, 5).map((session) => {
        const percentage =
          session.questionCount === 0
            ? 0
            : Math.round(
                (session.correctCount / session.questionCount) * 100,
              );

        return (
          <div
            key={session.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
          >
            <div>
              <p className="font-medium">{session.scopeSummary}</p>
              <p className="text-xs text-muted-foreground">
                {formatSessionDate(session.completedAt)}
                {" · "}
                {session.sessionMode === "endless" ? "بدون حد" : "عدد محدد"}
              </p>
            </div>
            <Badge variant={percentage >= 70 ? "success" : "secondary"}>
              {session.correctCount}/{session.questionCount} ({percentage}%)
            </Badge>
          </div>
        );
      })}
    </div>
  );
}
