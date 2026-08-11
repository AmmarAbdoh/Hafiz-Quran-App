import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatNumber, useLocale } from "@/app/i18n";
import { getSurahAyahCount, getSurahTashkeelName } from "@/domain/quran";
import type { MushafVerse } from "@/domain/quran";

interface MushafSurahEndNavProps {
  currentSurah: number;
  mushafData: MushafVerse[];
  onSurahChange: (surahNumber: number) => void;
}

export function MushafSurahEndNav({
  currentSurah,
  mushafData,
  onSurahChange,
}: MushafSurahEndNavProps) {
  const { t } = useTranslation("reader");
  const { locale } = useLocale();
  const prevSurah = currentSurah > 1 ? currentSurah - 1 : null;
  const nextSurah = currentSurah < 114 ? currentSurah + 1 : null;

  if (!prevSurah && !nextSurah) return null;

  const prevName = prevSurah
    ? getSurahTashkeelName(mushafData, prevSurah)
    : null;
  const nextName = nextSurah
    ? getSurahTashkeelName(mushafData, nextSurah)
    : null;
  const prevAyahs =
    prevSurah !== null ? getSurahAyahCount(mushafData, prevSurah) : undefined;
  const nextAyahs =
    nextSurah !== null ? getSurahAyahCount(mushafData, nextSurah) : undefined;

  return (
    <nav
      className="mushaf-surah-end-nav"
      aria-label={t("navigation.betweenSurahs")}
    >
      {prevSurah && prevName ? (
        <button
          type="button"
          className="mushaf-surah-end-nav__link mushaf-surah-end-nav__link--prev min-h-11"
          onClick={() => onSurahChange(prevSurah)}
        >
          <ChevronLeft
            className="h-4 w-4 shrink-0 opacity-70 rtl:rotate-180"
            aria-hidden
          />
          <span className="min-w-0 text-start">
            <span className="block text-[11px] text-muted-foreground">
              {t("navigation.previousSurah")}
            </span>
            <span
              className="block truncate text-sm font-semibold text-foreground"
              dir="rtl"
              lang="ar"
            >
              {prevName}
            </span>
            {prevAyahs !== undefined && (
              <span className="block text-xs text-muted-foreground">
                {t("metadata.ayahCount", {
                  count: prevAyahs,
                  formattedCount: formatNumber(prevAyahs, locale),
                })}
              </span>
            )}
          </span>
        </button>
      ) : (
        <div aria-hidden />
      )}

      {nextSurah && nextName ? (
        <button
          type="button"
          className="mushaf-surah-end-nav__link mushaf-surah-end-nav__link--next min-h-11"
          onClick={() => onSurahChange(nextSurah)}
        >
          <span className="min-w-0 text-end">
            <span className="block text-[11px] text-muted-foreground">
              {t("navigation.nextSurah")}
            </span>
            <span
              className="block truncate text-sm font-semibold text-foreground"
              dir="rtl"
              lang="ar"
            >
              {nextName}
            </span>
            {nextAyahs !== undefined && (
              <span className="block text-xs text-muted-foreground">
                {t("metadata.ayahCount", {
                  count: nextAyahs,
                  formattedCount: formatNumber(nextAyahs, locale),
                })}
              </span>
            )}
          </span>
          <ChevronRight
            className="h-4 w-4 shrink-0 opacity-70 rtl:rotate-180"
            aria-hidden
          />
        </button>
      ) : (
        <div aria-hidden />
      )}
    </nav>
  );
}
