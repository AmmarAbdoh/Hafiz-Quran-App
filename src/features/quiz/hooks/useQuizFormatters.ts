import { useTranslation } from "react-i18next";
import { useSurahNames } from "@/domain/quran";
import type { QuestionType, QuizScope } from "../model/types";
import { snapshotQuizScope, type QuizScopeSnapshot } from "../model/types";
import { parseVerseKey } from "../model/versePool";

function localeFor(language: string): string {
  return language.startsWith("en") ? "en-US" : "ar-SA";
}

/** Beyond a couple of names a list stops being readable, so it becomes a count. */
const MAX_LISTED_SURAHS = 2;

export function useQuizFormatters() {
  const { t, i18n } = useTranslation("quiz");
  const { names: surahNames, language } = useSurahNames();
  const locale = localeFor(i18n.resolvedLanguage ?? i18n.language ?? "ar");
  const numbers = new Intl.NumberFormat(locale);

  function formatNumber(value: number): string {
    return numbers.format(value);
  }

  function formatQuestionType(type: QuestionType): string {
    return t(`types.labels.${type}`);
  }

  function formatSurahName(surah: number): string {
    return surahNames[surah - 1] ?? formatNumber(surah);
  }

  /** Compact "surah ayah" pair for choice labels that already carry ayah text. */
  function formatVerseRef(surah: number, ayah: number): string {
    return `${formatSurahName(surah)} ${formatNumber(ayah)}`;
  }

  function formatVerseKey(verseKey: string): string {
    const { surah, ayah } = parseVerseKey(verseKey);
    return t("results.versePosition", {
      surah: formatSurahName(surah),
      ayah: formatNumber(ayah),
    });
  }

  function formatScopeSnapshot(
    scope: QuizScopeSnapshot | null,
    legacyFallback?: string,
  ): string {
    if (!scope) return legacyFallback || t("scopeSummary.legacy");
    switch (scope.mode) {
      case "surah": {
        const names = scope.surahNumbers
          .slice(0, MAX_LISTED_SURAHS)
          .map(formatSurahName)
          .join(language === "ar" ? "، " : ", ");
        const remaining = scope.surahNumbers.length - MAX_LISTED_SURAHS;
        return remaining > 0
          ? t("scopeSummary.surahMore", {
              surah: names,
              count: remaining,
              formattedCount: formatNumber(remaining),
            })
          : t("scopeSummary.surah", { surah: names });
      }
      case "juz":
        return t("scopeSummary.juz", {
          count: scope.juzNumbers.map(formatNumber).join(", "),
        });
      case "page":
        return scope.from === scope.to
          ? t("scopeSummary.page", { count: formatNumber(scope.from) })
          : t("scopeSummary.pages", {
              from: formatNumber(scope.from),
              to: formatNumber(scope.to),
            });
      case "ayah_range":
        return t("scopeSummary.ayahRange", {
          surah: formatSurahName(scope.surahNumber),
          from: formatNumber(scope.from),
          to: formatNumber(scope.to),
        });
    }
  }

  function formatScope(scope: QuizScope): string {
    return formatScopeSnapshot(snapshotQuizScope(scope));
  }

  function formatDate(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  }

  function formatDuration(milliseconds: number): string {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${formatNumber(minutes)}:${numbers
      .format(seconds)
      .padStart(2, locale.startsWith("ar") ? "٠" : "0")}`;
  }

  return {
    t,
    locale,
    surahNames,
    surahNameLanguage: language,
    formatDate,
    formatDuration,
    formatNumber,
    formatQuestionType,
    formatScope,
    formatScopeSnapshot,
    formatSurahName,
    formatVerseKey,
    formatVerseRef,
  };
}
