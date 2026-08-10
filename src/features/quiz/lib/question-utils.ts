import type { QuestionType } from "@/shared/types/quran";
import type { QuizScope } from "@/shared/types/quran";

export function isSurahNameDisabled(scope: QuizScope): boolean {
  return scope.mode === "surah" && (scope.surahIndices?.length ?? 0) === 1;
}

export function isJuzNameDisabled(scope: QuizScope): boolean {
  return scope.mode === "juz" && (scope.juzIndices?.length ?? 0) === 1;
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

export function checkInfoAnswer(
  selected: string,
  correct: string | number,
): boolean {
  return selected === String(correct);
}

export const ALL_QUESTION_TYPES: QuestionType[] = [
  "fill_blank",
  "complete_ayah",
  "audio_identify",
  "surah_name",
  "ayah_number",
  "juz_number",
  "hizb_number",
  "page_number",
];

export function isQuestionTypeDisabled(
  type: QuestionType,
  scope: QuizScope,
): boolean {
  if (type === "surah_name") return isSurahNameDisabled(scope);
  if (type === "juz_number") return isJuzNameDisabled(scope);
  return false;
}

export function getDefaultQuestionTypes(scope: QuizScope): QuestionType[] {
  return ALL_QUESTION_TYPES.filter((type) => !isQuestionTypeDisabled(type, scope));
}
