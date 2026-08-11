import { useTranslation } from "react-i18next";
import type { QuestionType, QuizScope } from "../model/types";
import { snapshotQuizScope, type QuizScopeSnapshot } from "../model/types";

function localeFor(language: string): string {
  return language.startsWith("en") ? "en-US" : "ar-SA";
}

export function useQuizFormatters() {
  const { t, i18n } = useTranslation("quiz");
  const locale = localeFor(i18n.resolvedLanguage ?? i18n.language);
  const numbers = new Intl.NumberFormat(locale);

  function formatNumber(value: number): string {
    return numbers.format(value);
  }

  function formatQuestionType(type: QuestionType): string {
    return t(`types.labels.${type}`);
  }

  function formatScopeSnapshot(
    scope: QuizScopeSnapshot | null,
    legacyFallback?: string,
  ): string {
    if (!scope) return legacyFallback || t("scopeSummary.legacy");
    switch (scope.mode) {
      case "surah":
        return t("scopeSummary.surah", {
          surah: scope.surahNumbers.map(formatNumber).join(", "),
        });
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
          surah: formatNumber(scope.surahNumber),
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
    formatDate,
    formatDuration,
    formatNumber,
    formatQuestionType,
    formatScope,
    formatScopeSnapshot,
  };
}
