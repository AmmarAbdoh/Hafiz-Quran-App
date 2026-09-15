import { ChevronLeft, ChevronRight, Pause, Play, Square } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatNumber, useLocale } from "@/app/i18n";
import {
  useQuranPlaybackActions,
  useQuranPlaybackState,
} from "@/features/quran-reader/context/QuranPlaybackContext";
import { useGoToPlayingVerse } from "@/features/quran-reader/hooks/useGoToPlayingVerse";
import { Button } from "@/shared/components/ui/button";
import { useSurahNames } from "@/domain/quran";

/**
 * Shown outside the reader while a recitation is still running. Styled with
 * utilities only, because the reader stylesheet loads with the reader chunk.
 */
export function PlaybackMiniPlayer() {
  const { t, i18n } = useTranslation("reader");
  const { locale } = useLocale();
  const { surahName, language: surahLanguage } = useSurahNames();
  const playback = useQuranPlaybackState();
  const actions = useQuranPlaybackActions();
  const goToPlayingVerse = useGoToPlayingVerse();

  if (!playback.active) return null;

  const progress =
    playback.playlistTotal > 0
      ? Math.min(100, (playback.playlistIndex / playback.playlistTotal) * 100)
      : 0;
  const OpenIcon = i18n.dir() === "rtl" ? ChevronLeft : ChevronRight;

  return (
    <div className="playback-mini relative border-t border-border bg-card/95 shadow-[var(--shadow-dock)] backdrop-blur-md md:pb-[max(0px,env(safe-area-inset-bottom))]">
      <div
        className="absolute start-0 top-0 h-0.5 bg-primary transition-[width] duration-200"
        style={{ inlineSize: `${progress}%` }}
        aria-hidden
      />

      <div className="mx-auto flex max-w-6xl items-center gap-1 px-2 py-1 sm:px-4">
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 shrink-0"
          onClick={playback.playing ? actions.pause : actions.resume}
          aria-label={playback.playing ? t("audio.pause") : t("audio.resume")}
        >
          {playback.playing ? (
            <Pause className="h-4 w-4" aria-hidden />
          ) : (
            <Play className="h-4 w-4" aria-hidden />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 shrink-0"
          onClick={actions.stop}
          aria-label={t("audio.stop")}
        >
          <Square className="h-3.5 w-3.5 fill-current" aria-hidden />
        </Button>

        <button
          type="button"
          onClick={goToPlayingVerse}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-start transition-colors duration-fast ease-standard hover:bg-surface-hover"
          title={t("audio.goToCurrent")}
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">
              <bdi
                dir={surahLanguage === "ar" ? "rtl" : "ltr"}
                lang={surahLanguage}
              >
                {surahName(playback.surah)}
              </bdi>{" "}
              — {t("ayah")} {formatNumber(playback.currentAyah, locale)}
            </span>
            <span className="block truncate text-label text-muted-foreground">
              {t("audio.goToCurrent")}
            </span>
          </span>
          <OpenIcon
            className="h-4 w-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
        </button>
      </div>
    </div>
  );
}
