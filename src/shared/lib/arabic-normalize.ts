const DIACRITICS_RE =
  /[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;

/** Normalize Arabic for fuzzy speech-to-text matching against mushaf words. */
export function normalizeArabicForMatch(text: string): string {
  return text
    .replace(DIACRITICS_RE, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function tokenizeArabicTranscript(text: string): string[] {
  const normalized = normalizeArabicForMatch(text);
  if (!normalized) return [];
  return normalized.split(/\s+/).filter(Boolean);
}

export function arabicTokensSimilar(
  spoken: string,
  expected: string,
): boolean {
  if (!spoken || !expected) return false;
  if (spoken === expected) return true;
  if (spoken.includes(expected) || expected.includes(spoken)) return true;

  const minLen = Math.min(spoken.length, expected.length);
  if (minLen < 2) return spoken === expected;

  let matches = 0;
  const shorter = spoken.length <= expected.length ? spoken : expected;
  const longer = spoken.length > expected.length ? spoken : expected;
  for (const char of shorter) {
    if (longer.includes(char)) matches += 1;
  }
  return matches / shorter.length >= 0.75;
}
