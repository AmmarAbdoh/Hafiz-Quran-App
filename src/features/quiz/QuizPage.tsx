import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useQuranData } from "@/domain/quran";
import { PageContainer } from "@/shared/components/PageContainer";
import { Panel } from "@/shared/components/Panel";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";
import { useReaderPositionSnapshot } from "@/features/quran-reader";
import { ActiveQuiz } from "./components/ActiveQuiz";
import { QuizGoalPicker } from "./components/QuizGoalPicker";
import { QuizHistoryList } from "./components/QuizHistoryList";
import { QuizResults } from "./components/QuizResults";
import { QuizScopeStep } from "./components/QuizScopeStep";
import { QuizSessionStep } from "./components/QuizSessionStep";
import { QuizTypesStep } from "./components/QuizTypesStep";
import { useQuizEngine } from "./hooks/useQuizEngine";
import { useQuizFormatters } from "./hooks/useQuizFormatters";
import {
  buildReviewTodayConfig,
  buildSurahConfig,
  buildWeakVersesConfig,
  type QuizGoalId,
} from "./model/quizGoals";
import { collectWeakVerses } from "./model/quizSession";
import {
  getPresetQuestionTypes,
  keepSupportedQuestionTypes,
} from "./model/questionTypes";
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
  const savedPosition = useReaderPositionSnapshot();
  /*
   * Goals are where setup starts now. The wizard is still all here - it is
   * simply one of the goals rather than the only way in.
   */
  const [showManualSetup, setShowManualSetup] = useState(false);
  const [goalSurah, setGoalSurah] = useState(1);
  // False only while the scope step holds something it cannot commit.
  const [scopeValid, setScopeValid] = useState(true);
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
    /*
     * A new scope can invalidate chosen types, but this used to throw the
     * whole selection away - and it runs on every keystroke in a page or ayah
     * field, so typing "1", "12", "127" wiped a deliberate choice three times
     * over. Only the types the new scope cannot support are dropped; if that
     * leaves nothing, the preset takes over as before.
     */
    setQuestionTypes((chosen) =>
      keepSupportedQuestionTypes(
        chosen,
        describeScopeCoverage(
          buildVersePool(mushafData, nextScope),
          verseInfoRecords,
        ),
      ),
    );
  }

  /*
   * Opening the types step commits the preset it is about to show ticked.
   * questionTypes starts null - "not chosen yet" - while the step rendered
   * effectiveTypes, so the learner saw a choice presented as already made
   * while state said nothing had been chosen.
   */
  function openTypesStep(): void {
    setQuestionTypes((chosen) => chosen ?? effectiveTypes);
    setSetupStep("types");
  }

  function startQuiz(): void {
    engine.startQuiz(config);
  }

  const weakVerses = collectWeakVerses(history, Number.MAX_SAFE_INTEGER);

  function startGoal(goal: QuizGoalId): void {
    if (goal === "manual") {
      setShowManualSetup(true);
      setSetupStep("scope");
      return;
    }

    const goalConfig =
      goal === "today"
        ? buildReviewTodayConfig(savedPosition, mushafData, verseInfoRecords)
        : goal === "surah"
          ? buildSurahConfig(goalSurah, mushafData, verseInfoRecords)
          : buildWeakVersesConfig(weakVerses, mushafData, verseInfoRecords);

    if (goalConfig) engine.startQuiz(goalConfig);
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
    setShowManualSetup(false);
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
      <PageContainer
        as="section"
        aria-labelledby="active-quiz-title"
        className="space-y-4"
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
      </PageContainer>
    );
  }

  if (engine.phase === "results" && engine.sessionSummary) {
    return (
      <PageContainer
        as="section"
        aria-labelledby="quiz-results-title"
        className="space-y-6"
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
      </PageContainer>
    );
  }

  const currentStepIndex = SETUP_STEPS.indexOf(setupStep);
  return (
    <PageContainer
      as="section"
      aria-labelledby="quiz-setup-title"
      className="space-y-5"
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

      {!showManualSetup ? (
        <QuizGoalPicker
          position={savedPosition}
          weakVerseCount={weakVerses.length}
          surahNumber={goalSurah}
          onSurahNumberChange={setGoalSurah}
          onStart={startGoal}
        />
      ) : (
        <>
          <div>
            <Button variant="ghost" onClick={() => setShowManualSetup(false)}>
              {t("goals.back")}
            </Button>
          </div>

          <nav aria-label={t("steps.label")}>
            <ol className="grid grid-cols-3 gap-2">
              {SETUP_STEPS.map((step, index) => {
                const current = setupStep === step;
                const completed = currentStepIndex > index;
                return (
                  <li key={step} aria-current={current ? "step" : undefined}>
                    <button
                      type="button"
                      /* Continue is disabled while the scope is invalid, and
                         this was not - so the learner could leave the Page tab
                         empty, jump to Questions, and be quizzed on the surah
                         chosen before, which is not what they were looking at. */
                      disabled={!scopeValid && step !== "scope"}
                      onClick={() =>
                        step === "types" ? openTypesStep() : setSetupStep(step)
                      }
                      className={cn(
                        "flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border px-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                        current
                          ? "border-primary bg-primary/10 font-semibold text-primary"
                          : "border-border hover:bg-muted/40",
                        completed &&
                          !current &&
                          "border-primary/30 bg-primary/5",
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

          <Panel variant="flush" className="overflow-hidden">
            <SetupStepPanel step={setupStep}>
              {setupStep === "scope" && (
                <QuizScopeStep
                  mushafData={mushafData}
                  scope={scope}
                  ayahCount={pool.length}
                  onValidityChange={setScopeValid}
                  onScopeChange={changeScope}
                  onNext={openTypesStep}
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
                  onBack={openTypesStep}
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
        </>
      )}

      {engine.error && !showManualSetup && (
        <p
          className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
        >
          {t(`errors.${engine.error}`)}
        </p>
      )}

      <Panel>
        <h2 className="font-semibold">{t("history.title")}</h2>
        <div className="mt-4">
          <QuizHistoryList history={history} />
        </div>
      </Panel>
    </PageContainer>
  );
}
