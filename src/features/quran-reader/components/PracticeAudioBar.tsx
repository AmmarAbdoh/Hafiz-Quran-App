import type { ReactNode } from "react";
import {
  Activity,
  Bell,
  BellOff,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Mic,
  SkipForward,
  Square,
  TriangleAlert,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatNumber, useLocale } from "@/app/i18n";
import {
  useRecitationPractice,
  useRecitationPracticeTelemetry,
} from "@/features/recitation-practice";
import { Button } from "@/shared/components/ui/button";
import { PracticeDebugPanel } from "./PracticeDebugPanel";
import { cn } from "@/shared/lib/utils";

const MIC_LEVEL_BARS = [0.12, 0.28, 0.48, 0.72, 1] as const;

type PracticeState = ReturnType<typeof useRecitationPractice>;

type PracticeStatusState = Pick<
  PracticeState,
  | "phase"
  | "listening"
  | "loadingModel"
  | "completed"
  | "wrongFlashLocation"
  | "heldAtLocation"
  | "isAnalyzing"
  | "hideAyat"
>;

function getStatusKey(
  practice: PracticeStatusState,
  isSpeaking: boolean,
):
  | "practice.preparing"
  | "practice.loadingModel"
  | "practice.completed"
  | "practice.held"
  | "practice.mismatch"
  | "practice.listening"
  | "practice.analyzing"
  | "practice.memoryHidden"
  | "practice.memoryVisible"
  | null {
  switch (practice.phase) {
    case "preparing":
      return "practice.preparing";
    case "loading-model":
      return "practice.loadingModel";
    case "completed":
      return "practice.completed";
    case "listening":
      /* Stopped at a word outranks everything else the line could say: it is
         the only one of these the reader has to do something about. */
      if (practice.heldAtLocation) {
        return "practice.held";
      }
      if (practice.wrongFlashLocation) {
        return "practice.mismatch";
      }
      if (isSpeaking) {
        return "practice.listening";
      }
      if (practice.isAnalyzing) {
        return "practice.analyzing";
      }
      return practice.hideAyat
        ? "practice.memoryHidden"
        : "practice.memoryVisible";
    default:
      return null;
  }
}

function MicLevelIndicator({ level }: { level: number }) {
  return (
    <div className="flex h-5 items-end gap-0.5" aria-hidden>
      {MIC_LEVEL_BARS.map((threshold, index) => {
        const active = level >= threshold;
        const height = 6 + index * 3;
        return (
          <span
            key={threshold}
            className={cn(
              "w-1 rounded-full transition-all duration-75",
              active ? "bg-primary" : "bg-muted-foreground/25",
            )}
            style={{ height: active ? `${height}px` : "4px" }}
          />
        );
      })}
    </div>
  );
}

function PracticeTelemetryStatus({
  practice,
}: {
  practice: PracticeStatusState;
}) {
  const { t } = useTranslation("reader");
  const { isSpeaking, micLevel } = useRecitationPracticeTelemetry();
  const showMicLevel =
    !practice.loadingModel && !practice.completed && practice.listening;
  const statusKey = getStatusKey(practice, isSpeaking);

  return (
    <>
      {practice.loadingModel ? (
        <Loader2
          className="h-4 w-4 shrink-0 animate-spin text-primary"
          aria-hidden
        />
      ) : practice.completed ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-hidden />
      ) : (
        <div className="relative flex shrink-0 items-center gap-1.5">
          {showMicLevel && (
            <span
              className="absolute -inset-1 rounded-full bg-primary/20 transition-transform duration-75"
              style={{
                transform: `scale(${1 + micLevel * 0.55})`,
                opacity: 0.25 + micLevel * 0.55,
              }}
            />
          )}
          <Mic
            className={cn(
              "relative h-4 w-4 shrink-0",
              isSpeaking || micLevel > 0.15
                ? "text-primary"
                : "text-muted-foreground",
            )}
            aria-hidden
          />
          {showMicLevel && <MicLevelIndicator level={micLevel} />}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{t("practice.title")}</p>
        <p
          className="truncate text-label text-muted-foreground"
          aria-live="polite"
          aria-atomic="true"
        >
          {statusKey ? t(statusKey) : null}
        </p>
      </div>
    </>
  );
}

/** Failures a fresh copy of the model could plausibly cure. */
const MODEL_ERRORS: ReadonlySet<string> = new Set([
  "recognition",
  "modelLoad",
  "workerUnavailable",
]);

function PracticeErrorNotice({
  practice,
}: {
  practice: Pick<
    PracticeState,
    "error" | "errorDetail" | "clearDownloadedModel" | "listening"
  >;
}) {
  const { t } = useTranslation("reader");
  if (!practice.error) return null;

  return (
    <div className="min-w-0 flex-1">
      <p className="text-sm" role="alert">
        {t(`practice.errors.${practice.error}`)}
      </p>
      {practice.errorDetail && (
        <p
          className="truncate text-label text-muted-foreground"
          dir="ltr"
          title={practice.errorDetail}
        >
          {practice.errorDetail}
        </p>
      )}
      {/*
        Not while a run is listening: clearing the download stops the run and
        throws away what was recited, and a recogniser that is still feeding
        the cursor does not need a fresh copy.
      */}
      {MODEL_ERRORS.has(practice.error) && !practice.listening && (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto p-0 text-label"
          onClick={() => void practice.clearDownloadedModel()}
        >
          {t("practice.redownloadModel")}
        </Button>
      )}
    </div>
  );
}

/**
 * What to do about the word the run is stopped at.
 *
 * Shown rather than the word itself. Being stopped used to reveal it in the
 * same breath, which handed someone the answer they were halfway through
 * remembering - so seeing it is a button, and pressing it does not let the
 * cursor move: the word still has to be recited.
 *
 * `skipHeld` is the escape hatch and it has to be here. The recogniser does
 * drop a phoneme a learner really said, and without a way past, asking to be
 * stopped would make the feature a trap whose only exit is abandoning the
 * page.
 */
function PracticeHeldPrompt({
  practice,
}: {
  practice: Pick<
    PracticeState,
    "heldAtLocation" | "revealHeldWord" | "skipHeldWord"
  >;
}) {
  const { t } = useTranslation("reader");
  if (!practice.heldAtLocation) return null;

  return (
    <div className="mx-3 mb-1.5 flex flex-wrap items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-1.5">
      <p
        className="min-w-0 flex-1 text-label text-muted-foreground"
        role="alert"
      >
        {t("practice.heldAt")}
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8"
        onClick={practice.revealHeldWord}
      >
        <Eye className="h-3.5 w-3.5" aria-hidden />
        {t("practice.revealHeld")}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8"
        onClick={practice.skipHeldWord}
      >
        <SkipForward className="h-3.5 w-3.5" aria-hidden />
        {t("practice.skipHeld")}
      </Button>
    </div>
  );
}

interface PracticeAudioBarProps {
  /** Page navigation, kept reachable while the bar owns the bottom strip. */
  pageControls?: ReactNode;
}

export function PracticeAudioBar({ pageControls }: PracticeAudioBarProps) {
  const { t } = useTranslation("reader");
  const { locale } = useLocale();
  const practice = useRecitationPractice();

  /*
   * A failed start resets the run, which used to unmount this bar and take
   * the error message with it - the reader pressed تسميع, the page went quiet,
   * and nothing ever said why. The bar outlives the run for exactly as long
   * as it has something to report.
   */
  if (!practice.active) {
    if (!practice.error) return null;

    return (
      <div className="mushaf-playback-bar mushaf-playback-bar--practice">
        <div className="mushaf-playback-bar__row">
          <div className="mushaf-playback-bar__info">
            <TriangleAlert
              className="h-4 w-4 shrink-0 text-destructive"
              aria-hidden
            />
            <PracticeErrorNotice practice={practice} />
          </div>

          <div className="mushaf-playback-bar__controls">
            <Button
              variant="ghost"
              size="icon"
              onClick={practice.stopPractice}
              aria-label={t("practice.dismissError")}
            >
              <X className="h-4 w-4" aria-hidden />
            </Button>

            {pageControls}
          </div>
        </div>
      </div>
    );
  }

  const progressPercent =
    practice.totalWords > 0
      ? Math.min(100, (practice.progressIndex / practice.totalWords) * 100)
      : 0;

  return (
    <div className="mushaf-playback-bar mushaf-playback-bar--practice">
      <div
        className={cn(
          "mushaf-playback-bar__progress",
          practice.completed && "bg-success",
        )}
        style={{ inlineSize: `${progressPercent}%` }}
        aria-hidden
      />

      <div className="mushaf-playback-bar__row">
        <div className="mushaf-playback-bar__info">
          <PracticeTelemetryStatus practice={practice} />
        </div>

        <div className="mushaf-playback-bar__controls">
          <div className="flex items-center gap-0.5">
            {practice.loadingModel && (
              <span className="shrink-0 text-label tabular-nums text-muted-foreground">
                {t("practice.modelProgress", {
                  progress: formatNumber(practice.modelProgress, locale),
                })}
              </span>
            )}

            {practice.isAnalyzing && (
              <Loader2
                className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground"
                aria-hidden
              />
            )}

            {/* Being stopped and told the word suits some people and not
                others, so it is a choice rather than the behaviour. */}
            <Button
              variant="ghost"
              size="icon"
              onClick={practice.toggleStopOnMistake}
              /* No `aria-pressed`: the name says the state, and both made a
                 screen reader say it twice in different words. The header's
                 practice button documents the same decision. */
              title={
                practice.stopOnMistake
                  ? t("practice.stopOnMistakeOn")
                  : t("practice.stopOnMistakeOff")
              }
              aria-label={
                practice.stopOnMistake
                  ? t("practice.stopOnMistakeOn")
                  : t("practice.stopOnMistakeOff")
              }
            >
              {practice.stopOnMistake ? (
                <Bell className="h-4 w-4" aria-hidden />
              ) : (
                <BellOff className="h-4 w-4" aria-hidden />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={practice.toggleHideAyat}
              title={
                practice.hideAyat
                  ? t("practice.showAyat")
                  : t("practice.hideAyat")
              }
              aria-label={
                practice.hideAyat
                  ? t("practice.showAyat")
                  : t("practice.hideAyat")
              }
            >
              {practice.hideAyat ? (
                <EyeOff className="h-4 w-4" aria-hidden />
              ) : (
                <Eye className="h-4 w-4" aria-hidden />
              )}
            </Button>

            {/* A diagnostic, kept beside the other switches because that
                is where someone looks when they suspect their microphone. */}
            <Button
              variant="ghost"
              size="icon"
              onClick={practice.toggleShowDebug}
              title={
                practice.showDebug
                  ? t("practice.debugOn")
                  : t("practice.debugOff")
              }
              aria-label={
                practice.showDebug
                  ? t("practice.debugOn")
                  : t("practice.debugOff")
              }
            >
              <Activity
                className={cn("h-4 w-4", !practice.showDebug && "opacity-40")}
                aria-hidden
              />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              /* Ends the run and scores it, rather than throwing it away. */
              onClick={practice.finishPractice}
              aria-label={t("practice.stop")}
            >
              <Square className="h-3.5 w-3.5 fill-current" aria-hidden />
            </Button>
          </div>

          {pageControls}
        </div>

        {practice.showDebug && <PracticeDebugPanel />}
      </div>

      <span
        className="sr-only"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={practice.totalWords}
        aria-valuenow={practice.progressIndex}
        aria-label={t("practice.progress")}
        aria-valuetext={t("audio.playlistProgress", {
          current: formatNumber(practice.progressIndex, locale),
          total: formatNumber(practice.totalWords, locale),
        })}
      />

      <PracticeHeldPrompt practice={practice} />

      {practice.lastTranscript && (
        <div className="mx-3 mb-1.5 rounded-md border border-border/70 bg-background/70 px-3 py-1.5">
          <p className="text-[11px] text-muted-foreground">
            {t("practice.transcript")}
          </p>
          <p
            className="min-h-[1.25rem] text-sm leading-relaxed text-foreground"
            dir="rtl"
            lang="ar"
          >
            {practice.lastTranscript}
          </p>
        </div>
      )}

      {practice.error && (
        <div className="flex px-3 pb-1">
          <PracticeErrorNotice practice={practice} />
        </div>
      )}
    </div>
  );
}
