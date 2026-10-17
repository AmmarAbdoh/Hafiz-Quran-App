import { normalizeArabicForMatch } from "@/shared/lib/arabic-normalize";

/**
 * The mushaf writes some long vowels as a superscript alef over the letter;
 * standard orthography, which is what a transcript comes back in, writes them
 * as a plain alef. The shared normaliser treats it as a diacritic and deletes
 * it, so the page's `ٱلْعَٰلَمِينَ` reduced to `العلمين` while a transcript's
 * `العالمين` kept its alef, and the two never matched.
 *
 * That character is the whole of the gap between the two orthographies, and
 * it lands in some of the most recited words in the Quran - this one is in
 * Al-Fatihah. Promoted to a real alef before normalising, rather than
 * dropped.
 */
const SUPERSCRIPT_ALEF = /ٰ/g;

export function recitationMatchKey(word: string): string {
  return normalizeArabicForMatch(word.replace(SUPERSCRIPT_ALEF, "ا"));
}

export type RecitedWordStatus =
  /** Said, and said correctly. */
  | "correct"
  /** Something was said in its place, but not this word. */
  | "substituted"
  /** Not said at all. */
  | "missing";

/*
 * Reachable through RecitationAlignment["words"]; exported when something
 * needs to name it, which nothing does yet.
 */
interface AlignedWord {
  /** The word the page expects, as it should be read. */
  expected: string;
  /** What was heard in its place, when something was. */
  heard: string | null;
  status: RecitedWordStatus;
}

export interface RecitationAlignment {
  words: AlignedWord[];
  /** Substitutions, omissions and insertions together. */
  errors: number;
  /** Errors against the length of the passage, so verses compare fairly. */
  rate: number;
  /** Heard, but answering to nothing on the page. */
  extra: string[];
}

/**
 * Line up what was recited against what the page says.
 *
 * This replaces a test that compared two words by how many letters they had
 * in common, in any order, and called 75% a match. Arabic words are built on
 * shared three-letter roots, so that accepted near-neighbours constantly -
 * `كتب` and `بتك` scored a perfect match - and it could not tell a word said
 * in the wrong place from a word not said at all.
 *
 * Word-level edit distance with a backtrace answers both: what the total
 * damage was, and which word on the page each piece of it belongs to. The
 * per-word verdict is what lets the reader be shown where they went wrong
 * rather than only that they did.
 *
 * Measured on 32 labelled clips this separated cleanly - correct recitation
 * scored 0.00-0.10, mistakes 0.25-2.00, nothing between.
 */
export function alignRecitation(
  expectedWords: readonly string[],
  spokenWords: readonly string[],
): RecitationAlignment {
  const expected = expectedWords.map((word) => ({
    raw: word,
    key: recitationMatchKey(word),
  }));
  const spoken = spokenWords
    .map((word) => recitationMatchKey(word))
    .filter(Boolean);

  const rows = expected.length + 1;
  const cols = spoken.length + 1;
  const cost = Array.from({ length: rows }, () => new Int32Array(cols));

  for (let i = 0; i < rows; i += 1) cost[i]![0] = i;
  for (let j = 0; j < cols; j += 1) cost[0]![j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const same = expected[i - 1]!.key === spoken[j - 1];
      cost[i]![j] = Math.min(
        cost[i - 1]![j - 1]! + (same ? 0 : 1),
        cost[i - 1]![j]! + 1,
        cost[i]![j - 1]! + 1,
      );
    }
  }

  /*
   * Walked from the end so each expected word is given the fate the cheapest
   * alignment assigned it: matched, replaced by something else, or skipped.
   */
  const words: AlignedWord[] = [];
  const extra: string[] = [];
  let i = expected.length;
  let j = spoken.length;

  while (i > 0 || j > 0) {
    const current = cost[i]?.[j] ?? 0;

    if (i > 0 && j > 0) {
      const same = expected[i - 1]!.key === spoken[j - 1];
      if (current === cost[i - 1]![j - 1]! + (same ? 0 : 1)) {
        words.push({
          expected: expected[i - 1]!.raw,
          heard: spoken[j - 1] ?? null,
          status: same ? "correct" : "substituted",
        });
        i -= 1;
        j -= 1;
        continue;
      }
    }

    if (i > 0 && current === cost[i - 1]![j]! + 1) {
      words.push({
        expected: expected[i - 1]!.raw,
        heard: null,
        status: "missing",
      });
      i -= 1;
      continue;
    }

    // Heard, but nothing on the page is waiting for it.
    if (j > 0) {
      extra.push(spoken[j - 1]!);
      j -= 1;
      continue;
    }
    break;
  }

  words.reverse();
  extra.reverse();

  const errors = cost[expected.length]?.[spoken.length] ?? 0;
  return {
    words,
    errors,
    rate: errors / Math.max(1, expected.length),
    extra,
  };
}

/**
 * Where to draw the line between a recitation that was right and one that
 * was not.
 *
 * Placed in the gap the measurement found rather than fitted to a point: over
 * 32 labelled clips correct recitation scored 0.00-0.10 and mistakes
 * 0.25-2.00, with nothing in between, so anything in that range behaves the
 * same. Kept here beside the aligner because it belongs to the judgement, not
 * to whichever model produced the words.
 */
const RECITATION_ERROR_THRESHOLD = 0.18;

export function wasRecitedCorrectly(alignment: RecitationAlignment): boolean {
  return alignment.rate <= RECITATION_ERROR_THRESHOLD;
}
