import type { QuizChoice } from "../types";
import { shuffleArray } from "../versePool";

export function createQuestionId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function buildChoices(
  correct: QuizChoice,
  distractors: QuizChoice[],
  count = 4,
): QuizChoice[] {
  const unique = new Map<string, QuizChoice>([[correct.id, correct]]);
  for (const choice of shuffleArray(distractors)) {
    if (unique.size >= count) break;
    if (!unique.has(choice.id)) unique.set(choice.id, choice);
  }
  return shuffleArray([...unique.values()]);
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
