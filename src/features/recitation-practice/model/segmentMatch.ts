import { alignRecitation } from "@/features/recitation-practice/model/alignRecitation";
import type { ExpectedPracticeWord } from "@/features/recitation-practice/model/constrainedWordAligner";
import { tokenizeArabicTranscript } from "@/shared/lib/arabic-normalize";

export interface SegmentMatchResult {
  newPointer: number;
  /** Words the reciter has now passed, however they were said. */
  revealedLocations: string[];
  /** Of those, the ones not said as the page has them. */
  wrongLocations: string[];
  hadSpeech: boolean;
  wrongAttempt: boolean;
}

/**
 * How far past what was said the alignment may look.
 *
 * A phrase is aligned against a window of the page rather than all of it, or
 * a stray token could find a match pages ahead and drag the reader with it.
 * The slack lets the window hold the words a reciter ran slightly past.
 */
const WINDOW_SLACK = 3;

/**
 * Drop leading tokens that re-recite already-passed words, as someone does
 * when they go back to the start of an ayah.
 *
 * Compared exactly, not loosely. This used the same bag-of-characters test as
 * the matcher, and it decided `الرحمن` was `الله` - they share ا, ل and ل,
 * which is exactly the 0.75 it called a match - so a reciter picking up at
 * the third word of Al-Fatihah had that word eaten as a repeat and made no
 * progress at all. Re-reciting means saying the same words, so the same
 * words is what this should look for.
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

    if (token === target.normalized) {
      tokenIndex += 1;
      expectedIndex += 1;
      continue;
    }

    const nextExpected = expected[expectedIndex + 1];
    if (
      nextExpected &&
      expectedIndex + 1 < pointer &&
      token === nextExpected.normalized
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

/**
 * Place one pause-delimited phrase against the page.
 *
 * This used to walk the expected words one at a time and stop dead at the
 * first that did not match, which meant a single misheard word halted all
 * progress - and it compared words by how many letters they shared in any
 * order, so words from the same Arabic root matched each other.
 *
 * It now aligns the whole phrase at once. A word said wrongly is marked
 * wrong and the reciter carries on, which is what someone reciting actually
 * does, and the caller is told which words those were rather than only that
 * something was wrong.
 *
 * Trailing words the alignment could not account for are left alone: they
 * have not been reached yet, as distinct from a word skipped in the middle,
 * which has.
 */
export function matchRecitationSegment(
  expected: ExpectedPracticeWord[],
  pointer: number,
  transcript: string,
): SegmentMatchResult {
  const allTokens = tokenizeArabicTranscript(transcript);
  const hadSpeech = allTokens.length > 0;
  const nothing = {
    newPointer: pointer,
    revealedLocations: [],
    wrongLocations: [],
    hadSpeech,
    wrongAttempt: false,
  };

  if (!hadSpeech || pointer >= expected.length) return nothing;

  const tokens = stripReRecitedPrefix(allTokens, expected, pointer);
  if (tokens.length === 0) return { ...nothing, hadSpeech: true };

  const window = expected.slice(
    pointer,
    pointer + tokens.length + WINDOW_SLACK,
  );
  const alignment = alignRecitation(
    window.map((word) => word.displayText),
    tokens,
  );

  // The last word the phrase actually reached; everything after it is simply
  // not recited yet.
  let lastTouched = -1;
  for (const [index, word] of alignment.words.entries()) {
    if (word.status !== "missing") lastTouched = index;
  }

  if (lastTouched < 0) {
    return { ...nothing, hadSpeech: true, wrongAttempt: true };
  }

  const consumed = alignment.words.slice(0, lastTouched + 1);
  const revealedLocations = window
    .slice(0, consumed.length)
    .map((word) => word.location);
  const wrongLocations = consumed
    .map((word, index) =>
      word.status === "correct" ? null : (window[index]?.location ?? null),
    )
    .filter((location): location is string => location !== null);

  /*
   * A phrase with nothing right in it does not move the reader on. Saying
   * something else entirely should leave them on the word they are stuck at
   * to try again, which is what a prompt is for; it is only once part of the
   * phrase lands that carrying on past a mistake is the right thing.
   */
  if (wrongLocations.length === consumed.length) {
    return { ...nothing, hadSpeech: true, wrongAttempt: true };
  }

  return {
    newPointer: pointer + consumed.length,
    revealedLocations,
    wrongLocations,
    hadSpeech: true,
    wrongAttempt: false,
  };
}
