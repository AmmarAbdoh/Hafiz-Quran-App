import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { QuizMushafPreview } from "@/features/quiz/components/QuizMushafPreview";
import {
  QUESTION_TYPE_LABELS,
} from "@/shared/constants/quran";
import type { QuizAnswerRecord, QuizSessionSummary } from "@/features/quiz/lib/quiz-types";
import { findMushafVerse } from "@/shared/services/quran-data";
import type {
  MushafVerse,
  MushafWordLayoutData,
  QuestionType,
} from "@/shared/types/quran";

interface QuizResultsProps {
  summary: QuizSessionSummary;
  answers: QuizAnswerRecord[];
  mushafData: MushafVerse[];
  wordLayout: MushafWordLayoutData;
  onRetry: () => void;
  onNewSetup: () => void;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function QuizResults({
  summary,
  answers,
  mushafData,
  wordLayout,
  onRetry,
  onNewSetup,
}: QuizResultsProps) {
  const [reviewKey, setReviewKey] = useState<string | null>(null);
  const percentage =
    summary.questionCount === 0
      ? 0
      : Math.round((summary.correctCount / summary.questionCount) * 100);

  const reviewVerse = reviewKey
    ? findMushafVerse(
        mushafData,
        Number.parseInt(reviewKey.split(":")[0] ?? "0", 10),
        Number.parseInt(reviewKey.split(":")[1] ?? "0", 10),
      )
    : undefined;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-gradient-to-b from-primary/10 to-background p-6 text-center">
        <h2 className="text-2xl font-bold">نتيجة الاختبار</h2>
        <p className="mt-2 text-4xl font-bold text-primary">{percentage}%</p>
        <p className="mt-1 text-muted-foreground">
          {summary.correctCount} من {summary.questionCount} إجابة صحيحة
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {summary.scopeSummary} · {formatDuration(summary.durationMs)}
        </p>
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold">الدقة حسب نوع السؤال</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(summary.accuracyByType).map(([type, stats]) => {
            const questionType = type as QuestionType;
            const typePercentage =
              stats.total === 0
                ? 0
                : Math.round((stats.correct / stats.total) * 100);
            return (
              <Badge key={type} variant="outline">
                {QUESTION_TYPE_LABELS[questionType]}: {stats.correct}/
                {stats.total} ({typePercentage}%)
              </Badge>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold">مراجعة الأسئلة</h3>
        <div className="space-y-2">
          {answers.map((answer, index) => (
            <button
              key={`${answer.questionId}-${index}`}
              type="button"
              className="flex w-full items-center justify-between rounded-xl border px-4 py-3 text-start hover:bg-muted/40"
              onClick={() => setReviewKey(answer.verseKey)}
            >
              <span>
                السؤال {index + 1} · {QUESTION_TYPE_LABELS[answer.questionType]}
              </span>
              <Badge variant={answer.isCorrect ? "success" : "destructive"}>
                {answer.isCorrect ? "صحيح" : "خطأ"}
              </Badge>
            </button>
          ))}
        </div>
      </div>

      {reviewVerse && (
        <QuizMushafPreview
          page={reviewVerse.page}
          mushafData={mushafData}
          wordLayout={wordLayout}
          highlightVerseKey={reviewKey}
        />
      )}

      <div className="flex flex-wrap gap-3">
        <Button onClick={onRetry}>إعادة بنفس الإعدادات</Button>
        <Button variant="outline" onClick={onNewSetup}>
          إعدادات جديدة
        </Button>
      </div>
    </div>
  );
}
