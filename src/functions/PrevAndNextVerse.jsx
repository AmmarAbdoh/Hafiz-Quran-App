import { fetchQuranData } from "../functions/QuranUthmani";

export const fetchPrevAndNextVerse = async (verse) => {
  if (!verse) {
    return [null, null];
  }

  const verseKey = verse.verse_key;
  const verseID = verse.id;
  const verseSurahNumber = verseKey.split(":")[0];

  const quranData = await fetchQuranData();

  if (quranData.length === 0) {
    return [null, null];
  }

  const currentVerseIndex = quranData.findIndex((v) => v.id === verseID);

  // Find previous verse in the same Surah
  const prevVerse =
    currentVerseIndex > 0 &&
    quranData[currentVerseIndex - 1].verse_key.startsWith(verseSurahNumber)
      ? quranData[currentVerseIndex - 1]
      : null;

  // Find next verse in the same Surah
  const nextVerse =
    currentVerseIndex < quranData.length - 1 &&
    quranData[currentVerseIndex + 1].verse_key.startsWith(verseSurahNumber)
      ? quranData[currentVerseIndex + 1]
      : null;

  return [prevVerse, nextVerse];
};
