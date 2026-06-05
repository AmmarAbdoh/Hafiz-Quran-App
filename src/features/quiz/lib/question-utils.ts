import type { QuestionType } from "@/shared/types/quran";

export function isSurahNameDisabled(
  mode: "surah" | "juz",
  indices: number[],
): boolean {
  return mode === "surah" && indices.length === 1;
}

export function isJuzNameDisabled(
  mode: "surah" | "juz",
  indices: number[],
): boolean {
  return mode === "juz" && indices.length === 1;
}

export function pickRandomQuestionType(
  types: QuestionType[],
): QuestionType | null {
  if (types.length === 0) return null;
  return types[Math.floor(Math.random() * types.length)] ?? null;
}

export function generateHiddenIndex(
  hasPrev: boolean,
  hasCurrent: boolean,
  hasNext: boolean,
): number {
  const available: number[] = [];
  if (hasPrev) available.push(0);
  if (hasCurrent) available.push(1);
  if (hasNext) available.push(2);
  const index = Math.floor(Math.random() * available.length);
  return available[index] ?? 1;
}

export function getHiddenPlaceholder(length: number): string {
  return "_".repeat(length);
}

export function checkFillBlankAnswer(
  selectedText: string,
  correctText: string,
): boolean {
  return selectedText === correctText;
}

export function checkInfoAnswer(
  selected: string,
  correct: string | number,
): boolean {
  return selected === String(correct);
}
