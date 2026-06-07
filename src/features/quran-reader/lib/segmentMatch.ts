import type { ExpectedPracticeWord } from "@/features/quran-reader/lib/constrainedWordAligner";
import {
  arabicTokensSimilar,
  tokenizeArabicTranscript,
} from "@/shared/lib/arabic-normalize";

export interface SegmentMatchResult {
  newPointer: number;
  revealedLocations: string[];
  hadSpeech: boolean;
  wrongAttempt: boolean;
}

/**
 * Drop leading tokens that re-recite already-passed words (e.g. full ayah retry).
 */
export function stripReRecitedPrefix(
  tokens: string[],
  expected: ExpectedPracticeWord[],
  pointer: number,
): string[] {
  if (pointer <= 0 || tokens.length === 0) return tokens;

  let tokenIndex = 0;
  let expectedIndex = 0;

  while (tokenIndex < tokens.length && expectedIndex < pointer) {
    const token = tokens[tokenIndex]!;
    const target = expected[expectedIndex]!;

    if (arabicTokensSimilar(token, target.normalized)) {
      tokenIndex += 1;
      expectedIndex += 1;
      continue;
    }

    const nextExpected = expected[expectedIndex + 1];
    if (
      nextExpected &&
      expectedIndex + 1 < pointer &&
      arabicTokensSimilar(token, nextExpected.normalized)
    ) {
      expectedIndex += 1;
      continue;
    }

    break;
  }

  if (expectedIndex >= pointer) {
    return tokens.slice(tokenIndex);
  }

  return tokens;
}

function alignConsecutiveTokens(
  expected: ExpectedPracticeWord[],
  pointer: number,
  tokens: string[],
): { newPointer: number; matchedCount: number } {
  let index = pointer;
  let matchedCount = 0;

  for (const token of tokens) {
    if (index >= expected.length) break;

    const target = expected[index]!;
    if (arabicTokensSimilar(token, target.normalized)) {
      matchedCount += 1;
      index += 1;
      continue;
    }

    break;
  }

  return { newPointer: index, matchedCount };
}

/** Align a speech chunk to the page; allows multi-word progress and ayah retries. */
export function matchRecitationSegment(
  expected: ExpectedPracticeWord[],
  pointer: number,
  transcript: string,
): SegmentMatchResult {
  const allTokens = tokenizeArabicTranscript(transcript);
  const hadSpeech = allTokens.length > 0;

  if (!hadSpeech || pointer >= expected.length) {
    return {
      newPointer: pointer,
      revealedLocations: [],
      hadSpeech,
      wrongAttempt: false,
    };
  }

  const tokens = stripReRecitedPrefix(allTokens, expected, pointer);

  if (tokens.length === 0) {
    return {
      newPointer: pointer,
      revealedLocations: [],
      hadSpeech: true,
      wrongAttempt: false,
    };
  }

  const startPointer = pointer;
  const result = alignConsecutiveTokens(expected, pointer, tokens);

  if (result.matchedCount === 0) {
    return {
      newPointer: pointer,
      revealedLocations: [],
      hadSpeech: true,
      wrongAttempt: true,
    };
  }

  const revealedLocations = expected
    .slice(startPointer, result.newPointer)
    .map((word) => word.location);

  return {
    newPointer: result.newPointer,
    revealedLocations,
    hadSpeech: true,
    wrongAttempt: false,
  };
}

export function isVerseRevealedOnPage(
  verseKey: string,
  expected: ExpectedPracticeWord[],
  revealed: ReadonlySet<string>,
): boolean {
  const verseWords = expected.filter((word) => word.verseKey === verseKey);
  if (verseWords.length === 0) return true;
  return verseWords.every((word) => revealed.has(word.location));
}
