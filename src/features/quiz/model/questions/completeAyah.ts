import type { MushafVerse } from "@/domain/quran";
import type { CompleteAyahQuizQuestion } from "../types";
import { shuffleArray, toVerseKey } from "../versePool";
import {
  buildChoices,
  createQuestionId,
  splitAyahForCompletion,
} from "./shared";

export function generateCompleteAyahQuestion(
  verse: MushafVerse,
  pool: MushafVerse[],
): CompleteAyahQuizQuestion {
  const { prompt, continuation } = splitAyahForCompletion(verse.aya_text);
  const verseKey = toVerseKey(verse);
  const correctChoiceId = `${verseKey}-continuation`;
  const distractors = shuffleArray(
    pool
      .filter((item) => toVerseKey(item) !== verseKey)
      .map((item) => ({
        id: `${toVerseKey(item)}-continuation`,
        label: splitAyahForCompletion(item.aya_text).continuation,
      })),
  ).slice(0, 12);

  return {
    id: createQuestionId(),
    type: "complete_ayah",
    verse,
    verseKey,
    promptText: prompt,
    choices: buildChoices(
      { id: correctChoiceId, label: continuation },
      distractors,
    ),
    correctChoiceId,
  };
}
