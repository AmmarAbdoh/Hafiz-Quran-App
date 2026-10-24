/*
 * Which words on the page a stretch of phonemes belongs to.
 *
 * The model ships every ayah's phonemes already split into words - but they
 * are *phonological* words, not written ones. Recitation joins words that
 * tajweed runs together: `هُدًۭى مِّن رَّبِّهِمْ` is three words on the page and
 * one unbroken sound, `هُدَممممِررَببِهِم`, with no boundary inside it to find.
 * It happens in 4,090 of the 6,236 ayat, so it is the normal case, not an
 * edge one.
 *
 * There is no phonetiser here to ask, so the mapping is recovered by length:
 * walking both sides in order and letting each phonological word take as many
 * written words as its phoneme count accounts for. Order is never violated
 * and a written word is never split, which is what makes it safe - the worst
 * it can do is group two words that should have been separate, and they are
 * words the reciter says in one breath anyway.
 *
 * Checked against all 2,121 ayat whose two sides are the same length: it
 * recovers every one of them as a clean one-to-one, inventing no merges.
 */
import { toPhonemeUnits } from "@/features/recitation-practice/model/phonemeTokens";

const DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;
const NON_LETTERS = /[^ء-ي]/g;

/** Letters that carry sound, which is what the phoneme count reflects. */
function letterCount(word: string): number {
  return word.replace(DIACRITICS, "").replace(NON_LETTERS, "").length;
}

/**
 * How many written words each phonological word covers, in order.
 *
 * Returns null when the two cannot be reconciled - which happens for the
 * muqatta'at, where one written word (`الم`) becomes several spoken ones.
 */
export function groupWrittenWords(
  writtenWords: readonly string[],
  phonologicalWords: readonly string[],
  inventory: readonly string[],
): number[] | null {
  return groupByLength(
    writtenWords.map(letterCount),
    phonologicalWords.map((word) => toPhonemeUnits(word, inventory).length),
  );
}

/**
 * Which mushaf word each of the dataset's written words belongs to, counted
 * from 1.
 *
 * The model's dataset and the mushaf split an ayah into the same words in
 * all but four, where the dataset writes as two what the mushaf writes as
 * one: `بَعْدَ مَا` for بَعۡدَمَا in 2:181, 8:6 and 13:37, and `إِلْ يَاسِينَ`
 * for إِلۡيَاسِينَ in 37:130. Numbered by position, every sound after the split
 * was given the location of the word before it and the last one a location
 * that is not on the page, so it was never revealed or scored.
 *
 * Where the counts differ the dataset's words are grouped onto the mushaf's
 * by letter count, the same way phonological words are grouped onto written
 * ones above.
 */
export function mushafPositions(
  datasetWords: readonly string[],
  mushafWords: readonly string[],
): number[] {
  const byPosition = datasetWords.map((_, index) => index + 1);
  if (datasetWords.length <= mushafWords.length) return byPosition;

  const groups = groupByLength(
    datasetWords.map(letterCount),
    mushafWords.map(letterCount),
  );
  if (!groups) return byPosition;
  return groups.flatMap((take, index) =>
    Array.from({ length: take }, () => index + 1),
  );
}

/**
 * How many consecutive parts each whole takes, matching them by length.
 *
 * Every whole takes at least one part and order is kept. Lengths are compared
 * after scaling by the totals, so the two sides can be counted in different
 * units - letters against phonemes.
 */
function groupByLength(
  writtenLengths: readonly number[],
  spokenLengths: readonly number[],
): number[] | null {
  const written = writtenLengths.length;
  const spoken = spokenLengths.length;
  if (spoken === 0 || spoken > written) return null;

  const totalWritten = writtenLengths.reduce((a, b) => a + b, 0);
  const totalSpoken = spokenLengths.reduce((a, b) => a + b, 0);
  // Phonemes per letter for this ayah, so the comparison is scale-free.
  const ratio = totalSpoken / Math.max(1, totalWritten);

  const UNREACHABLE = Number.POSITIVE_INFINITY;
  const cost: number[][] = Array.from({ length: spoken + 1 }, () =>
    new Array<number>(written + 1).fill(UNREACHABLE),
  );
  const taken: number[][] = Array.from({ length: spoken + 1 }, () =>
    new Array<number>(written + 1).fill(0),
  );
  cost[0]![0] = 0;

  for (let s = 1; s <= spoken; s += 1) {
    for (let w = 1; w <= written; w += 1) {
      let span = 0;
      for (let take = 1; take <= w; take += 1) {
        span += writtenLengths[w - take]!;
        const previous = cost[s - 1]![w - take]!;
        if (previous === UNREACHABLE) continue;
        const candidate =
          previous + Math.abs(span * ratio - spokenLengths[s - 1]!);
        if (candidate < cost[s]![w]!) {
          cost[s]![w] = candidate;
          taken[s]![w] = take;
        }
      }
    }
  }

  if (cost[spoken]![written] === UNREACHABLE) return null;

  const groups: number[] = [];
  let w = written;
  for (let s = spoken; s > 0; s -= 1) {
    const take = taken[s]![w]!;
    groups.unshift(take);
    w -= take;
  }
  return groups;
}

export interface WrittenWord {
  /** Where it sits on the page, e.g. "2:5:3". */
  location: string;
  /** The word as the mushaf writes it. */
  text: string;
}

export interface SpokenWord {
  /** Every page word this sound covers; usually one. */
  locations: string[];
  /** Its phonemes, in the units the recogniser emits. */
  units: string[];
}

/** A spoken word with its phonemes resolved to recogniser token ids. */
export interface ScorableWord extends SpokenWord {
  ids: number[];
}

/**
 * Turn one ayah's page words into the units a recitation can be followed by.
 *
 * Falls back to treating the ayah as a single unit when the two sides cannot
 * be reconciled, which keeps the muqatta'at trackable without pretending to
 * know where inside them a boundary lies.
 */
export function buildSpokenWords(
  writtenWords: readonly WrittenWord[],
  phonologicalWords: readonly string[],
  inventory: readonly string[],
): SpokenWord[] {
  const groups = groupWrittenWords(
    writtenWords.map((word) => word.text),
    phonologicalWords,
    inventory,
  );

  if (!groups) {
    return [
      {
        locations: writtenWords.map((word) => word.location),
        units: phonologicalWords.flatMap((word) =>
          toPhonemeUnits(word, inventory),
        ),
      },
    ];
  }

  const spoken: SpokenWord[] = [];
  let at = 0;
  for (let index = 0; index < groups.length; index += 1) {
    const take = groups[index]!;
    spoken.push({
      locations: writtenWords.slice(at, at + take).map((word) => word.location),
      units: toPhonemeUnits(phonologicalWords[index]!, inventory),
    });
    at += take;
  }
  return spoken;
}
