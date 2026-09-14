import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { SURAH_NAMES, SURAH_NAMES_EN } from "../model";

export interface SurahNames {
  /** All 114 names in the interface language, indexed from zero. */
  names: readonly string[];
  /** Arabic or transliterated name for a 1-based surah number. */
  surahName: (surahNumber: number) => string;
  /** Language of the names, for `lang` and `dir` attributes around them. */
  language: "ar" | "en";
}

/**
 * Surah names follow the interface language so an English reader sees
 * "Al-Ghashiyah"; the mushaf page itself always keeps the Arabic name.
 */
export function useSurahNames(): SurahNames {
  const { i18n } = useTranslation();
  const language = (i18n.resolvedLanguage ?? i18n.language ?? "ar").startsWith(
    "en",
  )
    ? "en"
    : "ar";
  const names = language === "en" ? SURAH_NAMES_EN : SURAH_NAMES;

  // Callers list the lookup in effect and memo dependencies, so it may only
  // change when the language does.
  const surahName = useCallback(
    (surahNumber: number) => names[surahNumber - 1] ?? String(surahNumber),
    [names],
  );

  return { names, surahName, language };
}
