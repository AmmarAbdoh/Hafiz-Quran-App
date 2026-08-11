import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useQuranData } from "@/domain/quran";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";
import { ActiveQuiz } from "./components/ActiveQuiz";
import { QuizHistoryList } from "./components/QuizHistoryList";
import { QuizResults } from "./components/QuizResults";
import { QuizScopeStep } from "./components/QuizScopeStep";
import { QuizSessionStep } from "./components/QuizSessionStep";
import { QuizTypesStep } from "./components/QuizTypesStep";
import { useQuizEngine } from "./hooks/useQuizEngine";
import { useQuizFormatters } from "./hooks/useQuizFormatters";
import { getDefaultQuestionTypes } from "./model/questionTypes";
import type {
  QuestionType,
  QuizConfig,
  QuizScope,
  QuizSessionMode,
} from "./model/types";
import { loadQuizHistory } from "./services/quizHistoryStorage";
import "./quiz.css";

type SetupStep = "scope" | "types" | "session";
const SETUP_STEPS: readonly SetupStep[] = ["scope", "types", "session"];

export function QuizPage() {
  const { t } = useTranslation("quiz");
  const { formatNumber } = useQuizFormatters();
  const navigate = useNavigate();
  const {
    mushafData,
    verseInfoRecords,
    loading,
    error,
    errorRetryable,
    retryCoreData,
  } = useQuranData();
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
  const [history, setHistory] = useState(loadQuizHistory);
  const config: QuizConfig = {
    scope,
    questionTypes,
    sessionMode,
    questionCount: sessionMode === "fixed" ? questionCount : undefined,
  };

  function startQuiz(): void {
    engine.startQuiz(config);
  }

  function retryQuiz(): void {
    engine.resetQuiz();
    engine.startQuiz(config);
  }

  function openNewSetup(): void {
    engine.resetQuiz();
    setSetupStep("scope");
    setHistory(loadQuizHistory());
  }

  if (loading) {
    return (
      <div
        className="space-y-4"
        aria-busy="true"
        aria-label={t("active.loading")}
      >
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center"
        role="alert"
      >
        <p className="text-destructive">{error}</p>
        {errorRetryable && (
          <Button
            className="mt-4 min-h-11"
            variant="outline"
            onClick={retryCoreData}
          >
            {t("actions.retry")}
          </Button>
        )}
      </div>
    );
  }

  if (engine.phase === "active" || engine.phase === "feedback") {
    return (
      <section
        aria-labelledby="active-quiz-title"
        className="mx-auto w-full max-w-5xl space-y-5"
      >
        <h1 id="active-quiz-title" className="text-2xl font-bold">
          {t("active.title")}
        </h1>
        <ActiveQuiz
          engine={engine}
          mushafData={mushafData}
          verseInfoRecords={verseInfoRecords}
          onFinish={engine.finishQuiz}
          onExit={openNewSetup}
        />
      </section>
    );
  }

  if (engine.phase === "results" && engine.sessionSummary) {
    return (
      <section
        aria-labelledby="quiz-results-title"
        className="mx-auto w-full max-w-4xl space-y-5"
      >
        <h1 id="quiz-results-title" className="text-2xl font-bold">
          {t("title")}
        </h1>
        <QuizResults
          summary={engine.sessionSummary}
          answers={engine.answers}
          mushafData={mushafData}
          historySaveFailed={engine.historySaveFailed}
          onRetry={retryQuiz}
          onNewSetup={openNewSetup}
        />
      </section>
    );
  }

  const currentStepIndex = SETUP_STEPS.indexOf(setupStep);
  return (
    <section
      aria-labelledby="quiz-setup-title"
      className="mx-auto w-full max-w-4xl space-y-6"
    >
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            {t("steps.label")}
          </p>
          <h1 id="quiz-setup-title" className="mt-2 text-3xl font-bold">
            {t("title")}
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            {t("description")}
          </p>
        </div>
        <Button
          variant="outline"
          className="min-h-11"
          onClick={() => navigate("/")}
        >
          {t("actions.home")}
        </Button>
      </header>

      <nav aria-label={t("steps.label")}>
        <ol className="grid grid-cols-3 gap-2">
          {SETUP_STEPS.map((step, index) => {
            const current = setupStep === step;
            const completed = currentStepIndex > index;
            return (
              <li
                key={step}
                aria-current={current ? "step" : undefined}
                className={cn(
                  "rounded-xl border p-3 text-center text-sm",
                  current && "border-primary bg-primary/10 text-primary",
                  completed && "border-primary/30 bg-primary/5",
                )}
              >
                <span className="block text-xs text-muted-foreground">
                  {formatNumber(index + 1)}
                  <span className="sr-only">
                    {current
                      ? `, ${t("steps.current")}`
                      : completed
                        ? `, ${t("steps.completed")}`
                        : ""}
                  </span>
                </span>
                <span className="font-semibold">{t(`steps.${step}`)}</span>
              </li>
            );
          })}
        </ol>
      </nav>

      <Card className="overflow-hidden rounded-2xl">
        <CardContent className="p-6 sm:p-8">
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
            <QuizSessionStep
              scope={scope}
              questionTypes={questionTypes}
              sessionMode={sessionMode}
              questionCount={questionCount}
              onSessionModeChange={setSessionMode}
              onQuestionCountChange={setQuestionCount}
              onBack={() => setSetupStep("types")}
              onStart={startQuiz}
            />
          )}
          {engine.error && (
            <p
              className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
              role="alert"
            >
              {t(`errors.${engine.error}`)}
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardContent className="space-y-3 p-6">
          <h2 className="text-lg font-semibold">{t("history.title")}</h2>
          <QuizHistoryList history={history} />
        </CardContent>
      </Card>
    </section>
  );
}
