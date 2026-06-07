const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

export function toArabicNumerals(value: number | string): string {
  return String(value).replace(
    /\d/g,
    (digit) => ARABIC_DIGITS[Number(digit)] ?? digit,
  );
}
