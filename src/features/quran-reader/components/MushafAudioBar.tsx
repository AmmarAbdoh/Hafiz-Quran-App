import { Pause, Play, Square, Volume2 } from "lucide-react";
import { formatPlaybackTime } from "@/features/quran-reader/utils/playbackUtils";
import { useQuranPlayback } from "@/features/quran-reader/context/QuranPlaybackContext";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";

export function MushafAudioBar() {
  const playback = useQuranPlayback();

  if (!playback.active) return null;

  const surahDurationMs = playback.surahDurationMs;
  const elapsedMs = playback.elapsedMs;
  const remainingMs =
    surahDurationMs > 0
      ? Math.max(0, surahDurationMs - elapsedMs)
      : 0;
  const progress =
    surahDurationMs > 0
      ? Math.min(100, (elapsedMs / surahDurationMs) * 100)
      : 0;

  return (
    <div className="shrink-0 border-t border-border bg-muted/60 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <Volume2 className="h-4 w-4 shrink-0 text-primary" aria-hidden />

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {playback.surahName} — آية {playback.currentAyah}
              {playback.ayahCount > 0 && (
                <span className="font-normal text-muted-foreground">
                  {" "}
                  / {playback.ayahCount}
                </span>
              )}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {playback.reciterName}
              {playback.supportsWordHighlight && " · تمييز الكلمات"}
            </p>
          </div>

          <div className="hidden text-xs tabular-nums text-muted-foreground sm:block">
            <span>{formatPlaybackTime(elapsedMs)}</span>
            {surahDurationMs > 0 && (
              <>
                <span> / {formatPlaybackTime(surahDurationMs)}</span>
                <span className="text-muted-foreground/80">
                  {" "}
                  · متبقي {formatPlaybackTime(remainingMs)}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={playback.playing ? playback.pause : playback.resume}
              aria-label={playback.playing ? "إيقاف مؤقت" : "استئناف"}
            >
              {playback.playing ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={playback.stop}
              aria-label="إيقاف التلاوة"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:hidden">
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {formatPlaybackTime(elapsedMs)}
          </span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
            <div
              className={cn(
                "h-full rounded-full bg-primary transition-[width] duration-200",
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
          {surahDurationMs > 0 && (
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              / {formatPlaybackTime(surahDurationMs)}
            </span>
          )}
        </div>

        <div className="hidden h-1.5 overflow-hidden rounded-full bg-border sm:block">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>

        {playback.error && (
          <p className="text-xs text-destructive">{playback.error}</p>
        )}
      </div>
    </div>
  );
}
