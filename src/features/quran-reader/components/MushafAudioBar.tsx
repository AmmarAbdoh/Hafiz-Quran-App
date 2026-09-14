import type { ReactNode } from "react";
import { LocateFixed, Pause, Play, Square, Volume2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatNumber, useLocale } from "@/app/i18n";
import {
  useQuranPlaybackActions,
  useQuranPlaybackState,
} from "@/features/quran-reader/context/QuranPlaybackContext";
import { useGoToPlayingVerse } from "@/features/quran-reader/hooks/useGoToPlayingVerse";
import { Button } from "@/shared/components/ui/button";
import { JUZ_NAMES, useSurahNames } from "@/domain/quran";

interface MushafAudioBarProps {
  /** Page navigation, kept reachable while the bar owns the bottom strip. */
  pageControls?: ReactNode;
}

export function MushafAudioBar({ pageControls }: MushafAudioBarProps) {
  const { t } = useTranslation("reader");
  const { locale } = useLocale();
  const { surahName, language: surahLanguage } = useSurahNames();
  const nameDir = surahLanguage === "ar" ? "rtl" : "ltr";
  const playback = useQuranPlaybackState();
  const actions = useQuranPlaybackActions();
  const goToPlayingVerse = useGoToPlayingVerse();

  if (!playback.active) return null;

  const progress =
    playback.playlistTotal > 0
      ? Math.min(100, (playback.playlistIndex / playback.playlistTotal) * 100)
      : 0;

  const showFollowButton =
    Boolean(playback.activeVerseKey) &&
    !playback.autoFollowPages &&
    !playback.activeVerseInView;

  let scopeSummary: ReactNode = (
    <bdi dir={nameDir} lang={surahLanguage}>
      {surahName(playback.surah)}
    </bdi>
  );
  const plan = playback.scopePlan;
  if (plan) {
    switch (plan.scope) {
      case "ayah":
        scopeSummary = t("listenDialog.scopeLabels.ayah", {
          surah: formatNumber(plan.surah ?? playback.surah, locale),
          ayah: formatNumber(plan.ayah ?? playback.currentAyah, locale),
        });
        break;
      case "ayah-range":
        scopeSummary = t("listenDialog.scopeLabels.ayahRange", {
          startSurah: formatNumber(plan.surah ?? playback.surah, locale),
          startAyah: formatNumber(plan.ayah ?? playback.currentAyah, locale),
          endSurah: formatNumber(plan.endSurah ?? playback.surah, locale),
          endAyah: formatNumber(plan.endAyah ?? playback.currentAyah, locale),
        });
        break;
      case "page":
        scopeSummary = t("listenDialog.scopeLabels.page", {
          page: formatNumber(plan.page ?? 1, locale),
        });
        break;
      case "page-range":
        scopeSummary = t("listenDialog.scopeLabels.pageRange", {
          from: formatNumber(plan.page ?? 1, locale),
          to: formatNumber(plan.endPage ?? plan.page ?? 1, locale),
        });
        break;
      case "surah": {
        scopeSummary = (
          <span>
            {t("surah")}{" "}
            <bdi dir={nameDir} lang={surahLanguage}>
              {surahName(plan.surah ?? playback.surah)}
            </bdi>
          </span>
        );
        break;
      }
      case "juz": {
        const juz = plan.juz ?? 1;
        const juzName = JUZ_NAMES[juz - 1];
        scopeSummary = (
          <span>
            {t("metadata.juz", { number: formatNumber(juz, locale) })}
            {juzName ? (
              <>
                {" "}
                ·{" "}
                <bdi dir="rtl" lang="ar">
                  {juzName}
                </bdi>
              </>
            ) : null}
          </span>
        );
        break;
      }
    }
  }

  let repeatSummary: string | null = null;
  if (playback.repeatMode === "infinite") {
    repeatSummary = t("audio.repeatInfinite");
  } else if (playback.repeatMode === "count") {
    repeatSummary = playback.repeatEachAyah
      ? t("audio.repeatEach", {
          count: formatNumber(playback.repeatCount, locale),
        })
      : t("audio.repeatProgress", {
          current: formatNumber(playback.repeatIteration, locale),
          total: formatNumber(playback.repeatCount, locale),
        });
  }

  return (
    <div className="mushaf-playback-bar">
      <div
        className="mushaf-playback-bar__progress"
        style={{ inlineSize: `${progress}%` }}
        aria-hidden
      />

      <div className="mushaf-playback-bar__row">
        <div className="mushaf-playback-bar__info">
          <Volume2 className="h-4 w-4 shrink-0 text-primary" aria-hidden />

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {scopeSummary}
              {playback.playlistTotal > 1 && (
                <span className="font-normal text-muted-foreground">
                  {" "}
                  ·{" "}
                  {t("audio.playlistProgress", {
                    current: formatNumber(playback.playlistIndex, locale),
                    total: formatNumber(playback.playlistTotal, locale),
                  })}
                </span>
              )}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              <bdi dir={nameDir} lang={surahLanguage}>
                {surahName(playback.surah)}
              </bdi>{" "}
              — {t("ayah")} {formatNumber(playback.currentAyah, locale)}
              {repeatSummary ? ` · ${repeatSummary}` : ""}
              {playback.supportsWordHighlight
                ? ` · ${t("audio.wordHighlight")}`
                : ""}
            </p>
          </div>
        </div>

        <div className="mushaf-playback-bar__controls">
          <div className="flex items-center gap-0.5">
            {showFollowButton && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="hidden shrink-0 gap-1.5 px-2.5 text-xs lg:inline-flex"
                  onClick={goToPlayingVerse}
                  title={t("audio.goToCurrent")}
                >
                  <LocateFixed className="h-3.5 w-3.5" aria-hidden />
                  {t("audio.followReading")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 lg:hidden"
                  onClick={goToPlayingVerse}
                  aria-label={t("audio.followReading")}
                  title={t("audio.followReading")}
                >
                  <LocateFixed className="h-4 w-4" aria-hidden />
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11"
              onClick={playback.playing ? actions.pause : actions.resume}
              aria-label={
                playback.playing ? t("audio.pause") : t("audio.resume")
              }
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
              className="h-11 w-11"
              onClick={actions.stop}
              aria-label={t("audio.stop")}
            >
              <Square className="h-3.5 w-3.5 fill-current" aria-hidden />
            </Button>
            <span
              className="hidden max-w-32 truncate text-xs tabular-nums text-muted-foreground xl:block"
              dir="rtl"
              lang="ar"
            >
              {playback.reciterName}
            </span>
          </div>

          {pageControls}
        </div>
      </div>

      <span
        className="sr-only"
        role="progressbar"
        aria-label={t("audio.progress")}
        aria-valuemin={0}
        aria-valuemax={playback.playlistTotal}
        aria-valuenow={playback.playlistIndex}
        aria-valuetext={t("audio.playlistProgress", {
          current: formatNumber(playback.playlistIndex, locale),
          total: formatNumber(playback.playlistTotal, locale),
        })}
      />

      {playback.error && (
        <p className="px-3 pb-1 text-xs text-destructive" role="alert">
          {t("audio.error")}
        </p>
      )}
    </div>
  );
}
