import { CheckCircle2, Eye, EyeOff, Loader2, Mic, Square } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatNumber, useLocale } from "@/app/i18n";
import {
  useRecitationPractice,
  useRecitationPracticeTelemetry,
} from "@practice/runtime";
import { Button } from "@/shared/components/ui/button";
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
          className="truncate text-xs text-muted-foreground"
          aria-live="polite"
          aria-atomic="true"
        >
          {statusKey ? t(statusKey) : null}
        </p>
      </div>
    </>
  );
}

export function PracticeAudioBar() {
  const { t } = useTranslation("reader");
  const { locale } = useLocale();
  const practice = useRecitationPractice();

  if (!practice.active) return null;

  const progressPercent =
    practice.totalWords > 0
      ? Math.min(100, (practice.progressIndex / practice.totalWords) * 100)
      : 0;

  return (
    <div className="z-40 shrink-0 border-t border-primary/30 bg-primary/5 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-col gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2">
        <div className="flex items-center gap-2 sm:gap-3">
          <PracticeTelemetryStatus practice={practice} />

          {practice.loadingModel && (
            <span className="text-xs tabular-nums text-muted-foreground">
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

          <Button
            variant="ghost"
            size="icon"
            className="min-h-11 min-w-11"
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

          <Button
            variant="ghost"
            size="icon"
            className="min-h-11 min-w-11"
            onClick={practice.stopPractice}
            aria-label={t("practice.stop")}
          >
            <Square className="h-3.5 w-3.5 fill-current" aria-hidden />
          </Button>
        </div>

        {practice.lastTranscript && (
          <div className="rounded-md border border-border/70 bg-background/70 px-3 py-2">
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

        <div className="flex items-center gap-2">
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-border"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={practice.totalWords}
            aria-valuenow={practice.progressIndex}
            aria-label={t("practice.progress")}
            aria-valuetext={t("audio.playlistProgress", {
              current: formatNumber(practice.progressIndex, locale),
              total: formatNumber(practice.totalWords, locale),
            })}
          >
            <div
              className={cn(
                "h-full rounded-full bg-primary transition-[width] duration-300",
                practice.completed && "bg-green-600 dark:bg-green-500",
              )}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          {practice.totalWords > 0 && (
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {formatNumber(practice.progressIndex, locale)}/
              {formatNumber(practice.totalWords, locale)}
            </span>
          )}
        </div>

        {practice.error && (
          <p className="text-xs text-destructive" role="alert">
            {t(`practice.errors.${practice.error}`)}
          </p>
        )}
      </div>
    </div>
  );
}
