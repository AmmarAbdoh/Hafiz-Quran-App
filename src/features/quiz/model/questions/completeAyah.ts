import { stripAyahMarker } from "@/domain/quran";
import type { MushafVerse } from "@/domain/quran";
import type { CompleteAyahQuizQuestion } from "../types";
import { shuffleArray, toVerseKey } from "../versePool";
import {
  DEFAULT_CHOICE_COUNT,
  buildChoices,
  canSplitForCompletion,
  createQuestionId,
  splitAyahForCompletion,
} from "./shared";

export function generateCompleteAyahQuestion(
  verse: MushafVerse,
  pool: MushafVerse[],
): CompleteAyahQuizQuestion | null {
  // A two-word ayah cannot be split into a cue and a continuation.
  if (!canSplitForCompletion(verse.aya_text)) return null;

  const { prompt, continuation } = splitAyahForCompletion(verse.aya_text);
  const verseKey = toVerseKey(verse);
  const correctChoiceId = `${verseKey}-continuation`;
  const distractors = shuffleArray(
    pool.filter(
      (item) =>
        toVerseKey(item) !== verseKey && canSplitForCompletion(item.aya_text),
    ),
  )
    .slice(0, 12)
    .map((item) => ({
      id: `${toVerseKey(item)}-continuation`,
      label: stripAyahMarker(
        splitAyahForCompletion(item.aya_text).continuation,
      ),
    }));

  /*
   * Without the ayah number. It is an ornament rather than a word, it is the
   * same distance from being the answer on every option, and outside the
   * mushaf font it renders as a pair of Arabic letters.
   */
  const choices = buildChoices(
    { id: correctChoiceId, label: stripAyahMarker(continuation) },
    distractors,
  );
  if (choices.length < DEFAULT_CHOICE_COUNT) return null;

  return {
    id: createQuestionId(),
    type: "complete_ayah",
    verse,
    verseKey,
    testedVerseKey: verseKey,
    promptText: prompt,
    choices,
    correctChoiceId,
  };
}
