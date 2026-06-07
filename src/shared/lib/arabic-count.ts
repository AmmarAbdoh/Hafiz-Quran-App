import { toArabicNumerals } from "@/shared/lib/arabic-numerals";

type AyahNounForm = "singular" | "dual" | "plural";

/**
 * Feminine noun agreement for آية after a number:
 * - 2 → dual (آيتان)
 * - 3–10 → plural (آيات)
 * - otherwise → singular (آية), including 1 and 11+
 */
export function getAyahNounForm(count: number): AyahNounForm {
  if (count === 2) return "dual";
  if (count >= 3 && count <= 10) return "plural";
  return "singular";
}

export function getAyahCountLabel(count: number): string {
  switch (getAyahNounForm(count)) {
    case "dual":
      return "آيتان";
    case "plural":
      return "آيات";
    default:
      return "آية";
  }
}

export function formatAyahCount(
  count: number,
  options?: { arabicNumerals?: boolean },
): string {
  const useArabicNumerals = options?.arabicNumerals ?? true;
  const num = useArabicNumerals ? toArabicNumerals(count) : String(count);
  return `${num} ${getAyahCountLabel(count)}`;
}
