import type { Locale } from "./resources";

const localeTags: Record<Locale, string> = {
  ar: "ar-u-nu-arab",
  en: "en-u-nu-latn",
};

export function formatNumber(
  value: number,
  locale: Locale,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(localeTags[locale], options).format(value);
}

export function formatDate(
  value: Date | number,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
  },
): string {
  return new Intl.DateTimeFormat(localeTags[locale], options).format(value);
}
