import { normalizeArabicForMatch } from "@/shared/lib/arabic-normalize";
import type { QuizChoice } from "./types";

const MAX_VISIBLE = 8;

function scoreMatch(normalizedLabel: string, normalizedQuery: string): number {
  if (!normalizedQuery) return 0;
  if (normalizedLabel === normalizedQuery) return 0;
  if (normalizedLabel.startsWith(normalizedQuery)) return 1;
  if (normalizedLabel.includes(normalizedQuery)) return 2;
  return -1;
}

export function filterQuizSearchChoices(
  choices: QuizChoice[],
  query: string,
  requiredChoiceId?: string,
): QuizChoice[] {
  const normalizedQuery = normalizeArabicForMatch(query);

  if (!normalizedQuery) {
    return choices;
  }

  const ranked = choices
    .map((choice) => ({
      choice,
      score: scoreMatch(normalizeArabicForMatch(choice.label), normalizedQuery),
    }))
    .filter(({ score }) => score >= 0)
    .sort((left, right) => {
      if (left.score !== right.score) return left.score - right.score;
      return left.choice.label.length - right.choice.label.length;
    })
    .map(({ choice }) => choice);

  const required = requiredChoiceId
    ? choices.find((choice) => choice.id === requiredChoiceId)
    : undefined;

  if (!required) {
    return ranked.slice(0, MAX_VISIBLE);
  }

  const visible = ranked.slice(0, MAX_VISIBLE);
  if (visible.some((choice) => choice.id === required.id)) {
    return visible;
  }

  return [...visible.slice(0, MAX_VISIBLE - 1), required];
}
