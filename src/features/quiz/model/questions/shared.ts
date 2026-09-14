import { normalizeArabicForMatch } from "@/shared/lib/arabic-normalize";
import type { QuizChoice } from "../types";
import { shuffleArray } from "../versePool";

export const DEFAULT_CHOICE_COUNT = 4;

/**
 * Surah names are shown in the interface language, so generation asks the view
 * layer for them instead of hard-coding the Arabic list.
 */
export type SurahNameLookup = (surahNumber: number) => string;

/** Renders the "surah name + ayah number" tail of a choice label. */
export type VerseRefFormatter = (
  surahNumber: number,
  ayahNumber: number,
) => string;

/** Splitting needs enough words that the visible half is a real cue. */
const MIN_COMPLETION_WORDS = 4;

export function createQuestionId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
}

/**
 * Two buttons carrying the same text read as a bug, and one of them would be
 * marked wrong, so options are unique by rendered text as well as by id.
 */
export function buildChoices(
  correct: QuizChoice,
  distractors: QuizChoice[],
  count = DEFAULT_CHOICE_COUNT,
): QuizChoice[] {
  const chosen = new Map<string, QuizChoice>([[correct.id, correct]]);
  const seenLabels = new Set([normalizeArabicForMatch(correct.label)]);

  for (const choice of shuffleArray(distractors)) {
    if (chosen.size >= count) break;
    const label = normalizeArabicForMatch(choice.label);
    if (chosen.has(choice.id) || seenLabels.has(label)) continue;
    chosen.set(choice.id, choice);
    seenLabels.add(label);
  }

  return shuffleArray([...chosen.values()]);
}

export function canSplitForCompletion(text: string): boolean {
  return countWords(text) >= MIN_COMPLETION_WORDS;
}

export function splitAyahForCompletion(text: string): {
  prompt: string;
  continuation: string;
} {
  const words = text.trim().split(/\s+/);
  if (words.length <= 2) {
    return {
      prompt: words[0] ?? text,
      continuation: words.slice(1).join(" ") || text,
    };
  }

  const splitAt = Math.max(1, Math.floor(words.length * 0.45));
  return {
    prompt: words.slice(0, splitAt).join(" "),
    continuation: words.slice(splitAt).join(" "),
  };
}

export function ayahSnippet(text: string, wordCount = 8): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= wordCount) return text.trim();
  return `${words.slice(0, wordCount).join(" ")} …`;
}
