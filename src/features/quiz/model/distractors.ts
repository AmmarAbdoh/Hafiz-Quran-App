import { shuffleArray } from "./versePool";

export interface NumericDistractorInput {
  correct: number;
  min: number;
  max: number;
  /** Values that really occur in the scope; the most convincing wrong answers. */
  preferred?: number[];
  limit?: number;
}

/**
 * A wrong answer only teaches something when it could plausibly have been
 * right. Candidates therefore come from the values the scope actually contains,
 * then spread outward from the correct one, instead of being drawn from the
 * whole Quran: asking which ayah of Al-Ikhlas is shown is meaningless when the
 * alternatives are 146 and 164.
 */
export function buildNumericDistractors({
  correct,
  min,
  max,
  preferred = [],
  limit = 12,
}: NumericDistractorInput): number[] {
  const candidates: number[] = [];
  const seen = new Set([correct]);

  const add = (value: number) => {
    if (value < min || value > max || seen.has(value)) return;
    seen.add(value);
    candidates.push(value);
  };

  for (const value of shuffleArray(preferred)) add(value);
  for (
    let offset = 1;
    candidates.length < limit && offset <= max - min;
    offset += 1
  ) {
    for (const value of shuffleArray([correct - offset, correct + offset])) {
      add(value);
    }
  }

  return candidates.slice(0, limit);
}

/**
 * Surah alternatives read as a real choice when they come from the scope first
 * and then from mushaf neighbours, which is where a hesitant learner would look.
 */
export function buildSurahDistractors(
  correctSurah: number,
  scopeSurahs: number[],
  limit = 12,
): number[] {
  const fromScope = shuffleArray(
    scopeSurahs.filter((surah) => surah !== correctSurah),
  );
  const neighbours = buildNumericDistractors({
    correct: correctSurah,
    min: 1,
    max: 114,
    limit,
  });
  const ordered = [...fromScope, ...neighbours];
  const unique: number[] = [];
  for (const surah of ordered) {
    if (surah !== correctSurah && !unique.includes(surah)) unique.push(surah);
  }
  return unique.slice(0, limit);
}
