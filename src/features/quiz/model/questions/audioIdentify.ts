import { SURAH_NAMES } from "@/domain/quran";
import type { MushafVerse } from "@/domain/quran";
import type { AudioIdentifyQuizQuestion } from "../types";
import { shuffleArray, toVerseKey } from "../versePool";
import { ayahSnippet, buildChoices, createQuestionId } from "./shared";

export function generateAudioIdentifyQuestion(
  verse: MushafVerse,
  pool: MushafVerse[],
  mushafData: MushafVerse[],
): AudioIdentifyQuizQuestion {
  const surahVerses = mushafData
    .filter((item) => item.sura_no === verse.sura_no)
    .sort((left, right) => left.aya_no - right.aya_no);
  const index = surahVerses.findIndex((item) => item.aya_no === verse.aya_no);
  const nextVerse = surahVerses[index + 1] ?? null;
  const useSurahPrompt = nextVerse === null || Math.random() < 0.5;

  if (useSurahPrompt) {
    const correctChoiceId = String(verse.sura_no);
    const scopeSurahs = [...new Set(pool.map((item) => item.sura_no))].filter(
      (surah) => surah !== verse.sura_no,
    );
    const remainingSurahs = Array.from(
      { length: 114 },
      (_, index) => index + 1,
    ).filter(
      (surah) => surah !== verse.sura_no && !scopeSurahs.includes(surah),
    );
    const distractors = [
      ...shuffleArray(scopeSurahs),
      ...shuffleArray(remainingSurahs),
    ].map((surah) => ({
      id: String(surah),
      label: SURAH_NAMES[surah - 1] ?? String(surah),
    }));

    return {
      id: createQuestionId(),
      type: "audio_identify",
      verse,
      verseKey: toVerseKey(verse),
      audioPrompt: "surah",
      choices: buildChoices(
        {
          id: correctChoiceId,
          label: SURAH_NAMES[verse.sura_no - 1] ?? verse.sura_name_ar,
        },
        distractors,
      ),
      correctChoiceId,
    };
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

  return {
    id: createQuestionId(),
    type: "audio_identify",
    verse,
    verseKey: toVerseKey(verse),
    audioPrompt: "next_ayah",
    choices: buildChoices(
      { id: correctChoiceId, label: ayahSnippet(nextVerse.aya_text_emlaey) },
      distractors,
    ),
    correctChoiceId,
  };
}
