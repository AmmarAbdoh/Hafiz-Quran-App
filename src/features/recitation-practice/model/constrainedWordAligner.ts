import { normalizeArabicForMatch } from "@/shared/lib/arabic-normalize";

export interface ExpectedPracticeWord {
  location: string;
  verseKey: string;
  /** Raw API text (may include tashkeel). */
  text: string;
  /** Without tashkeel — shown in the practice bar. */
  displayText: string;
  /** Normalized form used for speech matching. */
  normalized: string;
}

export interface AlignerState {
  pointer: number;
}

export function createAlignerState(): AlignerState {
  return { pointer: 0 };
}

export function buildExpectedWord(
  location: string,
  verseKey: string,
  text: string,
  displayText?: string,
): ExpectedPracticeWord {
  const plain = displayText ?? text;
  return {
    location,
    verseKey,
    text,
    displayText: plain,
    normalized: normalizeArabicForMatch(plain),
  };
}

export function isPracticeComplete(
  expected: ExpectedPracticeWord[],
  state: AlignerState,
): boolean {
  return expected.length > 0 && state.pointer >= expected.length;
}
