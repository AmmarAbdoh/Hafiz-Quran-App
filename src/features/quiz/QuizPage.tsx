import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ActiveQuiz } from "@/features/quiz/components/ActiveQuiz";
import { QuizHistoryList } from "@/features/quiz/components/QuizHistoryList";
import { QuizResults } from "@/features/quiz/components/QuizResults";
import { QuizScopeStep } from "@/features/quiz/components/QuizScopeStep";
import { QuizSessionStep } from "@/features/quiz/components/QuizSessionStep";
import { QuizTypesStep } from "@/features/quiz/components/QuizTypesStep";
import { useQuizEngine } from "@/features/quiz/hooks/useQuizEngine";
import { loadQuizHistory } from "@/features/quiz/lib/quizStorage";
import { getDefaultQuestionTypes } from "@/features/quiz/lib/question-utils";
import { useQuranData } from "@/features/quran-reader/context/QuranDataContext";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import type {
  QuestionType,
  QuizConfig,
  QuizScope,
  QuizSessionMode,
} from "@/shared/types/quran";
import { cn } from "@/shared/lib/utils";

type SetupStep = "scope" | "types" | "session";

const SETUP_STEPS: SetupStep[] = ["scope", "types", "session"];

export function QuizPage() {
  const navigate = useNavigate();
  const { mushafData, wordLayout, verseInfoRecords, loading, error } =
    useQuranData();
  const engine = useQuizEngine(mushafData, verseInfoRecords);

  const [setupStep, setSetupStep] = useState<SetupStep>("scope");
  const [scope, setScope] = useState<QuizScope>({
    mode: "surah",
    surahIndices: [1],
  });
  const [questionTypes, setQuestionTypes] = useState<QuestionType[]>(() =>
    getDefaultQuestionTypes(scope),
  );
  const [sessionMode, setSessionMode] = useState<QuizSessionMode>("fixed");
  const [questionCount, setQuestionCount] = useState(10);
  const [history, setHistory] = useState(() => loadQuizHistory());
  const [startError, setStartError] = useState<string | null>(null);

  const config = useMemo<QuizConfig>(
    () => ({
      scope,
      questionTypes,
      sessionMode,
      questionCount: sessionMode === "fixed" ? questionCount : undefined,
    }),
    [scope, questionTypes, sessionMode, questionCount],
  );

  const handleStart = () => {
    setStartError(null);
    const started = engine.startQuiz(config);
    if (!started) {
      setStartError(engine.error ?? "تعذر بدء الاختبار.");
    }
  };

  const handleRetry = () => {
    setStartError(null);
    engine.resetQuiz();
    engine.startQuiz(config);
  };

  const handleNewSetup = () => {
    engine.resetQuiz();
    setSetupStep("scope");
    setHistory(loadQuizHistory());
  };

  if (loading || !wordLayout) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 p-6 text-center text-destructive">
        {error}
      </div>
    );
  }

  if (engine.phase === "active") {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">الاختبار</h1>
        <ActiveQuiz
          engine={engine}
          mushafData={mushafData}
          wordLayout={wordLayout}
          verseInfoRecords={verseInfoRecords}
          onFinish={engine.finishQuiz}
          onExit={handleNewSetup}
        />
      </div>
    );
  }

  if (engine.phase === "results" && engine.sessionSummary) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">اختبار مخصص</h1>
        <QuizResults
          summary={engine.sessionSummary}
          answers={engine.answers}
          mushafData={mushafData}
          wordLayout={wordLayout}
          onRetry={handleRetry}
          onNewSetup={handleNewSetup}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">اختبار مخصص</h1>
          <p className="text-sm text-muted-foreground">
            اختبر حفظك بأسئلة تفاعلية من المصحف.
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate("/")}>
          العودة للرئيسية
        </Button>
      </div>

      <div className="flex items-center gap-2">
        {SETUP_STEPS.map((step, index) => (
          <div key={step} className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold",
                setupStep === step
                  ? "bg-primary text-primary-foreground"
                  : SETUP_STEPS.indexOf(setupStep) > index
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {index + 1}
            </div>
            {index < SETUP_STEPS.length - 1 && (
              <div className="hidden h-px w-8 bg-border sm:block" />
            )}
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6">
          {setupStep === "scope" && (
            <QuizScopeStep
              mushafData={mushafData}
              scope={scope}
              onScopeChange={(nextScope) => {
                setScope(nextScope);
                setQuestionTypes(getDefaultQuestionTypes(nextScope));
              }}
              onNext={() => setSetupStep("types")}
            />
          )}

          {setupStep === "types" && (
            <QuizTypesStep
              scope={scope}
              selectedTypes={questionTypes}
              onTypesChange={setQuestionTypes}
              onBack={() => setSetupStep("scope")}
              onNext={() => setSetupStep("session")}
            />
          )}

          {setupStep === "session" && (
            <>
              <QuizSessionStep
                scope={scope}
                questionTypes={questionTypes}
                sessionMode={sessionMode}
                questionCount={questionCount}
                onSessionModeChange={setSessionMode}
                onQuestionCountChange={setQuestionCount}
                onBack={() => setSetupStep("types")}
                onStart={handleStart}
              />
              {startError && (
                <p className="mt-4 text-sm text-destructive">{startError}</p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 pt-6">
          <h2 className="text-lg font-semibold">الجلسات السابقة</h2>
          <QuizHistoryList history={history} />
        </CardContent>
      </Card>
    </div>
  );
}
