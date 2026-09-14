import type { MushafVerse } from "@/domain/quran";
import { buildSurahDistractors } from "../distractors";
import type { AudioIdentifyQuizQuestion } from "../types";
import { shuffleArray, toVerseKey } from "../versePool";
import {
  DEFAULT_CHOICE_COUNT,
  ayahSnippet,
  buildChoices,
  createQuestionId,
  type SurahNameLookup,
} from "./shared";

function buildSurahQuestion(
  verse: MushafVerse,
  pool: MushafVerse[],
  surahName: SurahNameLookup,
): AudioIdentifyQuizQuestion | null {
  const correctChoiceId = String(verse.sura_no);
  const distractors = buildSurahDistractors(
    verse.sura_no,
    pool.map((item) => item.sura_no),
  ).map((surah) => ({ id: String(surah), label: surahName(surah) }));

  const choices = buildChoices(
    { id: correctChoiceId, label: surahName(verse.sura_no) },
    distractors,
  );
  if (choices.length < DEFAULT_CHOICE_COUNT) return null;

  return {
    id: createQuestionId(),
    type: "audio_identify",
    verse,
    verseKey: toVerseKey(verse),
    testedVerseKey: toVerseKey(verse),
    audioPrompt: "surah",
    choices,
    correctChoiceId,
  };
}

export function generateAudioIdentifyQuestion(
  verse: MushafVerse,
  pool: MushafVerse[],
  mushafData: MushafVerse[],
  surahName: SurahNameLookup,
): AudioIdentifyQuizQuestion | null {
  const surahVerses = mushafData
    .filter((item) => item.sura_no === verse.sura_no)
    .sort((left, right) => left.aya_no - right.aya_no);
  const index = surahVerses.findIndex((item) => item.aya_no === verse.aya_no);
  const nextVerse = surahVerses[index + 1] ?? null;
  if (nextVerse === null || Math.random() < 0.5) {
    return buildSurahQuestion(verse, pool, surahName);
  }

  const correctChoiceId = toVerseKey(nextVerse);
  const distractors = shuffleArray(
    pool.filter(
      (item) =>
        toVerseKey(item) !== correctChoiceId &&
        toVerseKey(item) !== toVerseKey(verse),
    ),
  )
    .slice(0, 12)
    .map((item) => ({
      id: toVerseKey(item),
      label: ayahSnippet(item.aya_text_emlaey),
    }));

  const choices = buildChoices(
    { id: correctChoiceId, label: ayahSnippet(nextVerse.aya_text_emlaey) },
    distractors,
  );
  // Naming the surah is still a fair question when the scope cannot supply
  // four distinct continuations.
  if (choices.length < DEFAULT_CHOICE_COUNT) {
    return buildSurahQuestion(verse, pool, surahName);
  }

  return {
    id: createQuestionId(),
    type: "audio_identify",
    verse,
    verseKey: toVerseKey(verse),
    testedVerseKey: correctChoiceId,
    audioPrompt: "next_ayah",
    choices,
    correctChoiceId,
  };
}
