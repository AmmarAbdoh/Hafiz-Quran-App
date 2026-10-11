import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Download, Loader2, Search, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatNumber, useLocale, type Locale } from "@/app/i18n";
import { SURAH_AYAH_COUNTS, useReciter, useSurahNames } from "@/domain/quran";
import {
  deleteAllForReciter,
  deleteSurah,
  downloadSurah,
  estimateQuranBytes,
  estimateSurahBytes,
  listDownloads,
  storageEstimate,
  type DownloadProgress,
  type SurahDownload,
} from "@/features/quran-reader/services/audioDownloads";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { cn } from "@/shared/lib/utils";

const SURAH_NUMBERS = SURAH_AYAH_COUNTS.map((_, index) => index + 1);

function formatBytes(bytes: number, locale: Locale): string {
  const mb = bytes / 1_048_576;
  if (mb >= 1024) {
    return `${formatNumber(Number((mb / 1024).toFixed(1)), locale)} GB`;
  }
  return `${formatNumber(Math.max(1, Math.round(mb)), locale)} MB`;
}

interface Busy {
  /** A surah number, or "all" for the whole Quran. */
  target: number | "all";
  progress: DownloadProgress;
}

export function OfflineRecitation() {
  const { t } = useTranslation("settings");
  const { t: tCommon } = useTranslation("common");
  const { locale } = useLocale();
  const { reciter } = useReciter();
  const { surahName, language: surahLanguage } = useSurahNames();
  const nameDir = surahLanguage === "ar" ? "rtl" : "ltr";

  const [downloads, setDownloads] = useState<SurahDownload[]>([]);
  const [storage, setStorage] = useState<{
    usedBytes: number;
    quotaBytes: number;
  } | null>(null);
  const [busy, setBusy] = useState<Busy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(() => {
    setDownloads(listDownloads());
    void storageEstimate().then(setStorage);
  }, []);

  useEffect(refresh, [refresh]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const forReciter = downloads.filter(
    (entry) => entry.reciterId === reciter.id,
  );
  const bySurah = new Map(forReciter.map((entry) => [entry.surah, entry]));
  const storedBytes = forReciter.reduce((sum, entry) => sum + entry.bytes, 0);

  const run = async (target: number | "all", surahs: number[]) => {
    const controller = new AbortController();
    abortRef.current = controller;
    setError(null);
    setBusy({ target, progress: { done: 0, total: 0, bytes: 0 } });

    try {
      for (const surah of surahs) {
        await downloadSurah(reciter, surah, {
          signal: controller.signal,
          onProgress: (progress) => setBusy({ target, progress }),
        });
        refresh();
      }
    } catch (cause) {
      if ((cause as Error)?.name !== "AbortError") {
        setError(t("offlineAudio.failed"));
      }
    } finally {
      abortRef.current = null;
      setBusy(null);
      refresh();
    }
  };

  const remove = async (surah: number) => {
    await deleteSurah(reciter, surah);
    refresh();
  };

  const removeAll = async () => {
    await deleteAllForReciter(reciter);
    refresh();
  };

  const missing = SURAH_NUMBERS.filter((surah) => !bySurah.has(surah));
  const visible = SURAH_NUMBERS.filter((surah) => {
    if (!query.trim()) return true;
    const needle = query.trim().toLowerCase();
    return (
      surahName(surah).toLowerCase().includes(needle) ||
      String(surah).includes(needle)
    );
  });

  return (
    <div className="space-y-5">
      <p className="text-sm leading-6 text-muted-foreground">
        {t("offlineAudio.forReciter")}{" "}
        <bdi dir={nameDir} lang={surahLanguage} className="font-semibold">
          {locale === "ar" ? reciter.nameAr : reciter.nameEn}
        </bdi>
      </p>

      <dl className="flex flex-wrap gap-x-6 gap-y-1 text-label">
        <div className="flex gap-1.5">
          <dt className="text-muted-foreground">{t("offlineAudio.stored")}</dt>
          <dd className="font-semibold tabular-nums">
            {formatBytes(storedBytes, locale)}
          </dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-muted-foreground">
            {t("offlineAudio.surahsStored")}
          </dt>
          <dd className="font-semibold tabular-nums">
            {formatNumber(forReciter.length, locale)}
          </dd>
        </div>
        {storage && storage.quotaBytes > 0 ? (
          <div className="flex gap-1.5">
            <dt className="text-muted-foreground">
              {t("offlineAudio.freeSpace")}
            </dt>
            <dd className="font-semibold tabular-nums">
              {formatBytes(
                Math.max(0, storage.quotaBytes - storage.usedBytes),
                locale,
              )}
            </dd>
          </div>
        ) : null}
      </dl>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => void run("all", missing)}
          disabled={busy !== null || missing.length === 0}
        >
          {busy?.target === "all" ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Download className="h-4 w-4" aria-hidden />
          )}
          {missing.length === 0
            ? t("offlineAudio.allStored")
            : t("offlineAudio.downloadAll", {
                size: formatBytes(estimateQuranBytes(), locale),
              })}
        </Button>

        {busy ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => abortRef.current?.abort()}
          >
            <X className="h-4 w-4" aria-hidden />
            {tCommon("actions.cancel")}
          </Button>
        ) : null}

        {forReciter.length > 0 && !busy ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => void removeAll()}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            {t("offlineAudio.deleteAll")}
          </Button>
        ) : null}
      </div>

      {busy ? (
        <p
          className="text-label text-muted-foreground tabular-nums"
          role="status"
        >
          {t("offlineAudio.progress", {
            done: formatNumber(busy.progress.done, locale),
            total: formatNumber(busy.progress.total, locale),
          })}
        </p>
      ) : null}

      {error ? (
        <p className="text-label text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="offline-surah-search">
          {t("offlineAudio.findSurah")}
        </Label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute inset-inline-start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="offline-surah-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("offlineAudio.searchPlaceholder")}
            className="ps-9"
          />
        </div>
      </div>

      {/* Capped so a settings page is not 114 rows tall. */}
      <ul className="max-h-96 divide-y divide-border-subtle overflow-y-auto rounded-lg border border-border">
        {visible.map((surah) => {
          const stored = bySurah.get(surah);
          const downloading = busy?.target === surah;
          return (
            <li
              key={surah}
              className="flex min-h-14 items-center justify-between gap-3 px-3 py-2"
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-body font-medium">
                  {formatNumber(surah, locale)}.{" "}
                  <bdi dir={nameDir} lang={surahLanguage}>
                    {surahName(surah)}
                  </bdi>
                </span>
                <span
                  className={cn(
                    "flex items-center gap-1 text-label tabular-nums",
                    stored ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {stored ? (
                    <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  ) : null}
                  {stored
                    ? formatBytes(stored.bytes, locale)
                    : t("offlineAudio.about", {
                        size: formatBytes(estimateSurahBytes(surah), locale),
                      })}
                </span>
              </span>

              {stored ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className={cn("shrink-0 text-muted-foreground")}
                  onClick={() => void remove(surah)}
                  disabled={busy !== null}
                  aria-label={t("offlineAudio.deleteSurah", {
                    name: surahName(surah),
                  })}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0"
                  onClick={() => void run(surah, [surah])}
                  disabled={busy !== null}
                  aria-label={t("offlineAudio.downloadSurah", {
                    name: surahName(surah),
                  })}
                >
                  {downloading ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Download className="h-4 w-4" aria-hidden />
                  )}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
