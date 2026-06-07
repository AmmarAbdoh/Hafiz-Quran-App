import { CheckCircle2, Eye, EyeOff, Loader2, Mic, Square } from "lucide-react";
import { useRecitationPractice } from "@/features/quran-reader/context/RecitationPracticeContext";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";

const MIC_LEVEL_BARS = [0.12, 0.28, 0.48, 0.72, 1] as const;

function getStatusLine(
  practice: ReturnType<typeof useRecitationPractice>,
): string {
  switch (practice.phase) {
    case "preparing":
      return "جاري تجهيز الصفحة...";
    case "loading-model":
      return "جاري تحميل نموذج التعرف على الصوت...";
    case "completed":
      return "أحسنت! انتهيت من تسميع هذه الصفحة";
    case "listening":
      if (practice.wrongFlashLocation) {
        return "لم يتطابق — حاول مرة أخرى من الكلمة المحددة";
      }
      if (practice.isSpeaking) {
        return "يستمع... الكلمات تظهر أثناء تلاوتك";
      }
      if (practice.isAnalyzing) {
        return "يتحقق مما قلته...";
      }
      return practice.hideAyat
        ? "اقرأ من الذاكرة — الآيات مخفية"
        : "اقرأ من الذاكرة — الآيات ظاهرة";
    default:
      return "";
  }
}

function MicLevelIndicator({ level }: { level: number }) {
  return (
    <div
      className="flex h-5 items-end gap-0.5"
      aria-hidden
    >
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

export function PracticeAudioBar() {
  const practice = useRecitationPractice();

  if (!practice.active) return null;

  const progressPercent =
    practice.totalWords > 0
      ? Math.min(100, (practice.progressIndex / practice.totalWords) * 100)
      : 0;

  const showMicLevel =
    !practice.loadingModel && !practice.completed && practice.listening;

  return (
    <div className="z-40 shrink-0 border-t border-primary/30 bg-primary/5 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-col gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2" dir="rtl">
        <div className="flex items-center gap-2 sm:gap-3">
          {practice.loadingModel ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
          ) : practice.completed ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
          ) : (
            <div className="relative flex shrink-0 items-center gap-1.5">
              {showMicLevel && (
                <span
                  className="absolute -inset-1 rounded-full bg-primary/20 transition-transform duration-75"
                  style={{
                    transform: `scale(${1 + practice.micLevel * 0.55})`,
                    opacity: 0.25 + practice.micLevel * 0.55,
                  }}
                />
              )}
              <Mic
                className={cn(
                  "relative h-4 w-4 shrink-0",
                  practice.isSpeaking || practice.micLevel > 0.15
                    ? "text-primary"
                    : "text-muted-foreground",
                )}
              />
              {showMicLevel && <MicLevelIndicator level={practice.micLevel} />}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">وضع التسميع</p>
            <p className="truncate text-xs text-muted-foreground">
              {getStatusLine(practice)}
            </p>
          </div>

          {practice.loadingModel && (
            <span className="text-xs tabular-nums text-muted-foreground">
              {practice.modelProgress}%
            </span>
          )}

          {practice.isAnalyzing && (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
          )}

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={practice.toggleHideAyat}
            title={practice.hideAyat ? "إظهار الآيات" : "إخفاء الآيات"}
            aria-label={practice.hideAyat ? "إظهار الآيات" : "إخفاء الآيات"}
          >
            {practice.hideAyat ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={practice.stopPractice}
            aria-label="إيقاف التسميع"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
          </Button>
        </div>

        {(practice.lastTranscript || practice.isSpeaking) && (
          <div className="rounded-md border border-border/70 bg-background/70 px-3 py-2">
            <p className="text-[11px] text-muted-foreground">ما قلته:</p>
            <p
              className={cn(
                "min-h-[1.25rem] text-sm leading-relaxed",
                practice.lastTranscript
                  ? "text-foreground"
                  : "text-muted-foreground italic",
              )}
              dir="rtl"
            >
              {practice.lastTranscript ||
                (practice.isSpeaking ? "..." : "—")}
            </p>
          </div>
        )}

        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
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
              {practice.progressIndex}/{practice.totalWords}
            </span>
          )}
        </div>

        {practice.error && (
          <p className="text-xs text-destructive">{practice.error}</p>
        )}
      </div>
    </div>
  );
}
