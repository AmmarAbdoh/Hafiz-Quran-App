import { useLocation, useNavigate } from "react-router-dom";
import { LocateFixed, Pause, Play, Square, Volume2 } from "lucide-react";
import {
  buildQuranAyahPath,
  isQuranReaderPath,
} from "@/features/quran-reader/lib/quranReaderRoutes";
import { useQuranPlayback } from "@/features/quran-reader/context/QuranPlaybackContext";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";

export function MushafAudioBar() {
  const playback = useQuranPlayback();
  const navigate = useNavigate();
  const location = useLocation();
  const isQuranReader = isQuranReaderPath(location.pathname);

  if (!playback.active) return null;

  const progress =
    playback.playlistTotal > 0
      ? Math.min(
          100,
          (playback.playlistIndex / playback.playlistTotal) * 100,
        )
      : 0;

  const showFollowButton =
    Boolean(playback.activeVerseKey) &&
    !playback.autoFollowPages &&
    !playback.activeVerseInView;

  const handleGoToAyah = () => {
    if (!playback.activeVerseKey) return;
    playback.setAutoFollowPages(true);
    playback.goToVerse(playback.activeVerseKey);
    if (!isQuranReader && playback.activeVerseKey) {
      const [surah, ayah] = playback.activeVerseKey.split(":");
      if (surah && ayah) {
        navigate(buildQuranAyahPath(Number.parseInt(surah, 10), Number.parseInt(ayah, 10)));
        return;
      }
    }
  };

  return (
    <div className="z-30 shrink-0 border-b border-border bg-muted/80 shadow-[0_-4px_24px_-8px_rgba(0,0,0,0.15)] backdrop-blur-md dark:shadow-[0_-4px_24px_-8px_rgba(0,0,0,0.45)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2">
        <div className="flex items-center gap-2 sm:gap-3">
          <Volume2 className="h-4 w-4 shrink-0 text-primary" aria-hidden />

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {playback.scopeLabel || playback.surahName}
              {playback.playlistTotal > 1 && (
                <span className="font-normal text-muted-foreground">
                  {" "}
                  · {playback.playlistIndex}/{playback.playlistTotal}
                </span>
              )}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {playback.surahName} — آية {playback.currentAyah}
              {playback.repeatLabel ? ` · ${playback.repeatLabel}` : ""}
              {playback.supportsWordHighlight ? " · تمييز الكلمات" : ""}
            </p>
          </div>

          {showFollowButton && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="hidden h-8 shrink-0 gap-1.5 px-2.5 text-xs sm:inline-flex"
              onClick={handleGoToAyah}
              title="انتقل إلى صفحة الآية الجارية"
            >
              <LocateFixed className="h-3.5 w-3.5" />
              متابعة القراءة
            </Button>
          )}

          <div className="hidden text-xs tabular-nums text-muted-foreground md:block">
            {playback.reciterName}
          </div>

          <div className="flex items-center gap-1">
            {showFollowButton && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 sm:hidden"
                onClick={handleGoToAyah}
                aria-label="متابعة القراءة"
                title="متابعة القراءة"
              >
                <LocateFixed className="h-4 w-4" />
              </Button>
            )}
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
          <span className="shrink-0 text-xs text-muted-foreground">
            {playback.playlistIndex}/{playback.playlistTotal}
          </span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
            <div
              className={cn(
                "h-full rounded-full bg-primary transition-[width] duration-200",
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
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
