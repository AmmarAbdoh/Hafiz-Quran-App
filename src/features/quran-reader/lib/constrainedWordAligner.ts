import {
  arabicTokensSimilar,
  normalizeArabicForMatch,
  tokenizeArabicTranscript,
} from "@/shared/lib/arabic-normalize";

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

const LOOKAHEAD = 12;

export function createAlignerState(): AlignerState {
  return { pointer: 0 };
}

export function resetAlignerState(): AlignerState {
  return createAlignerState();
}

export interface AlignResult {
  state: AlignerState;
  matchedLocation: string | null;
  matchedCount: number;
}

export function advanceAligner(
  expected: ExpectedPracticeWord[],
  state: AlignerState,
  transcript: string,
): AlignResult {
  const tokens = tokenizeArabicTranscript(transcript);
  let pointer = state.pointer;
  let lastMatched: string | null = null;
  let matchedCount = 0;

  for (const token of tokens) {
    if (!token) continue;

    let found = false;
    const end = Math.min(pointer + LOOKAHEAD, expected.length);
    for (let index = pointer; index < end; index += 1) {
      const candidate = expected[index];
      if (!candidate) continue;
      if (arabicTokensSimilar(token, candidate.normalized)) {
        lastMatched = candidate.location;
        pointer = index + 1;
        matchedCount += 1;
        found = true;
        break;
      }
    }

    if (!found && pointer < expected.length) {
      const current = expected[pointer];
      if (current && arabicTokensSimilar(token, current.normalized)) {
        lastMatched = current.location;
        pointer += 1;
        matchedCount += 1;
      }
    }
  }

  return {
    state: { pointer },
    matchedLocation: lastMatched,
    matchedCount,
  };
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

export function getTargetWord(
  expected: ExpectedPracticeWord[],
  state: AlignerState,
): ExpectedPracticeWord | null {
  if (state.pointer >= expected.length) return null;
  return expected[state.pointer] ?? null;
}

export function isPracticeComplete(
  expected: ExpectedPracticeWord[],
  state: AlignerState,
): boolean {
  return expected.length > 0 && state.pointer >= expected.length;
}
