import type { QuestionType, QuizScope } from "./types";

export const ALL_QUESTION_TYPES: readonly QuestionType[] = [
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
  if (type === "surah_name") {
    return scope.mode === "surah" && (scope.surahIndices?.length ?? 0) === 1;
  }
  if (type === "juz_number") {
    return scope.mode === "juz" && (scope.juzIndices?.length ?? 0) === 1;
  }
  return false;
}

export function getDefaultQuestionTypes(scope: QuizScope): QuestionType[] {
  return ALL_QUESTION_TYPES.filter(
    (type) => !isQuestionTypeDisabled(type, scope),
  );
}

export function pickRandomQuestionType(
  types: readonly QuestionType[],
): QuestionType | null {
  if (types.length === 0) return null;
  return types[Math.floor(Math.random() * types.length)] ?? null;
}

export function generateHiddenIndex(
  hasPrevious: boolean,
  hasCurrent: boolean,
  hasNext: boolean,
): number {
  const available: number[] = [];
  if (hasPrevious) available.push(0);
  if (hasCurrent) available.push(1);
  if (hasNext) available.push(2);
  return available[Math.floor(Math.random() * available.length)] ?? 1;
}
