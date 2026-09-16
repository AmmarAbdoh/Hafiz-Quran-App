import { isQuestionTypeAvailable, type ScopeCoverage } from "./scopeCoverage";
import type { QuestionType } from "./types";

const ALL_QUESTION_TYPES: readonly QuestionType[] = [
  "fill_blank",
  "complete_ayah",
  "audio_identify",
  "surah_name",
  "ayah_number",
  "juz_number",
  "hizb_number",
  "page_number",
];

/** Questions that test recall of the text itself, rather than its location. */
export const RECALL_QUESTION_TYPES: readonly QuestionType[] = [
  "fill_blank",
  "complete_ayah",
  "audio_identify",
];

export const LOCATION_QUESTION_TYPES: readonly QuestionType[] = [
  "surah_name",
  "ayah_number",
  "juz_number",
  "hizb_number",
  "page_number",
];

export type QuizPreset = "starter" | "standard" | "everything";

export const QUIZ_PRESETS: readonly QuizPreset[] = [
  "starter",
  "standard",
  "everything",
];

const PRESET_TYPES: Record<QuizPreset, readonly QuestionType[]> = {
  starter: ["complete_ayah", "fill_blank"],
  standard: ["complete_ayah", "fill_blank", "audio_identify", "surah_name"],
  everything: ALL_QUESTION_TYPES,
};

export function getAvailableQuestionTypes(
  coverage: ScopeCoverage,
): QuestionType[] {
  return ALL_QUESTION_TYPES.filter((type) =>
    isQuestionTypeAvailable(type, coverage),
  );
}

/**
 * Narrows a deliberate selection to what a new scope can still support,
 * returning null when nothing survives so the caller falls back to a preset.
 *
 * Changing scope used to throw the whole selection away, and it runs on every
 * keystroke in a page or ayah field - typing "127" wiped a chosen set three
 * times over.
 */
export function keepSupportedQuestionTypes(
  chosen: readonly QuestionType[] | null,
  coverage: ScopeCoverage,
): QuestionType[] | null {
  if (chosen === null) return null;
  const kept = chosen.filter((type) => isQuestionTypeAvailable(type, coverage));
  return kept.length > 0 ? kept : null;
}

export function getPresetQuestionTypes(
  preset: QuizPreset,
  coverage: ScopeCoverage,
): QuestionType[] {
  const available = PRESET_TYPES[preset].filter((type) =>
    isQuestionTypeAvailable(type, coverage),
  );
  // A scope too narrow for the preset still deserves a playable session.
  return available.length > 0 ? available : getAvailableQuestionTypes(coverage);
}

export function matchesPreset(
  types: readonly QuestionType[],
  preset: QuizPreset,
  coverage: ScopeCoverage,
): boolean {
  const presetTypes = getPresetQuestionTypes(preset, coverage);
  return (
    presetTypes.length === types.length &&
    presetTypes.every((type) => types.includes(type))
  );
}

/**
 * Two identical question types in a row make a session feel repetitive, so the
 * previous type steps aside whenever another one is selected.
 */
export function pickQuestionType(
  types: readonly QuestionType[],
  previousType: QuestionType | null = null,
): QuestionType | null {
  if (types.length === 0) return null;
  const candidates =
    types.length > 1 && previousType
      ? types.filter((type) => type !== previousType)
      : types;
  const source = candidates.length > 0 ? candidates : types;
  return source[Math.floor(Math.random() * source.length)] ?? null;
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
