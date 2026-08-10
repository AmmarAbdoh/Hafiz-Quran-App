import { Loader2 } from "lucide-react";
import { AudioQuestion } from "@/features/quiz/components/AudioQuestion";
import { CompleteAyahQuestion } from "@/features/quiz/components/CompleteAyahQuestion";
import { FillBlankQuestion } from "@/features/quiz/components/FillBlankQuestion";
import { InfoQuestion } from "@/features/quiz/components/InfoQuestion";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import type { useQuizEngine } from "@/features/quiz/hooks/useQuizEngine";
import {
  QUESTION_TYPE_LABELS,
} from "@/shared/constants/quran";
import type {
  MushafVerse,
  MushafWordLayoutData,
  VerseInfoRecord,
} from "@/shared/types/quran";

type QuizEngine = ReturnType<typeof useQuizEngine>;

interface ActiveQuizProps {
  engine: QuizEngine;
  mushafData: MushafVerse[];
  wordLayout: MushafWordLayoutData;
  verseInfoRecords: VerseInfoRecord[];
  onFinish: () => void;
  onExit: () => void;
}

export function ActiveQuiz({
  engine,
  mushafData,
  wordLayout,
  verseInfoRecords,
  onFinish,
  onExit,
}: ActiveQuizProps) {
  const {
    currentQuestion,
    loadingQuestion,
    error,
    answered,
    lastIsCorrect,
    lastSelectedChoiceId,
    streak,
    progress,
    score,
    submitAnswer,
    goToNextQuestion,
  } = engine;

  const sharedProps = {
    mushafData,
    wordLayout,
    verseInfoRecords,
    answered,
    isCorrect: lastIsCorrect,
    selectedChoiceId: lastSelectedChoiceId,
    streak,
    onSubmit: submitAnswer,
    onNext: goToNextQuestion,
  };

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-10 rounded-xl border bg-background/95 p-4 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold">{progress.label}</p>
            <p className="text-xs text-muted-foreground">
              النتيجة: {score.correct}/{score.total}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {streak > 0 && (
              <Badge variant="secondary">سلسلة {streak}</Badge>
            )}
            {currentQuestion && (
              <Badge variant="outline">
                {QUESTION_TYPE_LABELS[currentQuestion.type]}
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={onFinish}>
              إنهاء الاختبار
            </Button>
            <Button variant="ghost" size="sm" onClick={onExit}>
              خروج
            </Button>
          </div>
        </div>
        {progress.total > 0 && (
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{
                width: `${Math.min(100, (answersProgress(engine) / progress.total) * 100)}%`,
              }}
            />
          </div>
        )}
      </div>

      {loadingQuestion && (
        <div className="space-y-4 py-8">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>جاري تحضير السؤال...</span>
          </div>
          <Skeleton className="mx-auto h-64 max-w-xl rounded-xl" />
        </div>
      )}

      {error && !loadingQuestion && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-center">
          <p className="text-destructive">{error}</p>
          <Button className="mt-3" variant="outline" onClick={onExit}>
            العودة للإعدادات
          </Button>
        </div>
      )}

      {!loadingQuestion && currentQuestion && !error && (
        <>
          {currentQuestion.type === "fill_blank" && (
            <FillBlankQuestion
              question={currentQuestion}
              {...sharedProps}
            />
          )}
          {currentQuestion.type === "complete_ayah" && (
            <CompleteAyahQuestion
              question={currentQuestion}
              {...sharedProps}
            />
          )}
          {currentQuestion.type === "audio_identify" && (
            <AudioQuestion question={currentQuestion} {...sharedProps} />
          )}
          {(currentQuestion.type === "surah_name" ||
            currentQuestion.type === "ayah_number" ||
            currentQuestion.type === "juz_number" ||
            currentQuestion.type === "hizb_number" ||
            currentQuestion.type === "page_number") && (
            <InfoQuestion question={currentQuestion} {...sharedProps} />
          )}
        </>
      )}
    </div>
  );
}

function answersProgress(engine: QuizEngine): number {
  return engine.answered ? engine.answers.length : engine.answers.length + 1;
}
