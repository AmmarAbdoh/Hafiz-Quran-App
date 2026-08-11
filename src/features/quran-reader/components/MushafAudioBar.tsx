import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LocateFixed, Pause, Play, Square, Volume2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatNumber, useLocale } from "@/app/i18n";
import {
  buildQuranAyahPath,
  isQuranReaderPath,
} from "@/features/quran-reader/model/quranReaderRoutes";
import {
  useQuranPlaybackActions,
  useQuranPlaybackState,
} from "@/features/quran-reader/context/QuranPlaybackContext";
import { Button } from "@/shared/components/ui/button";
import { JUZ_NAMES, SURAH_NAMES } from "@/domain/quran";
import { cn } from "@/shared/lib/utils";

export function MushafAudioBar() {
  const { t } = useTranslation("reader");
  const { locale } = useLocale();
  const playback = useQuranPlaybackState();
  const actions = useQuranPlaybackActions();
  const navigate = useNavigate();
  const location = useLocation();
  const isQuranReader = isQuranReaderPath(location.pathname);

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
    <bdi dir="rtl" lang="ar">
      {playback.surahName}
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
        const name = SURAH_NAMES[(plan.surah ?? playback.surah) - 1];
        scopeSummary = (
          <span>
            {t("surah")}{" "}
            {name ? (
              <bdi dir="rtl" lang="ar">
                {name}
              </bdi>
            ) : null}
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

  const handleGoToAyah = () => {
    if (!playback.activeVerseKey) return;
    actions.setAutoFollowPages(true);
    actions.goToVerse(playback.activeVerseKey);
    if (!isQuranReader && playback.activeVerseKey) {
      const [surah, ayah] = playback.activeVerseKey.split(":");
      if (surah && ayah) {
        void navigate(
          buildQuranAyahPath(
            Number.parseInt(surah, 10),
            Number.parseInt(ayah, 10),
          ),
        );
        return;
      }
    }
  };

  return (
    <div className="z-30 shrink-0 border-b border-border bg-muted/80 shadow-[var(--shadow-overlay)] backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-col gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2">
        <div className="flex items-center gap-2 sm:gap-3">
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
              <bdi dir="rtl" lang="ar">
                {playback.surahName}
              </bdi>{" "}
              — {t("ayah")} {formatNumber(playback.currentAyah, locale)}
              {repeatSummary ? ` · ${repeatSummary}` : ""}
              {playback.supportsWordHighlight
                ? ` · ${t("audio.wordHighlight")}`
                : ""}
            </p>
          </div>

          {showFollowButton && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="hidden min-h-11 shrink-0 gap-1.5 px-2.5 text-xs sm:inline-flex"
              onClick={handleGoToAyah}
              title={t("audio.goToCurrent")}
            >
              <LocateFixed className="h-3.5 w-3.5" aria-hidden />
              {t("audio.followReading")}
            </Button>
          )}

          <div
            className="hidden text-xs tabular-nums text-muted-foreground md:block"
            dir="rtl"
            lang="ar"
          >
            {playback.reciterName}
          </div>

          <div className="flex items-center gap-1">
            {showFollowButton && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-11 w-11 sm:hidden"
                onClick={handleGoToAyah}
                aria-label={t("audio.followReading")}
                title={t("audio.followReading")}
              >
                <LocateFixed className="h-4 w-4" aria-hidden />
              </Button>
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
          </div>
        </div>

        <div className="flex items-center gap-2 sm:hidden">
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatNumber(playback.playlistIndex, locale)}/
            {formatNumber(playback.playlistTotal, locale)}
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
          <p className="text-xs text-destructive" role="alert">
            {t("audio.error")}
          </p>
        )}
      </div>
    </div>
  );
}
