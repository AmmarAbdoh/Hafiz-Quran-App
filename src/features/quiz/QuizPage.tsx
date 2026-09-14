import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useQuranData } from "@/domain/quran";
import { Panel } from "@/shared/components/Panel";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";
import { ActiveQuiz } from "./components/ActiveQuiz";
import { QuizHelpPanel } from "./components/QuizHelpPanel";
import { QuizHistoryList } from "./components/QuizHistoryList";
import { QuizResults } from "./components/QuizResults";
import { QuizScopeStep } from "./components/QuizScopeStep";
import { QuizSessionStep } from "./components/QuizSessionStep";
import { QuizSetupSummary } from "./components/QuizSetupSummary";
import { QuizTypesStep } from "./components/QuizTypesStep";
import { useQuizEngine } from "./hooks/useQuizEngine";
import { useQuizFormatters } from "./hooks/useQuizFormatters";
import { getPresetQuestionTypes } from "./model/questionTypes";
import { describeScopeCoverage } from "./model/scopeCoverage";
import { SETUP_STEPS, type SetupStep } from "./model/setupSteps";
import type {
  QuestionType,
  QuizConfig,
  QuizScope,
  QuizSessionMode,
} from "./model/types";
import { buildVersePool } from "./model/versePool";
import { loadQuizHistory } from "./services/quizHistoryStorage";
import "./quiz.css";

const DEFAULT_SCOPE: QuizScope = { mode: "surah", surahIndices: [1] };

/**
 * Steps swap in place, so the button that advanced the wizard disappears and
 * focus would fall back to the document. Focus follows the learner to the new
 * step's heading instead.
 */
function SetupStepPanel({
  step,
  children,
}: {
  step: SetupStep;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const stepOnMount = useRef(step);

  useEffect(() => {
    if (step === stepOnMount.current) return;
    panelRef.current?.querySelector<HTMLElement>("h2")?.focus();
  }, [step]);

  return (
    <div ref={panelRef} className="space-y-6 p-[var(--space-panel)]">
      {children}
    </div>
  );
}

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
  const [scope, setScope] = useState<QuizScope>(DEFAULT_SCOPE);
  // Null means "not chosen yet", which is not the same as choosing nothing.
  const [questionTypes, setQuestionTypes] = useState<QuestionType[] | null>(
    null,
  );
  const [sessionMode, setSessionMode] = useState<QuizSessionMode>("fixed");
  const [questionCount, setQuestionCount] = useState(10);
  const [history, setHistory] = useState(loadQuizHistory);

  // What the scope really contains drives which questions can be asked at all.
  const pool = buildVersePool(mushafData, scope);
  const coverage = describeScopeCoverage(pool, verseInfoRecords);
  const effectiveTypes =
    questionTypes ?? getPresetQuestionTypes("standard", coverage);
  const config: QuizConfig = {
    scope,
    questionTypes: effectiveTypes,
    sessionMode,
    questionCount: sessionMode === "fixed" ? questionCount : undefined,
  };

  function changeScope(nextScope: QuizScope): void {
    setScope(nextScope);
    // A new scope can invalidate chosen types, so the selection resets to what
    // this scope supports rather than silently dropping questions later.
    setQuestionTypes(null);
  }

  function startQuiz(): void {
    engine.startQuiz(config);
  }

  function retryQuiz(): void {
    engine.resetQuiz();
    engine.startQuiz(config);
  }

  function reviewMistakes(verseKeys: string[]): void {
    engine.resetQuiz();
    engine.startQuiz({
      ...config,
      sessionMode: "fixed",
      questionCount: Math.max(verseKeys.length, 1),
      focusVerseKeys: verseKeys,
    });
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
      <Panel
        className="border-destructive/30 bg-destructive/5 text-center"
        role="alert"
      >
        <p className="text-destructive">{error}</p>
        {errorRetryable && (
          <Button className="mt-4" variant="outline" onClick={retryCoreData}>
            {t("actions.retry")}
          </Button>
        )}
      </Panel>
    );
  }

  if (engine.phase === "active" || engine.phase === "feedback") {
    return (
      <section
        aria-labelledby="active-quiz-title"
        className="mx-auto w-full max-w-5xl space-y-4"
      >
        <h1 id="active-quiz-title" className="sr-only">
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
        className="mx-auto w-full max-w-4xl space-y-6"
      >
        <h1 id="quiz-results-title">{t("title")}</h1>
        <QuizResults
          summary={engine.sessionSummary}
          answers={engine.answers}
          mushafData={mushafData}
          historySaveFailed={engine.historySaveFailed}
          onRetry={retryQuiz}
          onReviewMistakes={reviewMistakes}
          onNewSetup={openNewSetup}
        />
      </section>
    );
  }

  const currentStepIndex = SETUP_STEPS.indexOf(setupStep);
  return (
    <section
      aria-labelledby="quiz-setup-title"
      className="mx-auto w-full max-w-4xl space-y-5"
    >
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="editorial-kicker">{t("steps.label")}</p>
          <h1 id="quiz-setup-title" className="mt-2">
            {t("title")}
          </h1>
          <p className="mt-3 max-w-2xl text-body text-muted-foreground">
            {t("description")}
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate("/")}>
          {t("actions.home")}
        </Button>
      </header>

      <QuizHelpPanel />

      <nav aria-label={t("steps.label")}>
        <ol className="grid grid-cols-3 gap-2">
          {SETUP_STEPS.map((step, index) => {
            const current = setupStep === step;
            const completed = currentStepIndex > index;
            return (
              <li key={step} aria-current={current ? "step" : undefined}>
                <button
                  type="button"
                  onClick={() => setSetupStep(step)}
                  className={cn(
                    "flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border px-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    current
                      ? "border-primary bg-primary/10 font-semibold text-primary"
                      : "border-border hover:bg-muted/40",
                    completed && !current && "border-primary/30 bg-primary/5",
                  )}
                >
                  <span className="text-label text-muted-foreground">
                    {formatNumber(index + 1)}
                  </span>
                  <span className="truncate">{t(`steps.${step}`)}</span>
                  <span className="sr-only">
                    {current
                      ? `, ${t("steps.current")}`
                      : completed
                        ? `, ${t("steps.completed")}`
                        : ""}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <QuizSetupSummary
        scope={scope}
        ayahCount={pool.length}
        questionTypes={effectiveTypes}
        sessionMode={sessionMode}
        questionCount={questionCount}
        onEditStep={setSetupStep}
      />

      <Panel variant="flush" className="overflow-hidden">
        <SetupStepPanel step={setupStep}>
          {setupStep === "scope" && (
            <QuizScopeStep
              mushafData={mushafData}
              scope={scope}
              ayahCount={pool.length}
              onScopeChange={changeScope}
              onNext={() => setSetupStep("types")}
            />
          )}
          {setupStep === "types" && (
            <QuizTypesStep
              coverage={coverage}
              selectedTypes={effectiveTypes}
              onTypesChange={setQuestionTypes}
              onBack={() => setSetupStep("scope")}
              onNext={() => setSetupStep("session")}
            />
          )}
          {setupStep === "session" && (
            <QuizSessionStep
              scope={scope}
              ayahCount={pool.length}
              questionTypes={effectiveTypes}
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
              className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive"
              role="alert"
            >
              {t(`errors.${engine.error}`)}
            </p>
          )}
        </SetupStepPanel>
      </Panel>

      <Panel>
        <h2 className="font-semibold">{t("history.title")}</h2>
        <div className="mt-4">
          <QuizHistoryList history={history} />
        </div>
      </Panel>
    </section>
  );
}
